import type { CosmeticCategory, CosmeticId, CosmeticShopState, CosmeticState } from '../shared/types'

export const COSMETIC_REFRESH_MS = 5 * 60 * 60_000

export interface CosmeticDefinition {
  id: CosmeticId
  category: CosmeticCategory
  name: string
  icon: string
  price: number
  description: string
}

export const COSMETICS: CosmeticDefinition[] = [
  { id: 'bell-gold', category: 'bell', name: '金铃铛', icon: '🔔', price: 200, description: '暖金色小铃铛，走起路来叮当响。' },
  { id: 'bell-blue', category: 'bell', name: '蓝晶铃', icon: '🩵', price: 350, description: '清透的蓝晶铃，衬得蓝眼睛更亮。' },
  { id: 'bell-rose', category: 'bell', name: '玫瑰铃', icon: '🌸', price: 500, description: '玫瑰色小铃铛，带一枚心形挂坠。' },
  { id: 'shirt-berry', category: 'clothes', name: '莓果针织衫', icon: '🧶', price: 600, description: '柔软莓红针织衫，领口有奶油色滚边。' },
  { id: 'shirt-sky', category: 'clothes', name: '晴空水手服', icon: '🌊', price: 800, description: '天空蓝水手领，清清爽爽。' },
  { id: 'shirt-forest', category: 'clothes', name: '森林小马甲', icon: '🌲', price: 1000, description: '森林绿小马甲，配金色纽扣。' },
  { id: 'hat-beret', category: 'hat', name: '樱桃贝雷帽', icon: '🍒', price: 500, description: '樱桃红小贝雷帽，给耳朵留出位置。' },
  { id: 'hat-straw', category: 'hat', name: '蜂蜜草帽', icon: '🌾', price: 650, description: '轻巧的蜂蜜色草帽，适合晒太阳。' },
  { id: 'hat-blue', category: 'hat', name: '云朵针织帽', icon: '🧢', price: 800, description: '软软的天蓝针织帽，不遮住猫耳。' },
  { id: 'scarf-red', category: 'scarf', name: '红白围巾', icon: '🧣', price: 300, description: '暖暖的红白条纹围巾。' },
  { id: 'scarf-mint', category: 'scarf', name: '薄荷围巾', icon: '🍃', price: 450, description: '清凉薄荷绿针织围巾。' },
  { id: 'scarf-mustard', category: 'scarf', name: '蜂蜜格纹围巾', icon: '🟨', price: 600, description: '蜂蜜黄格纹围巾，软乎乎的。' },
  { id: 'tie-bow-red', category: 'tie', name: '莓红蝴蝶结', icon: '🎀', price: 500, description: '小巧的莓红色蝴蝶结。' },
  { id: 'tie-necktie-blue', category: 'tie', name: '蓝条纹领带', icon: '👔', price: 650, description: '蓝白细条纹领带，精神又可爱。' },
  { id: 'tie-bow-charcoal', category: 'tie', name: '星点领结', icon: '🖤', price: 800, description: '深灰领结上点缀奶油色小星点。' }
]

export const COSMETIC_CATEGORIES: { id: CosmeticCategory; name: string; icon: string }[] = [
  { id: 'bell', name: '铃铛', icon: '🔔' },
  { id: 'clothes', name: '衣服', icon: '👕' },
  { id: 'hat', name: '帽子', icon: '🎩' },
  { id: 'scarf', name: '围巾', icon: '🧣' },
  { id: 'tie', name: '领带', icon: '🎀' }
]

export const EMPTY_EQUIPPED: Record<CosmeticCategory, CosmeticId | null> = {
  bell: null, clothes: null, hat: null, scarf: null, tie: null
}

export function cosmeticById(id: CosmeticId | null | undefined) {
  return id ? COSMETICS.find((item) => item.id === id) : undefined
}

export function createCosmeticShop(now: number, owned: readonly CosmeticId[] = []): CosmeticShopState {
  const candidates = COSMETICS.filter((item) => !owned.includes(item.id)).map((item) => item.id)
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[candidates[index], candidates[target]] = [candidates[target], candidates[index]]
  }
  return { stock: candidates.slice(0, 4), nextRefreshAt: now + COSMETIC_REFRESH_MS }
}

export function createCosmeticState(now: number): CosmeticState {
  return { owned: [], equipped: { ...EMPTY_EQUIPPED }, shop: createCosmeticShop(now) }
}

export function normalizeCosmeticState(value: Partial<CosmeticState> | undefined, now: number): CosmeticState {
  const owned = COSMETICS.map((item) => item.id).filter((id) => Array.isArray(value?.owned) && value.owned!.includes(id))
  const equipped = { ...EMPTY_EQUIPPED }
  for (const category of COSMETIC_CATEGORIES) {
    const id = value?.equipped?.[category.id]
    equipped[category.id] = id && owned.includes(id) && cosmeticById(id)?.category === category.id ? id : null
  }
  const savedShop = value?.shop
  const validStock = Array.isArray(savedShop?.stock)
    ? savedShop.stock.filter((id, index, all): id is CosmeticId => COSMETICS.some((item) => item.id === id) && !owned.includes(id) && all.indexOf(id) === index).slice(0, 4)
    : []
  const shop = savedShop && Number.isFinite(savedShop.nextRefreshAt) && savedShop.nextRefreshAt > now
    ? { stock: validStock, nextRefreshAt: savedShop.nextRefreshAt }
    : createCosmeticShop(now, owned)
  return { owned, equipped, shop }
}

export function refreshCosmeticShop(state: CosmeticState, now: number): CosmeticState {
  return state.shop.nextRefreshAt > now ? state : { ...state, shop: createCosmeticShop(now, state.owned) }
}
