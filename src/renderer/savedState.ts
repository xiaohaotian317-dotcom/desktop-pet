import type { IngredientId, PersistedState } from '../shared/types'
import { createDailyTaskBoard } from '../shared/dailyTasks'
import { normalizePlayerPreferences } from '../shared/rewards'
import { affectionLevel, createOrderBoard, emptyPlot, localDayKey } from './activities'
import { createCosmeticState } from './cosmetics'
import { createWardrobeState, normalizeWardrobe, unlockAchievementOutfits } from './outfits'

const EMPTY_COOKING_POT = { recipeId: null, startedAt: 0, doneAt: 0 }
const EMPTY_COMPOST_POT = { startedAt: 0, doneAt: 0 }

/** Add missing fields without replacing an existing player's inventory or timers. */
export function restoreSavedState(value: PersistedState | null, initial: PersistedState, isTestBuild = false, now = Date.now()): PersistedState {
  if (!value?.pets?.dakuan) return { ...structuredClone(initial), orders: createOrderBoard(now), cosmetics: createCosmeticState(now), wardrobe: createWardrobeState(now, isTestBuild) }
  const savedOrders = value.orders?.orders?.length === 6 && value.orders.nextRefreshAt > now ? value.orders : createOrderBoard(now)
  const dailyTasks = value.orders?.dailyTasks?.date === localDayKey(now) && value.orders.dailyTasks.tasks?.length === 3
    ? value.orders.dailyTasks : createDailyTaskBoard(now)
  const savedKitchen = value.kitchen
  const savedGarden = value.garden
  const restoredPet = { ...initial.pets.dakuan, ...value.pets.dakuan }
  const weight = typeof restoredPet.weightTenthsJin === 'string' && /^\d+$/u.test(restoredPet.weightTenthsJin) ? BigInt(restoredPet.weightTenthsJin) : 10n
  restoredPet.weightTenthsJin = weight.toString()
  restoredPet.lastPoopAt = Number.isFinite(restoredPet.lastPoopAt) && restoredPet.lastPoopAt > 0 ? restoredPet.lastPoopAt : now
  if ((value.schemaVersion ?? 0) < 3) restoredPet.hunger = Math.max(0, Math.min(100, 100 - (value.pets.dakuan.hunger ?? 20)))
  return {
    ...value,
    pets: { dakuan: restoredPet },
    schemaVersion: 12,
    paused: Boolean(value.paused), soundMuted: Boolean(value.soundMuted),
    ...normalizePlayerPreferences(value),
    affection: { ...initial.affection, ...(value.affection ?? {}) },
    kitchen: {
      ingredients: { ...initial.kitchen.ingredients, ...(savedKitchen?.ingredients ?? {}) },
      pantry: { ...initial.kitchen.pantry, ...(savedKitchen?.pantry ?? {}) },
      pots: Array.from({ length: 6 }, (_, index) => ({ ...EMPTY_COOKING_POT, ...(savedKitchen?.pots?.[index] ?? {}) })),
      lastIngredients: Array.isArray(savedKitchen?.lastIngredients) && savedKitchen.lastIngredients.length === 2 ? savedKitchen.lastIngredients as [IngredientId, IngredientId] : null
    },
    garden: { plots: Array.from({ length: 10 }, (_, index) => ({ ...emptyPlot(), ...(savedGarden?.plots?.[index] ?? {}) })) },
    droppings: Array.isArray(value.droppings) ? value.droppings.slice(-500) : [],
    compost: {
      ...initial.compost, ...(value.compost ?? {}),
      poopCount: Math.max(0, value.compost?.poopCount ?? 0),
      rainbowPoopCount: Math.max(0, value.compost?.rainbowPoopCount ?? 0),
      fertilizerCount: Math.max(0, value.compost?.fertilizerCount ?? 0),
      unlockedPots: Math.max(2, Math.min(5, value.compost?.unlockedPots ?? 2)),
      ordinarySinceRainbow: Math.max(0, value.compost?.ordinarySinceRainbow ?? 0),
      nextRainbowAt: Math.max(50, Math.min(100, value.compost?.nextRainbowAt ?? (50 + Math.floor(Math.random() * 51)))),
      pots: Array.from({ length: 5 }, (_, index) => ({ ...EMPTY_COMPOST_POT, ...(value.compost?.pots?.[index] ?? {}) }))
    },
    coins: Math.max(0, Math.floor(value.coins ?? 0)),
    orders: { ...savedOrders, dailyTasks },
    constipationMode: Boolean(value.constipationMode),
    cosmetics: value.cosmetics ?? createCosmeticState(now),
    wardrobe: unlockAchievementOutfits(normalizeWardrobe(value.wardrobe, now, isTestBuild), affectionLevel(value.affection?.dakuan ?? 0), weight, isTestBuild),
    alwaysOnTop: value.alwaysOnTop !== false
  }
}
