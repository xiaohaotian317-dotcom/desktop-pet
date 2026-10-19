# 大款桌宠：软件架构

本文描述当前代码，源码变化后再同步更新。根目录 `README.md` 是快速开发/打包说明；本文件是实现地图。

## 技术栈与入口

- Electron 44.7.2 提供 Windows 桌面窗口、托盘、IPC、文件系统存档和打包运行时。
- React 19 + TypeScript + Vite 负责单窗口透明桌宠及交互面板。
- `src/main/index.ts`：Electron 主进程、窗口生命周期、置顶、托盘、桌面显示器边界、诊断日志、用户数据目录、存档读取/恢复/写入及 IPC。
- `src/preload/index.ts`：通过受限 preload API 暴露状态读取/保存、暂停/静音、桌面信息、指针穿透和退出等功能给 renderer。
- `src/renderer/main.tsx`：React 启动入口。
- `src/renderer/App.tsx`：游戏状态总协调，处理状态恢复/默认值归一化、桌宠行为、互动、喂食、体重、排便、订单领取、商店购买及页面切换。
- `src/renderer/PetCharacter.tsx`：当前动作帧、朝向、显示风格与完整穿搭动作图集的渲染。
- `src/renderer/ActivityPages.tsx`：厨房、菜园、化肥工坊和订单/每日任务页面。
- `src/renderer/WardrobePages.tsx`：穿搭仓库预览及商店界面。
- `src/renderer/activities.ts`：食谱、作物成长、亲密度、订单生成/需求与库存逻辑。
- `src/renderer/outfits.ts`：套装定义、价格/文案、仓库归一化、商店刷新和成就解锁。
- `src/renderer/cosmetics.ts`：旧的独立装饰系统定义及状态辅助；与完整套装并存的代码需在改动时确认是否仍被界面使用。
- `src/shared/types.ts`：宠物、厨房、菜园、化肥、订单、任务、穿搭及 `PersistedState` 的共享类型。
- `src/shared/dailyTasks.ts`：基于本地日期的三项每日任务生成和进度更新。
- `src/shared/kitchenProgression.ts`：六口锅的体重门槛；第三至第六口分别为 20 斤、100 斤、500 斤、2 吨。
- `src/renderer/assets/`：角色图集、完整套装动作图、独立装饰、菜园/厨房参考图及系统铲子光标。
- `scripts/`：穿搭动作图集规范化、打包和联系表生成脚本。

## 状态流与 IPC

renderer 以共享 `PersistedState` 保存游戏数据。主进程持有最近状态缓存，并以 IPC 提供载入和保存；状态变化会广播回 renderer。页面组件接收状态和回调，由 `App.tsx` 执行业务逻辑再统一提交状态。

`PersistedState`（当前 schemaVersion 11）包含：

- `pets`、`affection`、`paused`、`soundMuted`、`alwaysOnTop`
- `kitchen`（食材、粮柜、6 个锅及最近食材搭配）
- `garden`（10 个地块）
- `droppings`、`compost`（便便、彩色便便、化肥与最多 5 个制作槽）
- `coins`、`orders`（订单板和每日任务）、`constipationMode`
- `wardrobe`（整套服装所有权、穿着项、商店库存与刷新时刻）
- `cosmetics`（历史独立配件数据；修改前确认当前依赖）

归一化/迁移要保持旧版本字段并给新字段补默认值；不要把默认模板整体写回去覆盖旧档。每次新增状态字段时同步更新共享类型、初始化、读取迁移、保存及相关界面。

## 存档路径与保护

- 正式版数据目录：`%APPDATA%\DakuanDesktopPet\pet-state.json`。
- 测试版隔离目录：`%APPDATA%\DakuanDesktopPet-Test`。
- 主进程启动会扫描当前路径、`.bak` 以及若干历史应用目录/便携目录中的旧状态，比较有效性和进度后决定恢复来源。
- 主进程保存时先复制有效现档到 `pet-state.json.bak`，再写临时文件并原子重命名覆盖主档。
- 损坏主档会保留 `.corrupt-backup`；恢复替换时会保留 `.recovered-backup` 并写 `logs/startup.log`。
- 代码修改不得削弱上述保护。任何数据迁移要避免空白记录覆盖进度更高的备份；对“进度评分”新增重要资产字段时，要考虑评分是否会因此把富存档错判为低进度。
- 另一台电脑的便携版不会自动读取本机档案；需要复制主档和备份。

## 窗口与兼容性

- 主进程在应用启动时禁用 GPU 硬件加速，使用透明桌面窗口覆盖当前连接显示器总区域，并能根据屏幕边界漫游。
- `setAlwaysOnTop` 使用 `screen-saver` 层级；面板与宠物同属主窗口，需一起保持置顶。
- 启动窗口有加载/超时显示和错误诊断逻辑；日志在 `%APPDATA%\DakuanDesktopPet\logs\startup.log`。
- 菜园铲子通过发布资源中的系统 `.cur` 光标和配套 SVG 实现；检查打包资源路径及 hotspot。

## 美术与动画

- 宠物基准是 4 列 × 8 行的动作图集，每个动作 4 帧；渲染按相同动作/帧序驱动。
- 完整服饰每套有自己的动作图集，切换套装就切换整张对应动作资源。不要将衣服、帽子、铃铛拆成大量组合动画，也不要假设图层在所有动作上的锚点天然兼容。
- 图集处理脚本对透明底角色做分离/规范化、控制尺寸和脚底锚点，并在帧之间留安全间距；生成后应以联系表检查尺寸一致性、抖动、动作幅度和穿帮。
- 当前 `PetCharacter.tsx` 中资源映射是运行时来源；新增套装需同时登记 `OutfitId`、商品信息、仓库资源导入、测试构建/成就解锁逻辑和对应图集。

## 构建与资源排除

- 包管理器：pnpm；`package.json` 版本当前为 0.3.2。
- `pnpm dev` 开发；`pnpm build` 构建 renderer/main；`pnpm dist:win` 生成 x64 便携、ARM64 便携和 x64 安装包；`pnpm dist:test` 生成使用独立标识/存档目录的测试包。
- Windows 发行配置在 `package.json`；全服饰解锁测试配置在 `electron-builder.test.json`。
- `.gitignore` 排除 `node_modules/`、`.pnpm-store/`、`out/`、`release/` 和日志。源码仓库默认不包含可执行发布包。
