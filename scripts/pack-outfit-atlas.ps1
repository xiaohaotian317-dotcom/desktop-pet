param(
  [string]$InputDirectory = (Join-Path $PSScriptRoot '..\src\renderer\assets\outfits\raw'),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\src\renderer\assets\outfits'),
  [double]$TargetIdleWidth = 160,
  [double]$MaximumFrameExtent = 173,
  [double]$FootMargin = 24
)

# Run with Windows PowerShell 5.1 (powershell.exe) for its built-in GDI+ imaging support.
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies @('System.dll','System.Core.dll','System.Drawing.dll') -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class OutfitAtlasPacker {
  private sealed class Component {
    public int Id, MinX, MaxX, MinY, MaxY, Area, Row, Col;
    public double Width { get { return MaxX-MinX+1; } }
    public double Height { get { return MaxY-MinY+1; } }
  }

  public static void Pack(string input, string output, double targetIdleWidth, double maxExtent, double footMargin) {
    using (var source = new Bitmap(input)) {
      int width=source.Width, height=source.Height;
      if (Math.Abs(width/(double)height-0.5)>0.01) throw new InvalidOperationException("Expected a 4x8 sprite atlas: "+input);
      int stride;
      byte[] pixels;
      var sourceData=source.LockBits(new Rectangle(0,0,width,height),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
      try {
        stride=Math.Abs(sourceData.Stride); pixels=new byte[stride*height]; Marshal.Copy(sourceData.Scan0,pixels,0,pixels.Length);
      } finally { source.UnlockBits(sourceData); }
      int[] labels=new int[width*height];
      int[] queue=new int[width*height];
      var components=new List<Component>();
      int nextId=0;
      for(int sy=0;sy<height;sy++) for(int sx=0;sx<width;sx++) {
        int start=sy*width+sx;
        if(labels[start]!=0 || pixels[sy*stride+sx*4+3]<24) continue;
        int head=0,tail=0,minX=sx,maxX=sx,minY=sy,maxY=sy;
        labels[start]=++nextId; queue[tail++]=start;
        while(head<tail) {
          int index=queue[head++],x=index%width,y=index/width;
          if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
          int y0=Math.Max(0,y-1),y1=Math.Min(height-1,y+1),x0=Math.Max(0,x-1),x1=Math.Min(width-1,x+1);
          for(int yy=y0;yy<=y1;yy++) for(int xx=x0;xx<=x1;xx++) {
            int n=yy*width+xx;
            if(labels[n]==0 && pixels[yy*stride+xx*4+3]>=24) { labels[n]=nextId;queue[tail++]=n; }
          }
        }
        if(tail<200) continue;
        double centerX=(minX+maxX+1)/2.0,centerY=(minY+maxY+1)/2.0;
        components.Add(new Component { Id=nextId,MinX=minX,MaxX=maxX,MinY=minY,MaxY=maxY,Area=tail,Col=Math.Min(3,(int)(centerX/(width/4.0))),Row=Math.Min(7,(int)(centerY/(height/8.0))) });
      }
      var cells=new Component[8,4];
      foreach(var component in components) {
        if(cells[component.Row,component.Col]!=null) throw new InvalidOperationException(String.Format("Multiple sprites assigned to frame {0},{1} in {2}",component.Row,component.Col,input));
        cells[component.Row,component.Col]=component;
      }
      for(int r=0;r<8;r++) for(int c=0;c<4;c++) if(cells[r,c]==null) throw new InvalidOperationException(String.Format("Missing sprite at frame {0},{1} in {2}; found {3} connected sprites",r,c,input,components.Count));

      double[] idleWidths=new double[4]; for(int c=0;c<4;c++) idleWidths[c]=cells[0,c].Width;
      Array.Sort(idleWidths);
      double medianIdle=(idleWidths[1]+idleWidths[2])/2.0;
      double outfitScale=targetIdleWidth/medianIdle;
      double cellW=width/4.0,cellH=height/8.0;
      int pad=5;
      string folder=System.IO.Path.GetDirectoryName(output);
      if(!System.IO.Directory.Exists(folder)) System.IO.Directory.CreateDirectory(folder);
      using(var result=new Bitmap(width,height,PixelFormat.Format32bppArgb)) {
        using(var graphics=Graphics.FromImage(result)) {
          graphics.Clear(Color.Transparent);
          graphics.CompositingMode=CompositingMode.SourceOver;
          graphics.CompositingQuality=CompositingQuality.HighQuality;
          graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;
          graphics.PixelOffsetMode=PixelOffsetMode.HighQuality;
          for(int row=0;row<8;row++) for(int col=0;col<4;col++) {
            var component=cells[row,col];
            int left=Math.Max(0,component.MinX-pad),top=Math.Max(0,component.MinY-pad);
            int right=Math.Min(width-1,component.MaxX+pad),bottom=Math.Min(height-1,component.MaxY+pad);
            int cropW=right-left+1,cropH=bottom-top+1;
            using(var crop=new Bitmap(cropW,cropH,PixelFormat.Format32bppArgb)) {
              var cropRect=new Rectangle(0,0,cropW,cropH);
              var data=crop.LockBits(cropRect,ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
              try {
                int cropStride=Math.Abs(data.Stride); byte[] isolated=new byte[cropStride*cropH];
                for(int y=0;y<cropH;y++) for(int x=0;x<cropW;x++) {
                  int sx=left+x,sy=top+y,position=sy*stride+sx*4;
                  bool belongs=labels[sy*width+sx]==component.Id;
                  if(!belongs && pixels[position+3]>0) {
                    for(int yy=Math.Max(0,sy-1);yy<=Math.Min(height-1,sy+1)&&!belongs;yy++)
                      for(int xx=Math.Max(0,sx-1);xx<=Math.Min(width-1,sx+1);xx++)
                        if(labels[yy*width+xx]==component.Id){belongs=true;break;}
                  }
                  if(!belongs) continue;
                  int destination=y*cropStride+x*4;
                  Buffer.BlockCopy(pixels,position,isolated,destination,4);
                }
                Marshal.Copy(isolated,0,data.Scan0,isolated.Length);
              } finally { crop.UnlockBits(data); }
              double scale=outfitScale;
              scale=Math.Min(scale,maxExtent/cropW);
              scale=Math.Min(scale,maxExtent/cropH);
              double drawW=cropW*scale,drawH=cropH*scale;
              double cellLeft=col*cellW,cellTop=row*cellH;
              double destX=cellLeft+(cellW-drawW)/2.0;
              double destY=cellTop+cellH-footMargin-drawH;
              graphics.DrawImage(crop,new RectangleF((float)destX,(float)destY,(float)drawW,(float)drawH),new RectangleF(0,0,cropW,cropH),GraphicsUnit.Pixel);
            }
          }
        }
        result.Save(output,ImageFormat.Png);
      }
    }
  }
}
'@

$ErrorActionPreference = 'Stop'
Get-ChildItem -LiteralPath $InputDirectory -Filter '*.png' -File | Sort-Object Name | ForEach-Object {
  $destination = Join-Path $OutputDirectory $_.Name
  [OutfitAtlasPacker]::Pack($_.FullName,$destination,$TargetIdleWidth,$MaximumFrameExtent,$FootMargin)
  Write-Output "Packed $($_.Name): isolated 32 sprites, normalized idle width ${TargetIdleWidth}px, frame extent <= ${MaximumFrameExtent}px."
}
