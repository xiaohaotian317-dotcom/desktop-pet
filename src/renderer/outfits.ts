import type { OutfitId, OutfitShopState, WardrobeState } from '../shared/types'

export const OUTFIT_REFRESH_MS = 5 * 60 * 60_000

export const OUTFITS: { id: OutfitId; name: string; icon: string; price: number; description: string; story: string; unlock?: 'affection-7' | 'one-ton' | 'poop-500' }[] = [
  { id: 'gentleman-red', name: '红围巾绅士', icon: '🎩', price: 500, description: '红色小礼服配围巾、帽子和金铃铛。', story: '大款把红围巾系得整整齐齐，准备去街角喝牛奶；路上遇见的小鱼，也要先礼貌地打个招呼。' },
  { id: 'christmas', name: '圣诞团子', icon: '🎄', price: 800, description: '节日红绿穿搭，软绒绒又暖和。', story: '圣诞夜里，大款戴上软乎乎的节日帽，蹲在树下守着礼物，最后把最大的蝴蝶结留给自己。' },
  { id: 'sailor', name: '海风水手', icon: '⚓', price: 750, description: '蓝白水手服，戴上小帽迎着海风。', story: '大款今天当上了小水手，认真望向远方；其实它的航线只有一站——有鱼香味的地方。' },
  { id: 'spring-hanfu', name: '春日汉服', icon: '🌸', price: 999, description: '温柔的中式春装，点缀雅致花纹。', story: '春风吹过花园，大款穿着汉服慢慢散步，还一本正经地在花瓣旁坐下，等人夸它可爱。' },
  { id: 'gardener', name: '花园园丁', icon: '🌿', price: 600, description: '围裙和小帽，随时准备打理菜园。', story: '大款戴上草帽巡了一圈菜园，检查每一片叶子，还悄悄把最圆的南瓜留给了自己。' },
  { id: 'chef', name: '奶油主厨', icon: '🍰', price: 650, description: '白色厨师装配小领巾和厨师帽。', story: '厨房里飘来香味，大款立刻系好领巾开始监工；每道菜都要先由它闻一闻才算合格。' },
  { id: 'detective', name: '森林侦探', icon: '🔎', price: 850, description: '格纹侦探披肩和小帽，认真巡逻。', story: '大款接到一桩神秘案件：猫罐头少了一盒。它沿着香味追查，最后在自己的小窝里找到了线索。' },
  { id: 'little-wealth-god', name: '小财神', icon: '🧧', price: 1049, description: '喜气的中式新年礼服，金色元宝点缀。', story: '新年一到，大款穿上喜庆新衣巡门拜年；收下红包后，它说要存起来，转头就买了小鱼干。' },
  { id: 'blue-white-porcelain', name: '青花雅韵', icon: '🏺', price: 949, description: '青白配色的中式穿搭，清雅秀气。', story: '大款穿着青花纹样的衣裳，在茶桌旁摆出端庄模样；听见零食袋响，又马上跑了过来。' },
  { id: 'dunhuang', name: '敦煌飞天', icon: '✨', price: 1099, description: '灵感来自敦煌色彩与飘带的华丽穿搭。', story: '金色飘带随着大款轻轻转圈，像壁画里的小飞天；表演结束后，它稳稳落在软垫上打了个哈欠。' },
  { id: 'affection-heart', name: '心心相印', icon: '💗', price: 0, description: '亲密度达到 7 级解锁的粉色爱心纪念装。', story: '大款把你们一起攒下的亲密心意穿在身上。每颗小爱心，都是一次陪伴留下的纪念。', unlock: 'affection-7' },
  { id: 'ton-champion', name: '吨吨冠军', icon: '⚖️', price: 0, description: '体重达到 1 吨解锁的蓝金冠军披风。', story: '终于达成一吨里程碑啦！大款披上冠军斗篷，胸前的金色秤徽章闪闪发亮。', unlock: 'one-ton' },
  { id: 'poop-pudding', name: '便便布丁团', icon: '💩', price: 0, description: '用 500 个普通便便在商店兑换的焦糖团子装。', story: '大款把收集来的便便变成了焦糖色团子穿搭，还认真别上了一片小绿叶，宣布这是最有成就感的一套衣服。', unlock: 'poop-500' }
]

const OUTFIT_IDS = OUTFITS.map((outfit) => outfit.id)

export function createOutfitShop(now: number, owned: readonly OutfitId[] = []): OutfitShopState {
  const candidates = OUTFITS.filter((outfit) => !outfit.unlock && !owned.includes(outfit.id)).map((outfit) => outfit.id)
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[candidates[index], candidates[target]] = [candidates[target], candidates[index]]
  }
  return { stock: candidates.slice(0, 4), nextRefreshAt: now + OUTFIT_REFRESH_MS }
}

export function createWardrobeState(now: number, unlockAll = false): WardrobeState {
  const owned = unlockAll ? [...OUTFIT_IDS] : []
  return { owned, equipped: null, shop: createOutfitShop(now, owned) }
}

export function normalizeWardrobe(value: unknown, now: number, unlockAll = false): WardrobeState {
  const saved = value && typeof value === 'object' ? value as Partial<WardrobeState> : undefined
  const owned = unlockAll ? [...OUTFIT_IDS] : OUTFIT_IDS.filter((id) => Array.isArray(saved?.owned) && saved.owned.includes(id))
  const equipped = saved?.equipped && owned.includes(saved.equipped) ? saved.equipped : null
  const savedShop = saved?.shop
  const validStock = Array.isArray(savedShop?.stock)
    ? savedShop.stock.filter((id, index, all): id is OutfitId => OUTFITS.some((outfit) => outfit.id === id && !outfit.unlock) && !owned.includes(id) && all.indexOf(id) === index).slice(0, 4)
    : []
  const shop = savedShop && Number.isFinite(savedShop.nextRefreshAt) && savedShop.nextRefreshAt > now
    ? { stock: validStock, nextRefreshAt: savedShop.nextRefreshAt }
    : createOutfitShop(now, owned)
  return { owned, equipped, shop }
}

export function unlockAchievementOutfits(state: WardrobeState, affectionLevel: number, weightTenthsJin: bigint, unlockAll = false) {
  const unlockable = OUTFITS.filter((outfit) => outfit.unlock === 'affection-7' && affectionLevel >= 7 || outfit.unlock === 'one-ton' && weightTenthsJin >= 20_000n)
    .map((outfit) => outfit.id)
  const owned = unlockAll ? OUTFIT_IDS : Array.from(new Set([...state.owned, ...unlockable]))
  if (owned.length === state.owned.length && owned.every((id) => state.owned.includes(id))) return state
  return { ...state, owned, shop: { ...state.shop, stock: state.shop.stock.filter((id) => !owned.includes(id)) } }
}

export function refreshOutfitShop(state: WardrobeState, now: number): WardrobeState {
  return state.shop.nextRefreshAt > now ? state : { ...state, shop: createOutfitShop(now, state.owned) }
}

export function outfitById(id: OutfitId | null | undefined) {
  return id ? OUTFITS.find((outfit) => outfit.id === id) : undefined
}
