import type { PersistedState } from './types'

export const WELCOME_GIFT_ID = 'dakuan-welcome'

export function normalizePlayerPreferences(value: Partial<PersistedState>) {
  return {
    soundVolume: typeof value.soundVolume === 'number' && Number.isFinite(value.soundVolume)
      ? Math.max(0, Math.min(100, value.soundVolume)) : 100,
    redeemedCodes: Array.isArray(value.redeemedCodes)
      ? Array.from(new Set(value.redeemedCodes.filter((id): id is string => typeof id === 'string'))) : []
  }
}

export function redeemGiftCode(state: PersistedState, input: string) {
  if (input.trim() !== '大款') return { state, success: false, message: '兑换码不正确，请检查后重试。' }
  if (state.redeemedCodes.includes(WELCOME_GIFT_ID)) return { state, success: false, message: '这份存档已经领取过“大款”礼包啦。' }
  return {
    success: true,
    message: '兑换成功：200 金币、10 个化肥、花园园丁套装已放入仓库。',
    state: {
      ...state,
      coins: state.coins + 200,
      compost: { ...state.compost, fertilizerCount: state.compost.fertilizerCount + 10 },
      redeemedCodes: [...state.redeemedCodes, WELCOME_GIFT_ID],
      wardrobe: {
        ...state.wardrobe,
        owned: Array.from(new Set([...state.wardrobe.owned, 'gardener'] as const)),
        shop: { ...state.wardrobe.shop, stock: state.wardrobe.shop.stock.filter((id) => id !== 'gardener') }
      }
    }
  }
}
