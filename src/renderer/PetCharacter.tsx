import type { CSSProperties } from 'react'
import type { OutfitId, PetAction, PetId } from '../shared/types'
import dakuanAtlas from './assets/dakuan-atlas.png'
import gentlemanRed from './assets/outfits/gentleman-red.png'
import christmas from './assets/outfits/christmas.png'
import sailor from './assets/outfits/sailor.png'
import springHanfu from './assets/outfits/spring-hanfu.png'
import gardener from './assets/outfits/gardener.png'
import chef from './assets/outfits/chef.png'
import detective from './assets/outfits/detective.png'
import littleWealthGod from './assets/outfits/little-wealth-god.png'
import blueWhitePorcelain from './assets/outfits/blue-white-porcelain.png'
import dunhuang from './assets/outfits/dunhuang.png'
import affectionHeart from './assets/outfits/affection-heart.png'
import tonChampion from './assets/outfits/ton-champion.png'
import poopPudding from './assets/outfits/poop-pudding.png'

const ACTION_ROW: Record<PetAction, number> = {
  idle: 0, walk: 1, run: 2, eat: 3, can: 3, hungry: 3, sad: 3,
  play: 4, ball: 4, pounce: 4, wag: 4, bark: 4, excited: 4, together: 4,
  groom: 5, facewash: 5, bath: 5, pet: 5, dirty: 5,
  sleep: 6, sun: 6, sunSleep: 6, stretch: 7
}

const ACTION_FRAME_DURATION: Partial<Record<PetAction, string>> = {
  idle: '2.6s', walk: '.88s', run: '.58s', eat: '.86s', can: '.86s',
  sleep: '3s', sun: '2.8s', sunSleep: '2.8s', groom: '1.55s', facewash: '1.55s',
  bath: '1.55s', pet: '1.45s', play: '.84s', ball: '.84s', pounce: '.84s', together: '2s'
}

export type PetVisualStyle = 'pixel' | 'illustrated'

export const OUTFIT_ATLASES: Record<OutfitId, string> = {
  'gentleman-red': gentlemanRed,
  christmas,
  sailor,
  'spring-hanfu': springHanfu,
  gardener,
  chef,
  detective,
  'little-wealth-god': littleWealthGod,
  'blue-white-porcelain': blueWhitePorcelain,
  dunhuang,
  'affection-heart': affectionHeart,
  'ton-champion': tonChampion,
  'poop-pudding': poopPudding
}

export function PetCharacter({ id, action, facingLeft = false, visualStyle = 'pixel', freezeFrames = false, outfit = null }: {
  id: PetId; action: PetAction; facingLeft?: boolean; visualStyle?: PetVisualStyle; freezeFrames?: boolean; outfit?: OutfitId | null
}) {
  const row = ACTION_ROW[action]
  const frameDuration = ACTION_FRAME_DURATION[action] ?? '.72s'
  const style = { '--frame-y': `${row * (100 / 7)}%`, '--frame-duration': frameDuration } as CSSProperties & { '--frame-y': string; '--frame-duration': string }
  const atlas = outfit ? OUTFIT_ATLASES[outfit] : dakuanAtlas
  const locomotionFacing = facingLeft && (action === 'walk' || action === 'run')
  const freeze = freezeFrames ? 'freeze-frames' : ''
  return <div
    className={`character dakuan pose-${action} ${visualStyle} ${outfit ? 'outfit-render' : ''} ${locomotionFacing ? 'facing-left' : ''} ${freeze}`}
    style={style}
    role="img"
    aria-label="大款，圆滚滚的暹罗猫，蓝眼睛、巧克力色重点色和白手套"
  >
    <span className={`character-layer motion-sprite ${freeze}`} style={{ backgroundImage: `url(${atlas})` }} />
  </div>
}
