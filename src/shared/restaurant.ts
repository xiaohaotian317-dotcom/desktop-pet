/** The restaurant advances only while its page is active. All timers are seconds of play. */
export type WrapIngredient = 'meat' | 'fries' | 'pickles' | 'sauce'
export type RestaurantStock = WrapIngredient | 'bread' | 'soda' | 'juice'
export type RestaurantUpgrade = 'knife' | 'fryer' | 'grill' | 'drinks' | 'counter' | 'helper' | 'cashier' | 'sweets' | 'decor'
export type RestaurantPhase = 'ready' | 'open' | 'closing' | 'summary'
export type MachineStage = 'idle' | 'working' | 'ready' | 'burnt'
export interface RestaurantMachine { stage: MachineStage; remaining: number; age: number }
export interface RestaurantTray {
  stage: 'empty' | 'open' | 'wrapped' | 'grilling' | 'grilled' | 'burnt'
  ingredients: WrapIngredient[]
  fries: boolean
  drink: 'soda' | 'juice' | null
}
export interface RestaurantOrder { ingredients: WrapIngredient[]; grilled: boolean; fries: boolean; drink: 'soda' | 'juice' | null }
export interface RestaurantCustomer {
  id: number
  name: string
  appearance: number
  kind: 'normal' | 'beggar' | 'thief'
  status: 'waiting' | 'payment' | 'remind'
  order: RestaurantOrder
  patience: number
  maxPatience: number
  payment: number
  tips: number
  taps: number
  stolen: number
  hasStolen: boolean
  sweetUsed: boolean
}
export interface RestaurantStats { served: number; lost: number; earned: number; tips: number; wasted: number; stolen: number; caught: number }
export interface RestaurantReport extends RestaurantStats { day: number; goal: number; bonus: number }
export interface RestaurantState {
  day: number
  phase: RestaurantPhase
  paused: boolean
  elapsed: number
  closingElapsed: number
  arrivalIn: number
  serial: number
  upgrades: Record<RestaurantUpgrade, number>
  stock: Record<RestaurantStock, number>
  restocking: Partial<Record<'bread' | 'pickles' | 'sauce', number>>
  meatCuts: number
  potatoCuts: number
  rawFries: number
  fryer: RestaurantMachine
  soda: RestaurantMachine
  juice: RestaurantMachine
  grill: RestaurantMachine
  grillTray: number | null
  trays: RestaurantTray[]
  selectedTray: number
  selectedCustomer: number | null
  customers: RestaurantCustomer[]
  sweets: number
  helperIn: number
  stats: RestaurantStats
  completedDays: number
  lifetimeServed: number
  lifetimeRevenue: number
  upgradeSpent: number
  lastReport: RestaurantReport | null
}
export type RestaurantAction =
  | { type: 'start' | 'pause' | 'end' | 'slice-meat' | 'cut-potato' | 'fry' | 'collect-fries' | 'bread' | 'wrap' | 'grill' | 'collect-grill' | 'trash' | 'serve' | 'sweet' }
  | { type: 'tick'; seconds: number }
  | { type: 'select-tray'; index: number }
  | { type: 'select-customer' | 'collect-money' | 'special'; id: number }
  | { type: 'ingredient'; ingredient: WrapIngredient }
  | { type: 'side'; item: 'fries' | 'soda' | 'juice' }
  | { type: 'drink'; item: 'soda' | 'juice' }
  | { type: 'restock'; item: 'bread' | 'pickles' | 'sauce' }
  | { type: 'upgrade'; id: RestaurantUpgrade }

export const SERVICE_SECONDS = 180
export const INGREDIENT_LABELS: Record<RestaurantStock, string> = { bread: '饼皮', meat: '烤肉', fries: '薯条', pickles: '酸黄瓜', sauce: '酱汁', soda: '汽水', juice: '橙汁' }
export const UPGRADE_DEFS: { id: RestaurantUpgrade; name: string; icon: string; prices: number[]; days: number[]; effects: string[] }[] = [
  { id: 'knife', name: '切肉刀', icon: '🔪', prices: [120, 280, 500], days: [1, 2, 4], effects: ['切肉 2 次出一批，每批 4 份', '切肉 1 次出一批，每批 5 份', '每批增加到 7 份'] },
  { id: 'fryer', name: '炸锅', icon: '🍟', prices: [180, 380, 620], days: [1, 3, 5], effects: ['每锅 6 份，油炸缩短至 5 秒', '每锅 8 份，4 秒出锅并自动装盒', '每锅 10 份，3 秒出锅'] },
  { id: 'grill', name: '烤饼机', icon: '🔥', prices: [260, 480], days: [2, 4], effects: ['解锁烤卷饼订单，烘烤 7 秒', '烘烤缩短至 4 秒，保温更久'] },
  { id: 'drinks', name: '饮料台', icon: '🥤', prices: [220, 420], days: [2, 4], effects: ['解锁汽水和套餐订单', '解锁橙汁，两台机器各 2 秒装一杯'] },
  { id: 'counter', name: '出餐台', icon: '🛎️', prices: [200, 450], days: [1, 3], effects: ['3 个顾客位置、2 个备餐盘', '4 个顾客位置、3 个备餐盘'] },
  { id: 'helper', name: '猫咪员工', icon: '🐱', prices: [300, 650, 950], days: [2, 4, 6], effects: ['每 12 秒检查并补充饼皮、酱汁和酸黄瓜', '同时自动准备烤肉', '同时切土豆、油炸并收取薯条'] },
  { id: 'cashier', name: '自动收款', icon: '💰', prices: [550], days: [3], effects: ['普通顾客用餐后自动收款；赖账猫仍需提醒'] },
  { id: 'sweets', name: '安抚小饼干', icon: '🍪', prices: [160], days: [2], effects: ['每天 3 份，给选中的顾客增加 20 秒耐心'] },
  { id: 'decor', name: '温馨装修', icon: '🌼', prices: [180, 360], days: [1, 3], effects: ['顾客耐心 +10 秒，每单小费 +1', '顾客耐心再 +10 秒，小费再 +1'] }
]
const STOCK_KEYS: RestaurantStock[] = ['bread', 'meat', 'fries', 'pickles', 'sauce', 'soda', 'juice']
const WRAP_KEYS: WrapIngredient[] = ['meat', 'fries', 'pickles', 'sauce']
const emptyMachine = (): RestaurantMachine => ({ stage: 'idle', remaining: 0, age: 0 })
const emptyTray = (): RestaurantTray => ({ stage: 'empty', ingredients: [], fries: false, drink: null })
const emptyStats = (): RestaurantStats => ({ served: 0, lost: 0, earned: 0, tips: 0, wasted: 0, stolen: 0, caught: 0 })
export const trayCount = (state: RestaurantState) => 1 + state.upgrades.counter
export const seatCount = (state: RestaurantState) => 2 + state.upgrades.counter
export const dailyGoal = (day: number) => Math.min(12, 3 + Math.floor((day - 1) / 2))
export const nextOpeningDay = (state: RestaurantState) => state.phase === 'summary' ? state.day + 1 : state.day
export const meatClicks = (state: RestaurantState) => Math.max(1, 3 - state.upgrades.knife)
export const frySeconds = (state: RestaurantState) => 6 - state.upgrades.fryer
export const fryBatch = (state: RestaurantState) => 4 + state.upgrades.fryer * 2
export const grillSeconds = (state: RestaurantState) => state.upgrades.grill >= 2 ? 4 : 7
export const drinkSeconds = (state: RestaurantState) => state.upgrades.drinks >= 2 ? 2 : 4
export const isRestaurantServing = (state: RestaurantState) => state.phase === 'open' || state.phase === 'closing'

export function createRestaurantState(): RestaurantState {
  return {
    day: 1, phase: 'ready', paused: false, elapsed: 0, closingElapsed: 0, arrivalIn: 2, serial: 0,
    upgrades: { knife: 0, fryer: 0, grill: 0, drinks: 0, counter: 0, helper: 0, cashier: 0, sweets: 0, decor: 0 },
    stock: { bread: 12, meat: 0, fries: 0, pickles: 10, sauce: 10, soda: 0, juice: 0 },
    restocking: {}, meatCuts: 0, potatoCuts: 0, rawFries: 0,
    fryer: emptyMachine(), soda: emptyMachine(), juice: emptyMachine(), grill: emptyMachine(), grillTray: null,
    trays: Array.from({ length: 3 }, emptyTray), selectedTray: 0, selectedCustomer: null, customers: [], sweets: 0, helperIn: 12,
    stats: emptyStats(), completedDays: 0, lifetimeServed: 0, lifetimeRevenue: 0, upgradeSpent: 0, lastReport: null
  }
}

const nonNegative = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback
const integer = (value: unknown, fallback = 0) => Math.floor(nonNegative(value, fallback))
function normalizeMachine(machine?: RestaurantMachine): RestaurantMachine {
  return { stage: ['idle', 'working', 'ready', 'burnt'].includes(machine?.stage ?? '') ? machine!.stage : 'idle', remaining: nonNegative(machine?.remaining), age: nonNegative(machine?.age) }
}
function normalizeTray(tray?: RestaurantTray): RestaurantTray {
  return {
    stage: ['empty', 'open', 'wrapped', 'grilling', 'grilled', 'burnt'].includes(tray?.stage ?? '') ? tray!.stage : 'empty',
    ingredients: Array.isArray(tray?.ingredients) ? [...new Set(tray.ingredients.filter((id) => WRAP_KEYS.includes(id)))] : [],
    fries: Boolean(tray?.fries), drink: tray?.drink === 'soda' || tray?.drink === 'juice' ? tray.drink : null
  }
}

/** Upgrade old pet saves without touching any existing pet, coin, kitchen or outfit fields. */
export function normalizeRestaurant(value?: Partial<RestaurantState>): RestaurantState {
  const state = createRestaurantState()
  if (!value || typeof value !== 'object') return state
  state.day = Math.max(1, integer(value.day, 1))
  state.phase = ['ready', 'open', 'closing', 'summary'].includes(value.phase ?? '') ? value.phase! : 'ready'
  // Returning to a saved shift must never make customers leave before the page is opened.
  state.paused = isRestaurantServing(state) || Boolean(value.paused)
  for (const key of ['elapsed', 'closingElapsed', 'arrivalIn', 'helperIn'] as const) state[key] = nonNegative(value[key], state[key])
  for (const key of ['serial', 'completedDays', 'lifetimeServed', 'lifetimeRevenue', 'upgradeSpent', 'meatCuts', 'potatoCuts', 'rawFries', 'sweets'] as const) state[key] = integer(value[key], state[key])
  for (const def of UPGRADE_DEFS) state.upgrades[def.id] = Math.min(def.prices.length, integer(value.upgrades?.[def.id]))
  for (const key of STOCK_KEYS) state.stock[key] = integer(value.stock?.[key], state.stock[key])
  for (const key of ['bread', 'pickles', 'sauce'] as const) if (nonNegative(value.restocking?.[key]) > 0) state.restocking[key] = nonNegative(value.restocking?.[key])
  for (const key of ['fryer', 'soda', 'juice', 'grill'] as const) state[key] = normalizeMachine(value[key])
  state.trays = Array.from({ length: 3 }, (_, index) => normalizeTray(value.trays?.[index]))
  state.selectedTray = Math.min(trayCount(state) - 1, integer(value.selectedTray))
  const grillTray = value.grillTray
  state.grillTray = typeof grillTray === 'number' && Number.isInteger(grillTray) && grillTray >= 0 && grillTray < trayCount(state) ? grillTray : null
  if (state.grillTray === null) state.grill = emptyMachine()
  state.customers = Array.isArray(value.customers) ? value.customers.filter((cat) => cat && Number.isSafeInteger(cat.id) && cat.order && Array.isArray(cat.order.ingredients)).slice(0, seatCount(state)).map((cat) => ({
    ...cat, name: typeof cat.name === 'string' ? cat.name : '小猫', appearance: integer(cat.appearance) % 6,
    kind: cat.kind === 'thief' || cat.kind === 'beggar' ? cat.kind : 'normal',
    status: cat.status === 'payment' || cat.status === 'remind' ? cat.status : 'waiting',
    order: { ingredients: cat.order.ingredients.filter((id) => WRAP_KEYS.includes(id)), grilled: Boolean(cat.order.grilled), fries: Boolean(cat.order.fries), drink: cat.order.drink === 'soda' || cat.order.drink === 'juice' ? cat.order.drink : null },
    patience: nonNegative(cat.patience), maxPatience: Math.max(1, nonNegative(cat.maxPatience, 60)), payment: integer(cat.payment), tips: integer(cat.tips), taps: integer(cat.taps), stolen: integer(cat.stolen), hasStolen: Boolean(cat.hasStolen), sweetUsed: Boolean(cat.sweetUsed)
  })) : []
  state.serial = Math.max(state.serial, ...state.customers.map((cat) => cat.id))
  state.selectedCustomer = state.customers.some((cat) => cat.id === value.selectedCustomer) ? value.selectedCustomer! : state.customers.find((cat) => cat.kind !== 'thief' && cat.status === 'waiting')?.id ?? null
  for (const key of Object.keys(state.stats) as (keyof RestaurantStats)[]) state.stats[key] = integer(value.stats?.[key])
  if (value.lastReport && typeof value.lastReport === 'object') {
    const report = { ...emptyStats(), day: 1, goal: 3, bonus: 0 }
    for (const key of Object.keys(report) as (keyof RestaurantReport)[]) report[key] = integer(value.lastReport[key], report[key])
    state.lastReport = report
  }
  return state
}

function newCustomer(state: RestaurantState): RestaurantCustomer {
  const roll = Math.random()
  const kind = state.day >= 3 && roll < .07 ? 'thief' : state.day >= 2 && roll < .16 ? 'beggar' : 'normal'
  const ingredients: WrapIngredient[] = ['meat', 'fries', 'pickles', 'sauce']
  if (state.day >= 3 && Math.random() < .45) ingredients.splice(1 + Math.floor(Math.random() * 3), 1)
  if (kind === 'beggar') ingredients.splice(1)
  const patience = Math.max(40, 75 - state.day * 1.5) + state.upgrades.decor * 10
  const names = ['团子', '橘宝', '小芝麻', '奶盖', '煤球', '桃桃']
  const appearance = Math.floor(Math.random() * names.length)
  state.serial += 1
  return {
    id: state.serial, name: kind === 'thief' ? '蒙面捣蛋猫' : kind === 'beggar' ? '迷糊流浪猫' : names[appearance], appearance, kind, status: 'waiting',
    order: { ingredients, grilled: state.upgrades.grill > 0 && kind === 'normal' && Math.random() < .4, fries: state.day >= 2 && kind === 'normal' && Math.random() < .3,
      drink: state.upgrades.drinks > 0 && kind === 'normal' && Math.random() < .55 ? state.upgrades.drinks >= 2 && Math.random() < .4 ? 'juice' : 'soda' : null },
    patience: kind === 'thief' ? 18 : patience, maxPatience: kind === 'thief' ? 18 : patience, payment: 0, tips: 0, taps: 0, stolen: 0, hasStolen: false, sweetUsed: false
  }
}

export interface RestaurantResult { restaurant: RestaurantState; coins: number; message?: string; sound?: 'tap' | 'cash' | 'ding' | 'wrong' }

export function restaurantAction(previous: RestaurantState, balance: number, action: RestaurantAction): RestaurantResult {
  const unchanged = (message?: string): RestaurantResult => ({ restaurant: previous, coins: balance, message, ...(message ? { sound: 'wrong' as const } : {}) })
  if (action.type === 'tick' && (!isRestaurantServing(previous) || previous.paused)) return unchanged()
  const state = structuredClone(previous)
  let coins = balance
  let message: string | undefined
  let sound: RestaurantResult['sound'] = 'tap'
  const removeCustomer = (id: number) => {
    state.customers = state.customers.filter((cat) => cat.id !== id)
    if (state.selectedCustomer === id) state.selectedCustomer = state.customers.find((cat) => cat.status === 'waiting' && cat.kind !== 'thief')?.id ?? null
  }
  const collect = (cat: RestaurantCustomer) => {
    coins += cat.payment
    state.stats.earned += cat.payment
    state.stats.tips += cat.tips
    state.lifetimeRevenue += cat.payment
    removeCustomer(cat.id)
  }
  const finish = () => {
    for (const cat of [...state.customers]) if (cat.status === 'payment') collect(cat)
    state.stats.lost += state.customers.filter((cat) => cat.kind !== 'thief' && cat.status === 'waiting').length
    state.customers = []
    state.selectedCustomer = null
    const goal = dailyGoal(state.day)
    const bonus = state.stats.served >= goal ? 20 : 0
    coins += bonus
    state.lifetimeRevenue += bonus
    state.completedDays += 1
    state.lastReport = { ...state.stats, day: state.day, goal, bonus }
    state.phase = 'summary'
    state.paused = false
    message = bonus ? '打烊啦！今日目标完成，额外获得 20 金币。' : '辛苦啦，今天的收入已经存入金币余额。'
    sound = 'cash'
  }
  const tray = state.trays[state.selectedTray]
  if (action.type === 'upgrade') {
    if (isRestaurantServing(state)) return unchanged('先结束本轮营业，再升级设备。')
    const def = UPGRADE_DEFS.find((item) => item.id === action.id)
    if (!def) return unchanged()
    const level = state.upgrades[action.id]
    const price = def.prices[level]
    if (price === undefined) return unchanged('这件设备已经升满啦。')
    if (nextOpeningDay(state) < def.days[level]) return unchanged(`第 ${def.days[level]} 天开放这项升级。`)
    if (coins < price) return unchanged('金币不足，先经营几轮攒一攒吧。')
    coins -= price
    state.upgradeSpent += price
    state.upgrades[action.id] += 1
    message = `${def.name}升级成功！${def.effects[level]}。`
    sound = 'ding'
  } else if (action.type === 'start') {
    if (isRestaurantServing(state)) return unchanged()
    const fresh = createRestaurantState()
    if (state.phase === 'summary') state.day += 1
    Object.assign(state, { phase: 'open', paused: false, elapsed: 0, closingElapsed: 0, arrivalIn: 4, stats: emptyStats(), stock: fresh.stock, restocking: {}, meatCuts: 0, potatoCuts: 0, rawFries: 0,
      fryer: emptyMachine(), soda: emptyMachine(), juice: emptyMachine(), grill: emptyMachine(), grillTray: null, trays: fresh.trays, selectedTray: 0, customers: [], sweets: state.upgrades.sweets ? 3 : 0, helperIn: 12 })
    const cat = newCustomer(state)
    // The first customer is always ordinary; the opening order is simple to learn.
    cat.kind = 'normal'; cat.name = '团子'; cat.order = { ingredients: ['meat', 'fries', 'pickles', 'sauce'], grilled: false, fries: false, drink: null }
    cat.patience = Math.max(90, cat.patience); cat.maxPatience = cat.patience
    state.customers.push(cat)
    state.selectedCustomer = cat.id
    message = '开门营业！先切肉、炸薯条，再在备餐盘上组装卷饼。'
    sound = 'ding'
  } else if (action.type === 'pause') {
    if (!isRestaurantServing(state)) return unchanged()
    state.paused = !state.paused
    message = state.paused ? '已暂停，顾客和机器都会等你。' : '继续营业啦！'
  } else {
    if (!isRestaurantServing(state)) return unchanged('点击“开门营业”，开始新一天。')
    if (state.paused) return unchanged('先继续营业，再操作餐台。')
    if (action.type === 'tick') {
      const dt = Math.min(1, nonNegative(action.seconds))
      if (dt === 0) return unchanged()
      sound = undefined
      if (state.phase === 'open') state.elapsed = Math.min(SERVICE_SECONDS, state.elapsed + dt)
      else state.closingElapsed += dt
      for (const item of ['bread', 'pickles', 'sauce'] as const) {
        if (state.restocking[item] === undefined) continue
        state.restocking[item] = Math.max(0, state.restocking[item]! - dt)
        if (!state.restocking[item]) { state.stock[item] = item === 'bread' ? 12 : 10; delete state.restocking[item] }
      }
      for (const machine of [state.fryer, state.soda, state.juice, state.grill]) {
        if (machine.stage === 'working') {
          machine.remaining = Math.max(0, machine.remaining - dt)
          if (!machine.remaining) { machine.stage = 'ready'; machine.age = 0; sound = 'ding' }
        } else if (machine.stage === 'ready') machine.age += dt
      }
      if (state.fryer.stage === 'ready' && state.upgrades.fryer >= 2) { state.stock.fries += fryBatch(state); state.fryer = emptyMachine() }
      if (state.fryer.stage === 'ready' && state.fryer.age >= 10) { state.fryer.stage = 'burnt'; state.stats.wasted += 1; message = '薯条炸焦啦，点击炸锅清理。' }
      if (state.grill.stage === 'ready' && state.grill.age >= (state.upgrades.grill >= 2 ? 18 : 10)) {
        state.grill.stage = 'burnt'
        if (state.grillTray !== null) state.trays[state.grillTray].stage = 'burnt'
        state.stats.wasted += 1
        message = '卷饼烤焦啦，清理烤饼机后再做一份。'
      }
      if (state.upgrades.helper > 0) {
        state.helperIn -= dt
        if (state.helperIn <= 0) {
          state.helperIn = 12
          for (const item of ['bread', 'pickles', 'sauce'] as const) if (state.stock[item] <= 3 && !state.restocking[item]) state.restocking[item] = 5
          if (state.upgrades.helper >= 2 && state.stock.meat <= 4) state.stock.meat += 3 + state.upgrades.knife + (state.upgrades.knife === 3 ? 1 : 0)
          if (state.upgrades.helper >= 3 && state.stock.fries <= 4) {
            if (state.fryer.stage === 'ready') { state.stock.fries += fryBatch(state); state.fryer = emptyMachine() }
            if (state.fryer.stage === 'idle' || state.fryer.stage === 'burnt') { state.potatoCuts = 0; state.fryer = { stage: 'working', remaining: frySeconds(state), age: 0 } }
          }
        }
      }
      for (const cat of [...state.customers]) {
        if (cat.status === 'payment') { if (state.upgrades.cashier) collect(cat); continue }
        if (cat.status === 'remind') continue
        cat.patience = Math.max(0, cat.patience - dt)
        if (cat.kind === 'thief' && !cat.hasStolen && cat.patience <= 12) {
          cat.stolen = Math.min(15, coins)
          cat.hasStolen = true
          coins -= cat.stolen
          state.stats.stolen += cat.stolen
          message = cat.stolen ? `捣蛋猫拿走了 ${cat.stolen} 金币，快点它三次追回来！` : '捣蛋猫在柜台探头探脑，快点它三次赶走！'
        }
        if (cat.patience === 0) {
          if (cat.kind !== 'thief') state.stats.lost += 1
          removeCustomer(cat.id)
        }
      }
      if (state.phase === 'open') {
        if (state.elapsed >= SERVICE_SECONDS) { state.phase = 'closing'; message = '停止迎客啦，还有 40 秒为店内顾客出餐。' }
        else {
          state.arrivalIn -= dt
          if (state.arrivalIn <= 0 && state.customers.length < seatCount(state)) {
            const cat = newCustomer(state)
            state.customers.push(cat)
            if (state.selectedCustomer === null && cat.kind !== 'thief') state.selectedCustomer = cat.id
            state.arrivalIn = Math.max(5, 12 - state.day * .4) + Math.random() * 4
          }
        }
      }
      if (state.phase === 'closing' && (state.customers.length === 0 || state.closingElapsed >= 40)) finish()
    } else if (action.type === 'end') {
      finish()
    } else if (action.type === 'select-tray') {
      if (action.index < 0 || action.index >= trayCount(state)) return unchanged()
      state.selectedTray = action.index
      sound = undefined
    } else if (action.type === 'select-customer') {
      if (!state.customers.some((cat) => cat.id === action.id && cat.kind !== 'thief' && cat.status === 'waiting')) return unchanged()
      state.selectedCustomer = action.id
      sound = undefined
    } else if (action.type === 'slice-meat') {
      if (state.stock.meat >= 24) return unchanged('烤肉够用啦，先出餐吧。')
      state.meatCuts += 1
      if (state.meatCuts >= meatClicks(state)) { state.meatCuts = 0; state.stock.meat += 3 + state.upgrades.knife + (state.upgrades.knife === 3 ? 1 : 0); message = '烤肉切好啦！点击配料区的烤肉加入饼皮。' }
    } else if (action.type === 'cut-potato') {
      if (state.rawFries >= 3) return unchanged('已经有 3 批生薯条啦，先下锅。')
      state.potatoCuts += 1
      if (state.potatoCuts >= 3) { state.potatoCuts = 0; state.rawFries += 1; message = '土豆切好了，可以放进炸锅。' }
    } else if (action.type === 'fry') {
      if (state.fryer.stage !== 'idle') return unchanged('先收取或清理上一锅薯条。')
      if (state.rawFries < 1) return unchanged('先点击土豆三次，切好一批生薯条。')
      state.rawFries -= 1; state.fryer = { stage: 'working', remaining: frySeconds(state), age: 0 }
    } else if (action.type === 'collect-fries') {
      if (state.fryer.stage !== 'ready' && state.fryer.stage !== 'burnt') return unchanged('薯条还没炸好。')
      if (state.fryer.stage === 'ready') { state.stock.fries += fryBatch(state); message = `收好了 ${fryBatch(state)} 份薯条。`; sound = 'ding' }
      else message = '炸锅清理好啦。'
      state.fryer = emptyMachine()
    } else if (action.type === 'restock') {
      if (state.restocking[action.item]) return unchanged('正在补货，稍等一下。')
      const capacity = action.item === 'bread' ? 12 : 10
      if (state.stock[action.item] >= capacity) return unchanged('这份配料还是满的。')
      state.restocking[action.item] = 8
      message = `正在补充${INGREDIENT_LABELS[action.item]}，8 秒后送到；现有库存仍可使用。`
    } else if (action.type === 'bread') {
      if (tray.stage !== 'empty') return unchanged('先出餐或清空当前备餐盘。')
      if (state.stock.bread < 1) return unchanged('饼皮用完啦，点击饼皮补货。')
      state.stock.bread -= 1; tray.stage = 'open'
    } else if (action.type === 'ingredient') {
      if (tray.stage !== 'open') return unchanged('先在当前备餐盘铺一张饼皮。')
      if (tray.ingredients.includes(action.ingredient)) return unchanged('这个配料已经放过啦。')
      if (state.stock[action.ingredient] < 1) return unchanged(`${INGREDIENT_LABELS[action.ingredient]}不够啦，先准备一些。`)
      state.stock[action.ingredient] -= 1; tray.ingredients.push(action.ingredient)
    } else if (action.type === 'wrap') {
      if (tray.stage !== 'open' || !tray.ingredients.includes('meat')) return unchanged('先铺饼皮，并放入烤肉和订单需要的配料。')
      tray.stage = 'wrapped'
    } else if (action.type === 'grill') {
      if (!state.upgrades.grill) return unchanged('先升级解锁烤饼机。')
      if (state.grill.stage !== 'idle') return unchanged('烤饼机正被占用。')
      if (tray.stage !== 'wrapped') return unchanged('先把当前卷饼卷好，再放进烤饼机。')
      tray.stage = 'grilling'; state.grillTray = state.selectedTray; state.grill = { stage: 'working', remaining: grillSeconds(state), age: 0 }
    } else if (action.type === 'collect-grill') {
      if (state.grillTray === null || (state.grill.stage !== 'ready' && state.grill.stage !== 'burnt')) return unchanged('卷饼还没烤好。')
      state.trays[state.grillTray].stage = state.grill.stage === 'ready' ? 'grilled' : 'burnt'
      state.selectedTray = state.grillTray; state.grillTray = null; state.grill = emptyMachine()
      message = state.trays[state.selectedTray].stage === 'burnt' ? '烤焦的卷饼请丢弃后重做。' : '烤卷饼出炉，可以出餐啦！'
    } else if (action.type === 'drink') {
      if (state.upgrades.drinks < (action.item === 'juice' ? 2 : 1)) return unchanged('先升级饮料台解锁。')
      const machine = state[action.item]
      if (machine.stage === 'ready') { state.stock[action.item] += 1; state[action.item] = emptyMachine(); message = `一杯${INGREDIENT_LABELS[action.item]}做好啦。` }
      else if (machine.stage === 'idle') {
        if (state.stock[action.item] >= 6) return unchanged('先用掉备好的饮料吧。')
        state[action.item] = { stage: 'working', remaining: drinkSeconds(state), age: 0 }
      } else return unchanged('饮料正在装杯。')
    } else if (action.type === 'side') {
      if (action.item === 'fries' && tray.fries || action.item !== 'fries' && tray.drink) return unchanged('当前备餐盘已经有这份小食或饮料啦。')
      if (state.stock[action.item] < 1) return unchanged(`先准备好${INGREDIENT_LABELS[action.item]}。`)
      state.stock[action.item] -= 1
      if (action.item === 'fries') tray.fries = true
      else tray.drink = action.item
    } else if (action.type === 'trash') {
      if (state.grillTray === state.selectedTray) return unchanged('先从烤饼机取回卷饼。')
      if (tray.stage === 'empty' && !tray.fries && !tray.drink) return unchanged()
      if (tray.stage !== 'burnt') state.stats.wasted += 1
      state.trays[state.selectedTray] = emptyTray()
      message = '备餐盘已清空，重新做一份吧。'
    } else if (action.type === 'serve') {
      const cat = state.customers.find((item) => item.id === state.selectedCustomer && item.status === 'waiting' && item.kind !== 'thief')
      if (!cat) return unchanged('先点击一位等餐的小猫。')
      if (tray.stage !== 'wrapped' && tray.stage !== 'grilled') return unchanged('先把卷饼卷好；烤饼订单需要烤好并取出。')
      const order = cat.order
      if (tray.ingredients.length !== order.ingredients.length || order.ingredients.some((id) => !tray.ingredients.includes(id))) return unchanged('配料和订单不一样，查看顾客气泡再做一份。')
      if ((tray.stage === 'grilled') !== order.grilled || tray.fries !== order.fries || tray.drink !== order.drink) return unchanged('检查是否需要烤饼、额外薯条和指定饮料。')
      cat.tips = (cat.patience / cat.maxPatience > .5 ? 2 : 0) + state.upgrades.decor
      cat.payment = 8 + order.ingredients.length + Number(order.grilled) * 4 + Number(order.fries) * 4 + (order.drink ? order.drink === 'juice' ? 6 : 4 : 0) + cat.tips
      cat.status = cat.kind === 'beggar' ? 'remind' : 'payment'
      state.stats.served += 1; state.lifetimeServed += 1
      state.trays[state.selectedTray] = emptyTray()
      state.selectedCustomer = state.customers.find((item) => item.id !== cat.id && item.kind !== 'thief' && item.status === 'waiting')?.id ?? null
      message = cat.kind === 'beggar' ? '迷糊猫忘记付钱啦，点它三次提醒一下。' : '出餐成功！点击顾客留下的金币收钱。'
      sound = 'ding'
      if (state.upgrades.cashier && cat.status === 'payment') { collect(cat); sound = 'cash' }
    } else if (action.type === 'collect-money') {
      const cat = state.customers.find((item) => item.id === action.id && item.status === 'payment')
      if (!cat) return unchanged()
      const amount = cat.payment
      collect(cat); message = `收到 ${amount} 金币，已经加入你的余额。`; sound = 'cash'
    } else if (action.type === 'special') {
      const cat = state.customers.find((item) => item.id === action.id && (item.kind === 'thief' || item.status === 'remind'))
      if (!cat) return unchanged()
      cat.taps += 1
      if (cat.taps >= 3) {
        if (cat.kind === 'thief') {
          coins += cat.stolen; state.stats.stolen = Math.max(0, state.stats.stolen - cat.stolen); state.stats.caught += 1
          removeCustomer(cat.id); message = cat.stolen ? `追回了 ${cat.stolen} 金币！` : '捣蛋猫被赶跑啦！'
        } else { cat.status = 'payment'; message = '迷糊猫想起来啦，点击金币收款。' }
        sound = 'cash'
      } else message = `再点 ${3 - cat.taps} 次${cat.kind === 'thief' ? '赶走捣蛋猫' : '提醒迷糊猫结账'}。`
    } else if (action.type === 'sweet') {
      const cat = state.customers.find((item) => item.id === state.selectedCustomer && item.kind !== 'thief' && item.status === 'waiting')
      if (!cat || cat.sweetUsed || state.sweets < 1) return unchanged('选中一位还没吃过小饼干的等餐顾客，并确认饼干有剩余。')
      state.sweets -= 1; cat.sweetUsed = true; cat.patience = Math.min(cat.maxPatience, cat.patience + 20); message = '小猫吃到饼干，愿意多等一会儿。'
    }
  }
  return { restaurant: state, coins, message, sound }
}
