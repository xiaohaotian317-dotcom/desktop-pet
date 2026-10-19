export type PetId = 'dakuan'
export type PetAction = 'idle' | 'walk' | 'run' | 'eat' | 'can' | 'play' | 'bath' | 'pet' | 'sun' | 'together' | 'wag' | 'bark' | 'sleep' | 'groom' | 'facewash' | 'stretch' | 'sunSleep' | 'hungry' | 'sad' | 'dirty' | 'ball' | 'pounce' | 'excited'
export type CosmeticCategory = 'bell' | 'clothes' | 'hat' | 'scarf' | 'tie'
export type CosmeticId = 'bell-gold' | 'bell-blue' | 'bell-rose' | 'shirt-berry' | 'shirt-sky' | 'shirt-forest' | 'hat-beret' | 'hat-straw' | 'hat-blue' | 'scarf-red' | 'scarf-mint' | 'scarf-mustard' | 'tie-bow-red' | 'tie-necktie-blue' | 'tie-bow-charcoal'
export type OutfitId = 'gentleman-red' | 'christmas' | 'sailor' | 'spring-hanfu' | 'gardener' | 'chef' | 'detective' | 'little-wealth-god' | 'blue-white-porcelain' | 'dunhuang' | 'affection-heart' | 'ton-champion' | 'poop-pudding'
export type IngredientId = 'wheat' | 'catnip' | 'carrot' | 'fish' | 'pumpkin' | 'chicken' | 'milk' | 'silverherb' | 'goldfish'
export type CropId = 'wheat' | 'catnip' | 'carrot' | 'fishTree' | 'pumpkin' | 'chickenBerry' | 'milkBerry' | 'salmonTree' | 'silverHerb' | 'goldfishTree'
export type RecipeId = 'dog_biscuit' | 'catnip_kibble' | 'fish_feast' | 'fish_can' | 'silverherb_meal'

export interface PetState {
  hunger: number
  mood: number
  cleanliness: number
  x: number
  y: number
  lastUpdated: number
  lastBathAt: number
  bathDate: string
  bathsToday: number
  lastAffectionAt: number
  starvingSince: number
  hungerPenaltyHours: number
  /** Tenths of a jin, stored as a decimal string so weight can grow without numeric overflow. */
  weightTenthsJin: string
  lastPoopAt: number
}

export interface CookingPotState {
  recipeId: RecipeId | null
  startedAt: number
  doneAt: number
}

export interface GardenPlotState {
  cropId: CropId | null
  plantedAt: number
  growthBonusMs: number
  lastWaterAt: number
  waterDate: string
  wateringsToday: number
}

export interface KitchenState {
  ingredients: Record<IngredientId, number>
  pantry: Record<RecipeId, number>
  pots: CookingPotState[]
  lastIngredients: [IngredientId, IngredientId] | null
}

export type OrderRequirement =
  | { kind: 'poop'; amount: number }
  | { kind: 'rainbowPoop'; amount: number }
  | { kind: 'meal'; recipeId: RecipeId; amount: number }

export interface DeliveryOrder {
  id: string
  requirements: OrderRequirement[]
  reward: number
  claimed: boolean
}

export type DailyTaskKind = 'collect-poop' | 'complete-orders' | 'cook-cans' | 'cook-meals' | 'water-crops' | 'harvest-crops' | 'feed-cat' | 'play-with-cat'

export interface DailyTask {
  id: string
  kind: DailyTaskKind
  title: string
  target: number
  progress: number
  claimed: boolean
}

export interface DailyTaskBoardState {
  /** Local calendar date in YYYY-MM-DD format. */
  date: string
  tasks: DailyTask[]
}

export interface OrderBoardState {
  orders: DeliveryOrder[]
  nextRefreshAt: number
  dailyTasks: DailyTaskBoardState
}

export interface CosmeticShopState {
  stock: CosmeticId[]
  nextRefreshAt: number
}

export interface CosmeticState {
  owned: CosmeticId[]
  equipped: Record<CosmeticCategory, CosmeticId | null>
  shop: CosmeticShopState
}

export interface OutfitShopState {
  stock: OutfitId[]
  nextRefreshAt: number
}

export interface WardrobeState {
  owned: OutfitId[]
  equipped: OutfitId | null
  shop: OutfitShopState
}

export interface GardenState {
  plots: GardenPlotState[]
}

export interface Dropping {
  id: string
  x: number
  y: number
  createdAt: number
  rainbow?: boolean
}

export interface FertilizerPotState {
  startedAt: number
  doneAt: number
}

export interface CompostState {
  poopCount: number
  rainbowPoopCount: number
  fertilizerCount: number
  pots: FertilizerPotState[]
  unlockedPots: number
  ordinarySinceRainbow: number
  nextRainbowAt: number
}

export interface PersistedState {
  schemaVersion: number
  pets: Record<PetId, PetState>
  paused: boolean
  soundMuted: boolean
  affection: Record<PetId, number>
  kitchen: KitchenState
  garden: GardenState
  droppings: Dropping[]
  compost: CompostState
  coins: number
  orders: OrderBoardState
  constipationMode: boolean
  cosmetics: CosmeticState
  wardrobe: WardrobeState
  /** Whether the desktop pet overlay should stay above normal windows. */
  alwaysOnTop?: boolean
}

export interface DisplayArea {
  x: number
  y: number
  width: number
  height: number
}

export interface DesktopInfo {
  origin: { x: number; y: number }
  width: number
  height: number
  displays: DisplayArea[]
}

export interface DesktopPetApi {
  loadState: () => Promise<PersistedState>
  saveState: (state: PersistedState) => void
  setPointerActive: (active: boolean) => void
  getDesktopInfo: () => Promise<DesktopInfo>
  setPaused: (paused: boolean) => void
  setSoundMuted: (muted: boolean) => void
  quit: () => void
}

declare global {
  const __DAKUAN_TEST_BUILD__: boolean
  interface Window { desktopPets: DesktopPetApi }
}
