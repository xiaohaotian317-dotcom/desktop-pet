import type { CropId, GardenPlotState, IngredientId, OrderBoardState, OrderRequirement, PersistedState, RecipeId } from '../shared/types'
import { createDailyTaskBoard } from '../shared/dailyTasks'

export const AFFECTION_MILESTONES = [0, 100, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400] as const

export function affectionLevel(points: number) {
  let level = 1
  for (let index = 1; index < AFFECTION_MILESTONES.length; index += 1) {
    if (points < AFFECTION_MILESTONES[index]) break
    level = index + 1
  }
  return level
}

export function affectionProgress(points: number) {
  const level = affectionLevel(points)
  const current = AFFECTION_MILESTONES[level - 1] ?? 0
  const next = AFFECTION_MILESTONES[level] ?? current + 1200
  return { level, current, next, progress: Math.max(0, Math.min(100, ((points - current) / (next - current)) * 100)) }
}

export const INGREDIENTS: { id: IngredientId; name: string; icon: string }[] = [
  { id: 'wheat', name: '小麦', icon: '🌾' },
  { id: 'catnip', name: '猫薄荷', icon: '🌿' },
  { id: 'carrot', name: '胡萝卜', icon: '🥕' },
  { id: 'fish', name: '小鱼', icon: '🐟' },
  { id: 'pumpkin', name: '南瓜', icon: '🎃' },
  { id: 'chicken', name: '鸡肉果', icon: '🍗' },
  { id: 'milk', name: '奶果', icon: '🥛' },
  { id: 'silverherb', name: '银叶草', icon: '🍃' },
  { id: 'goldfish', name: '金鱼果', icon: '🐠' }
]

export const CROPS: {
  id: CropId; name: string; icon: string; ingredient: IngredientId; growMs: number; unlockAt: number; yield: [number, number]
}[] = [
  { id: 'wheat', name: '小麦', icon: '🌾', ingredient: 'wheat', growMs: 60_000, unlockAt: 0, yield: [2, 3] },
  { id: 'catnip', name: '猫薄荷', icon: '🌿', ingredient: 'catnip', growMs: 180_000, unlockAt: 0, yield: [2, 3] },
  { id: 'carrot', name: '胡萝卜', icon: '🥕', ingredient: 'carrot', growMs: 300_000, unlockAt: 80, yield: [2, 3] },
  { id: 'fishTree', name: '小鱼树', icon: '🐠🌳', ingredient: 'fish', growMs: 600_000, unlockAt: 140, yield: [2, 3] },
  { id: 'pumpkin', name: '南瓜藤', icon: '🎃', ingredient: 'pumpkin', growMs: 900_000, unlockAt: 230, yield: [2, 3] },
  { id: 'chickenBerry', name: '鸡肉果', icon: '🍗🌱', ingredient: 'chicken', growMs: 1_500_000, unlockAt: 350, yield: [2, 3] },
  { id: 'milkBerry', name: '奶果树', icon: '🥛🌳', ingredient: 'milk', growMs: 2_100_000, unlockAt: 500, yield: [2, 3] },
  { id: 'salmonTree', name: '鲑鱼树', icon: '🍣🌲', ingredient: 'fish', growMs: 2_700_000, unlockAt: 700, yield: [3, 4] },
  { id: 'silverHerb', name: '银叶草', icon: '🍃', ingredient: 'silverherb', growMs: 3_300_000, unlockAt: 950, yield: [3, 4] },
  { id: 'goldfishTree', name: '金鱼树', icon: '🐠🌳', ingredient: 'goldfish', growMs: 3_600_000, unlockAt: 1_300, yield: [3, 4] }
]

export const RECIPES: Record<RecipeId, {
  name: string; icon: string; outputName: string; outputIcon: string; kind: 'dog' | 'cat' | 'can';
  hunger: number; affection: number; cookMs: number; ingredients: [IngredientId, IngredientId]
}> = {
  dog_biscuit: { name: '香脆鸡肉饼', icon: '🍗', outputName: '鸡肉小饼', outputIcon: '🍗', kind: 'cat', hunger: 5, affection: 5, cookMs: 25_000, ingredients: ['chicken', 'pumpkin'] },
  catnip_kibble: { name: '猫薄荷鱼粮', icon: '🐟', outputName: '猫薄荷鱼粮', outputIcon: '🐟', kind: 'cat', hunger: 10, affection: 5, cookMs: 20_000, ingredients: ['wheat', 'catnip'] },
  fish_feast: { name: '鲜鱼猫饭', icon: '🍲', outputName: '鲜鱼猫饭', outputIcon: '🍲', kind: 'cat', hunger: 20, affection: 9, cookMs: 35_000, ingredients: ['catnip', 'fish'] },
  fish_can: { name: '银鱼猫罐头', icon: '🥫', outputName: '银鱼猫罐头', outputIcon: '🥫', kind: 'can', hunger: 30, affection: 13, cookMs: 45_000, ingredients: ['fish', 'milk'] },
  silverherb_meal: { name: '银叶鲜鱼饭', icon: '🍃🐟', outputName: '银叶鲜鱼饭', outputIcon: '🍃🍲', kind: 'cat', hunger: 24, affection: 11, cookMs: 50_000, ingredients: ['silverherb', 'fish'] }
}

export const INITIAL_AFFECTION: Record<'dakuan', number> = { dakuan: 0 }
export const INITIAL_INGREDIENTS: Record<IngredientId, number> = {
  wheat: 0, catnip: 0, carrot: 0, fish: 0, pumpkin: 0, chicken: 0, milk: 0, silverherb: 0, goldfish: 0
}
export const INITIAL_PANTRY: Record<RecipeId, number> = { dog_biscuit: 3, catnip_kibble: 3, fish_feast: 0, fish_can: 1, silverherb_meal: 0 }

const ORDER_REFRESH_MS = 2 * 60 * 60_000
const orderMealPool: RecipeId[] = ['dog_biscuit', 'catnip_kibble', 'fish_feast', 'fish_can', 'silverherb_meal']
const randomInt = (minimum: number, maximum: number) => minimum + Math.floor(Math.random() * (maximum - minimum + 1))
// Each order rolls its own tier. Easy orders are common; the top reward is rare
// and can naturally be absent across multiple refreshes.
const ORDER_TIER_WEIGHTS = [45, 28, 16, 8, 3]

function randomOrderTier() {
  let roll = Math.random() * ORDER_TIER_WEIGHTS.reduce((sum, weight) => sum + weight, 0)
  for (let tier = 0; tier < ORDER_TIER_WEIGHTS.length; tier += 1) {
    roll -= ORDER_TIER_WEIGHTS[tier]
    if (roll < 0) return tier
  }
  return 0
}

function createOrderRequirements(tier: number): OrderRequirement[] {
  const meal = (minimum: number, maximum: number, pool = orderMealPool): OrderRequirement => ({ kind: 'meal', recipeId: pool[randomInt(0, pool.length - 1)], amount: randomInt(minimum, maximum) })
  if (tier === 0) return Math.random() < .2 ? [{ kind: 'poop', amount: randomInt(10, 20) }] : [meal(3, 5, orderMealPool.slice(0, 2))]
  if (tier === 1) return Math.random() < .2 ? [{ kind: 'poop', amount: randomInt(30, 50) }] : [{ kind: 'meal', recipeId: 'fish_feast', amount: randomInt(2, 3) }]
  if (tier === 2) return Math.random() < .2 ? [{ kind: 'poop', amount: randomInt(20, 40) }, meal(3, 5)] : [meal(3, 5), meal(2, 4)]
  if (tier === 3) return Math.random() < .15 ? [{ kind: 'poop', amount: randomInt(80, 120) }] : [meal(8, 12, ['fish_can', 'silverherb_meal'])]
  return Math.random() < .1 ? [{ kind: 'poop', amount: 150 }] : [{ kind: 'meal', recipeId: 'fish_can', amount: 20 }]
}

export function createOrderBoard(now: number): OrderBoardState {
  return {
    orders: Array.from({ length: 6 }, (_, index) => {
      const tier = randomOrderTier()
      return { id: `${now}-${index}-${Math.random().toString(36).slice(2, 7)}`, requirements: createOrderRequirements(tier), reward: [20, 35, 50, 70, 100][tier], claimed: false }
    }),
    nextRefreshAt: now + ORDER_REFRESH_MS,
    dailyTasks: createDailyTaskBoard(now)
  }
}

export function orderRequirementStock(requirement: OrderRequirement, state: PersistedState) {
  if (requirement.kind === 'poop') return state.compost.poopCount
  if (requirement.kind === 'rainbowPoop') return state.compost.rainbowPoopCount
  return state.kitchen.pantry[requirement.recipeId] ?? 0
}

export function orderRequirementLabel(requirement: OrderRequirement) {
  if (requirement.kind === 'poop') return '普通便便'
  if (requirement.kind === 'rainbowPoop') return '彩色便便'
  return RECIPES[requirement.recipeId].outputName
}

export function emptyPlot(): GardenPlotState {
  return { cropId: null, plantedAt: 0, growthBonusMs: 0, lastWaterAt: 0, waterDate: localDayKey(Date.now()), wateringsToday: 0 }
}

export function localDayKey(time: number) {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function unlockedPlotCount(highestAffection: number) {
  const thresholds = [0, 0, 0, 100, 200, 300, 500, 800, 1200, 1800]
  return thresholds.filter((threshold) => highestAffection >= threshold).length
}

export function cropGrowth(cropId: CropId, plot: GardenPlotState, now: number) {
  const crop = CROPS.find((item) => item.id === cropId)!
  const elapsed = Math.max(0, now - plot.plantedAt + plot.growthBonusMs)
  const progress = Math.min(100, (elapsed / crop.growMs) * 100)
  return { elapsed, progress, ready: progress >= 100, stage: progress < 30 ? 0 : progress < 70 ? 1 : 2, duration: crop.growMs }
}

