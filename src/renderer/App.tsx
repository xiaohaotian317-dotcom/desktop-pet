import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CompostState, CropId, DailyTaskKind, DesktopInfo, Dropping, FertilizerPotState, IngredientId, OrderBoardState, OrderRequirement, OutfitId, PetAction, PetId, PetState, PersistedState, RecipeId } from '../shared/types'
import { advanceDailyTaskBoard, createDailyTaskBoard } from '../shared/dailyTasks'
import { PetCharacter, type PetVisualStyle } from './PetCharacter'
import ActivityPages from './ActivityPages'
import { OutfitStorePage, WardrobePage } from './WardrobePages'
import { CROPS, INITIAL_AFFECTION, INITIAL_INGREDIENTS, INITIAL_PANTRY, RECIPES, affectionProgress, createOrderBoard, cropGrowth, emptyPlot, localDayKey, orderRequirementStock, unlockedPlotCount } from './activities'
import { createCosmeticState } from './cosmetics'
import { OUTFITS, createWardrobeState, outfitById, refreshOutfitShop, unlockAchievementOutfits } from './outfits'
import { isCookingPotUnlocked } from '../shared/kitchenProgression'
import { redeemGiftCode } from '../shared/rewards'
import SettingsPage from './SettingsPage'
import { restoreSavedState } from './savedState'

const PET_WIDTH = 150
const PET_HEIGHT = 183
const EMPTY_COOKING_POT = { recipeId: null, startedAt: 0, doneAt: 0 }
const EMPTY_COMPOST_POT: FertilizerPotState = { startedAt: 0, doneAt: 0 }
const INITIAL_COMPOST: CompostState = { poopCount: 0, rainbowPoopCount: 0, fertilizerCount: 0, pots: Array.from({ length: 5 }, () => ({ ...EMPTY_COMPOST_POT })), unlockedPots: 2, ordinarySinceRainbow: 0, nextRainbowAt: 50 + Math.floor(Math.random() * 51) }
const INTERACTION_COOLDOWN_MS = 600_000
const POOP_INTERVAL_MS = 180_000
const IS_TEST_BUILD = __DAKUAN_TEST_BUILD__
type CatEvent = { id: string; title: string; description: string; reward: string; actionLabel?: string; page?: 2 | 3 | 5; coins?: number; affection?: number; mood?: number }
const CAT_EVENTS: Omit<CatEvent, 'id'>[] = [
  { title: '发现了蝴蝶', description: '大款追着蝴蝶跑了一小圈。', reward: '心情 +15', mood: 15 },
  { title: '玩具球滚过来啦', description: '大款邀请你陪它玩一会儿。', reward: '亲密度 +3 · 心情 +8', affection: 3, mood: 8 },
  { title: '捡到小鱼干', description: '大款在角落发现了一枚小鱼干纪念币。', reward: '金币 +25', coins: 25 },
  { title: '找到暖和的太阳位', description: '大款在阳光下舒服地打了个滚。', reward: '心情 +10 · 金币 +10', mood: 10, coins: 10 }
]
const INITIAL: PersistedState = {
  pets: {
    dakuan: { hunger: 80, mood: 80, cleanliness: 80, x: 340, y: 500, lastUpdated: Date.now(), lastBathAt: 0, bathDate: localDayKey(Date.now()), bathsToday: 0, lastAffectionAt: 0, starvingSince: 0, hungerPenaltyHours: 0, weightTenthsJin: '10', lastPoopAt: Date.now() }
  }, paused: false, soundMuted: false, soundVolume: 100, redeemedCodes: [],
  schemaVersion: 12,
  affection: structuredClone(INITIAL_AFFECTION),
  kitchen: { ingredients: structuredClone(INITIAL_INGREDIENTS), pantry: structuredClone(INITIAL_PANTRY), pots: Array.from({ length: 6 }, () => ({ ...EMPTY_COOKING_POT })), lastIngredients: null },
  garden: { plots: Array.from({ length: 10 }, () => emptyPlot()) },
  droppings: [], compost: structuredClone(INITIAL_COMPOST), coins: 0, orders: createOrderBoard(Date.now()), constipationMode: false,
  cosmetics: createCosmeticState(Date.now()), wardrobe: createWardrobeState(Date.now(), IS_TEST_BUILD), alwaysOnTop: true
}

const LABELS: Record<PetId, string> = { dakuan: '大款' }
const ACTION_LABEL: Record<PetAction, string> = { idle: '发呆', walk: '走路中', run: '跑起来啦', eat: '正在吃饭', can: '正在吃猫罐头', play: '玩得正开心', bath: '洗香香', pet: '享受摸摸', sun: '晒太阳中', together: '一起玩耍', wag: '摇摇尾巴', bark: '喵喵叫', sleep: '睡得香香', groom: '舔舔毛', facewash: '洗洗脸', stretch: '伸个懒腰', sunSleep: '太阳下打盹', hungry: '饿鼠了', sad: '心情低落', dirty: '该洗澡啦', ball: '追着球玩', pounce: '扑玩具', excited: '开心摇尾巴' }

function clamp(value: number, low = 0, high = 100) { return Math.min(high, Math.max(low, value)) }
function recordDailyProgress(orders: OrderBoardState, kind: DailyTaskKind, amount = 1, now = Date.now()): OrderBoardState {
  return { ...orders, dailyTasks: advanceDailyTaskBoard(orders.dailyTasks, kind, amount, now) }
}
const ONE_TON_TENTHS_JIN = 20_000n
function weightValue(value: string | undefined) {
  return typeof value === 'string' && /^\d+$/u.test(value) ? BigInt(value) : 10n
}
function formatWeight(value: bigint) {
  if (value < ONE_TON_TENTHS_JIN) {
    const whole = value / 10n
    const fraction = value % 10n
    return `${whole.toLocaleString('zh-CN')}${fraction ? `.${fraction}` : ''} 斤`
  }
  const digits = value.toString()
  if (digits.length > 18) {
    const exponent = digits.length - 2
    const leading = digits.slice(0, 3).replace(/0+$/u, '')
    return `约 ${leading[0]}${leading.length > 1 ? `.${leading.slice(1)}` : ''}×10^${exponent} 斤`
  }
  const whole = value / ONE_TON_TENTHS_JIN
  const fraction = value % ONE_TON_TENTHS_JIN / 2_000n
  return `${whole.toLocaleString('zh-CN')}${fraction ? `.${fraction}` : ''} 吨`
}
function addMealWeight(value: string | undefined) {
  const current = weightValue(value)
  const gain = current / 5n > 5n ? current / 5n : 5n
  return { weightTenthsJin: (current + gain).toString(), gain }
}
function updateSatiety(pet: PetState, value: number, now: number, previousSatiety = pet.hunger): PetState {
  const hunger = clamp(value)
  if (hunger > 0) return { ...pet, hunger, starvingSince: 0, hungerPenaltyHours: 0 }
  return {
    ...pet,
    hunger,
    starvingSince: previousSatiety > 0 ? now : pet.starvingSince || now,
    hungerPenaltyHours: previousSatiety > 0 ? 0 : pet.hungerPenaltyHours || 0
  }
}
function decayPet(pet: PetState, now: number, droppingsCount = 0): PetState {
  const lastUpdated = Number.isFinite(pet.lastUpdated) ? pet.lastUpdated : now
  const elapsedMs = Math.max(0, now - lastUpdated)
  const hunger = clamp(pet.hunger - elapsedMs / 240_000)
  const next = {
    ...pet,
    hunger,
    mood: clamp(pet.mood - elapsedMs / 360_000),
    cleanliness: clamp(pet.cleanliness - elapsedMs * (droppingsCount > 10 ? 10 : 1) / 300_000),
    lastUpdated: now
  }
  return hunger > 0 ? { ...next, starvingSince: 0, hungerPenaltyHours: 0 } : {
    ...next,
    starvingSince: pet.hunger > 0 ? lastUpdated + pet.hunger * 240_000 : pet.starvingSince || lastUpdated,
    hungerPenaltyHours: pet.hunger > 0 ? 0 : pet.hungerPenaltyHours || 0
  }
}
function shortWait(milliseconds: number) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000))
  return minutes >= 60 ? `${Math.floor(minutes / 60)}小时${minutes % 60 ? `${minutes % 60}分钟` : ''}` : `${minutes}分钟`
}
function lowestNeed(pet: PetState) {
  const needs: { value: number; action: PetAction; label: string }[] = [
    { value: pet.mood, action: 'sad' as const, label: '心情不好' },
    { value: pet.cleanliness, action: 'dirty' as const, label: '有点脏' }
  ].filter((need) => need.value <= 25)
  if (pet.hunger < 50) needs.push({ value: pet.hunger, action: 'hungry', label: pet.hunger <= 0 ? '饿鼠了' : pet.hunger < 20 ? '很饿了' : '有点饿了' })
  return needs.sort((a, b) => a.value - b.value)[0]
}
function allNeedsZero(pet: PetState) {
  return pet.hunger === 0 && pet.mood === 0 && pet.cleanliness === 0
}
function chooseTarget(pet: PetState, info: DesktopInfo) {
  const area = info.displays.find((display) => pet.x + PET_WIDTH / 2 >= display.x && pet.x <= display.x + display.width && pet.y + PET_HEIGHT / 2 >= display.y && pet.y <= display.y + display.height) ?? info.displays[0]
  if (!area) return { x: pet.x, y: pet.y }
  const left = area.x
  const right = Math.max(left, area.x + area.width - PET_WIDTH)
  const span = right - left
  let x: number
  if (pet.x <= left + 20) x = left + span * (0.3 + Math.random() * 0.45)
  else if (pet.x >= right - 20) x = left + span * Math.random() * 0.7
  else x = left + span * Math.random()
  const top = area.y
  const bottom = Math.max(top, area.y + area.height - PET_HEIGHT - 8)
  const y = top + Math.random() * (bottom - top)
  return { x, y }
}
function clampPet(pet: PetState, info: DesktopInfo): PetState {
  const area = info.displays.find((display) => pet.x >= display.x - PET_WIDTH && pet.x <= display.x + display.width && pet.y >= display.y - PET_HEIGHT && pet.y <= display.y + display.height) ?? info.displays[0]
  if (!area) return pet
  return { ...pet, x: clamp(pet.x, area.x, area.x + area.width - PET_WIDTH), y: clamp(pet.y, area.y, area.y + area.height - PET_HEIGHT - 12) }
}

function StatBar({ label, value, reverse = false }: { label: string; value: number; reverse?: boolean }) {
  const quality = reverse ? value : 100 - value
  const tone = quality < 25 ? 'urgent' : quality < 50 ? 'watch' : 'good'
  return <div className="stat-row"><div className="stat-heading"><span>{label}</span><strong>{Math.round(value)}<small>/100</small></strong></div><div className="stat-track"><div className={`stat-fill ${tone}`} style={{ width: `${value}%` }} /></div></div>
}

function PoopMark({ rainbow = false }: { rainbow?: boolean }) {
  return <svg viewBox="0 0 36 36" aria-hidden="true" className="poop-mark">
    {rainbow && <defs><linearGradient id="rainbow-poop-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#69c9ef"/><stop offset="25%" stopColor="#8bd56f"/><stop offset="50%" stopColor="#ffda64"/><stop offset="75%" stopColor="#ff9b77"/><stop offset="100%" stopColor="#d58bed"/></linearGradient></defs>}
    <ellipse cx="18" cy="30" rx="14" ry="4" fill="#5a392b" opacity=".18" />
    <path d="M7 27c0-4 3-7 7-7-2-2-1-6 3-7-1-4 2-7 5-6 4 1 4 5 2 7 5 0 7 5 4 9 3 1 4 4 3 7H10c-2 0-3-1-3-3Z" fill={rainbow ? 'url(#rainbow-poop-fill)' : '#9b6344'} stroke={rainbow ? '#9567a0' : '#75452f'} strokeWidth="1.5" />
    <path d="M15 22c2 1 5 1 7 0" fill="none" stroke="#c78a62" strokeWidth="2" strokeLinecap="round" />
    <circle cx="14" cy="26" r="1.4" fill="#30211d" /><circle cx="23" cy="26" r="1.4" fill="#30211d" />
    <path d="M17 29q1.5 1.5 3 0" fill="none" stroke="#30211d" strokeWidth="1" strokeLinecap="round" />
    <path d="M13 19c2-2 5-2 7-1" fill="none" stroke="#d19a73" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
}

function playYip(volume: number) {
  const amplitude = Math.max(0, Math.min(100, volume)) / 100
  if (amplitude === 0) return
  try {
    const AudioContextClass = window.AudioContext
    const audio = new AudioContextClass()
    const start = audio.currentTime
    ;[0, 0.24].forEach((offset, index) => {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(index ? 600 : 700, start + offset)
      osc.frequency.exponentialRampToValueAtTime(index ? 920 : 1050, start + offset + 0.09)
      osc.frequency.exponentialRampToValueAtTime(index ? 650 : 720, start + offset + 0.22)
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.12 * amplitude, start + offset + 0.035)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.23)
      osc.connect(gain); gain.connect(audio.destination)
      osc.start(start + offset); osc.stop(start + offset + 0.24)
    })
    window.setTimeout(() => void audio.close(), 700)
  } catch { /* Audio can be unavailable in a restricted device session. */ }
}

export default function App() {
  const [data, setData] = useState<PersistedState>(INITIAL)
  const [desktop, setDesktop] = useState<DesktopInfo>({ origin: { x: 0, y: 0 }, width: window.innerWidth, height: window.innerHeight, displays: [{ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }] })
  const [selected, setSelected] = useState<PetId | null>(null)
  const [panelPage, setPanelPage] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1)
  const [clock, setClock] = useState(Date.now())
  const [visualStyle] = useState<PetVisualStyle>(() => localStorage.getItem('petVisualStyle') === 'illustrated' ? 'illustrated' : 'pixel')
  const [facingLeft, setFacingLeft] = useState<Record<PetId, boolean>>({ dakuan: false })
  const facingLeftRef = useRef(facingLeft)
  facingLeftRef.current = facingLeft
  const [actions, setActions] = useState<Record<PetId, PetAction>>({ dakuan: 'idle' })
  const [thoughts, setThoughts] = useState<Partial<Record<PetId, string>>>({})
  const [catEvent, setCatEvent] = useState<CatEvent | null>(null)
  const catEventRef = useRef(catEvent)
  catEventRef.current = catEvent
  const catEventScheduleRef = useRef<number | null>(null)
  const catEventExpireRef = useRef<number | null>(null)
  const scheduleCatEventRef = useRef<(delay: number) => void>(() => {})
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)
  const readyRef = useRef(false)
  readyRef.current = ready
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const dataRef = useRef(data)
  const actionTimers = useRef<Partial<Record<PetId, number>>>({})
  const idleActionHistory = useRef<Record<PetId, PetAction[]>>({ dakuan: [] })
  const targetRef = useRef<Record<PetId, { x: number; y: number }>>({ dakuan: { x: 0, y: 0 } })
  const idleUntilRef = useRef<Record<PetId, number>>({ dakuan: 0 })
  const dragRef = useRef<{ id: PetId; pointerId: number; startX: number; startY: number; petX: number; petY: number; moved: boolean } | null>(null)
  const panelDragRef = useRef<{ pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)
  const hoverRef = useRef<number | null>(null)
  const pointerActiveRef = useRef(false)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const suppressClickRef = useRef(false)

  const commit = useCallback((next: PersistedState, save = true) => {
    const wardrobe = unlockAchievementOutfits(next.wardrobe, affectionProgress(next.affection.dakuan).level, weightValue(next.pets.dakuan.weightTenthsJin), IS_TEST_BUILD)
    const resolved = wardrobe === next.wardrobe ? next : { ...next, wardrobe }
    const newlyUnlocked = wardrobe.owned.filter((id) => !next.wardrobe.owned.includes(id))
    dataRef.current = resolved
    setData(resolved)
    if (save) window.desktopPets.saveState(resolved)
    if (newlyUnlocked.length) {
      const names = newlyUnlocked.map((id) => outfitById(id)?.name).filter(Boolean).join('、')
      setThoughts((current) => ({ ...current, dakuan: `新服装解锁：${names}！去穿搭仓库看看吧。` }))
      window.setTimeout(() => setThoughts((current) => ({ ...current, dakuan: undefined })), 3200)
    }
  }, [])

  const quitPet = () => {
    // IPC messages are handled in order; the main process writes synchronously
    // before handling app:quit, including the latest in-memory movement state.
    if (readyRef.current) window.desktopPets.saveState(dataRef.current)
    window.desktopPets.quit()
  }

  useEffect(() => {
    let mounted = true
    Promise.all([window.desktopPets.loadState(), window.desktopPets.getDesktopInfo()]).then(([saved, info]) => {
      if (!mounted) return
      setDesktop(info)
      const restored = restoreSavedState(saved, INITIAL, IS_TEST_BUILD)
      const loadedAt = Date.now()
      const savedPet = restored.pets.dakuan
      if (restored.paused) {
        const pausedMs = Math.max(0, loadedAt - savedPet.lastUpdated)
        restored.pets.dakuan = { ...savedPet, lastUpdated: loadedAt, lastPoopAt: savedPet.lastPoopAt + pausedMs, starvingSince: savedPet.hunger === 0 && savedPet.starvingSince ? savedPet.starvingSince + pausedMs : savedPet.starvingSince }
      } else {
        const decayed = decayPet(savedPet, loadedAt, restored.droppings.length)
        const hoursStarving = decayed.hunger === 0 && decayed.starvingSince ? Math.floor(Math.max(0, loadedAt - decayed.starvingSince) / 3_600_000) : 0
        const penalty = Math.max(0, hoursStarving - decayed.hungerPenaltyHours)
        decayed.hungerPenaltyHours += penalty
        restored.pets.dakuan = decayed
        if (penalty) restored.affection.dakuan = Math.max(0, restored.affection.dakuan - penalty)
      }
      restored.pets.dakuan = clampPet(restored.pets.dakuan, info)
      dataRef.current = restored
      setData(restored)
      window.desktopPets.saveState(restored)
      targetRef.current = { dakuan: { x: restored.pets.dakuan.x, y: restored.pets.dakuan.y } }
      setReady(true)
    }).catch((error) => { console.error('桌宠初始化失败', error); setReady(true) })
    const onDesktop = (event: Event) => {
      const info = (event as CustomEvent<DesktopInfo>).detail
      if (info) {
        setDesktop(info)
        const current = dataRef.current
        const next = { ...current, pets: { dakuan: clampPet(current.pets.dakuan, info) } }
        commit(next)
      }
    }
    const onState = (event: Event) => {
      const next = (event as CustomEvent<PersistedState>).detail
      if (next) { dataRef.current = next; setData(next) }
    }
    window.desktopPets && window.addEventListener('pet-state-changed', onState)
    // The isolated preload forwards display changes on this custom event.
    window.addEventListener('desktop-info-changed', onDesktop as EventListener)
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') quitPet() }
    const onGlobalPointerMove = (event: PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
      const hit = document.elementFromPoint(event.clientX, event.clientY)
      if (hit?.closest('.pet-button, .care-card, .dropping-button, .cosmetic-modal-layer, .cat-event-bubble')) pointerEnter()
      else pointerLeave()
    }
    const onPointerReleased = () => {
      pointerActiveRef.current = false
      if (hoverRef.current) window.clearTimeout(hoverRef.current)
      hoverRef.current = null
    }
    window.addEventListener('pointermove', onGlobalPointerMove, true)
    window.addEventListener('desktop-pointer-released', onPointerReleased)
    window.addEventListener('keydown', onEscape)
    return () => { mounted = false; window.removeEventListener('pet-state-changed', onState); window.removeEventListener('desktop-info-changed', onDesktop as EventListener); window.removeEventListener('pointermove', onGlobalPointerMove, true); window.removeEventListener('desktop-pointer-released', onPointerReleased); window.removeEventListener('keydown', onEscape) }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!ready) return
    let mounted = true
    const schedule = (delay: number) => {
      if (catEventScheduleRef.current !== null) window.clearTimeout(catEventScheduleRef.current)
      catEventScheduleRef.current = window.setTimeout(() => {
        catEventScheduleRef.current = null
        if (!mounted) return
        if (dataRef.current.paused || catEventRef.current) {
          schedule(2 * 60_000)
          return
        }
        const state = dataRef.current
        const now = Date.now()
        const contextualEvents: Omit<CatEvent, 'id'>[] = []
        if (state.kitchen.pots.some((pot) => pot.recipeId && pot.doneAt <= now)) contextualEvents.push({ title: '厨房飘来香味', description: '大款闻到锅里的香味啦，有餐点做好了，带它去粮柜看看吧。', reward: '心情 +5', actionLabel: '去厨房看看', page: 2, mood: 5 })
        if (state.garden.plots.some((plot) => plot.cropId && cropGrowth(plot.cropId, plot, now).ready)) contextualEvents.push({ title: '菜园有作物熟啦', description: '大款发现菜园里有作物成熟了，快一起去收获吧。', reward: '心情 +5', actionLabel: '去菜园看看', page: 3, mood: 5 })
        const readyOrder = state.orders.orders.some((order) => !order.claimed && order.requirements.every((requirement) => orderRequirementStock(requirement, state) >= requirement.amount))
        const readyDailyTask = state.orders.dailyTasks.tasks.some((task) => !task.claimed && task.progress >= task.target)
        if (readyOrder || readyDailyTask) contextualEvents.push({ title: '有奖励可以领取', description: '大款发现订单或每日任务已经完成，别忘了领取金币。', reward: '心情 +5', actionLabel: '去订单看看', page: 5, mood: 5 })
        const eventPool = contextualEvents.length && Math.random() < .75 ? contextualEvents : CAT_EVENTS
        const event = eventPool[Math.floor(Math.random() * eventPool.length)]
        setCatEvent({ ...event, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
        catEventExpireRef.current = window.setTimeout(() => {
          catEventExpireRef.current = null
          setCatEvent(null)
          schedule(15 * 60_000 + Math.random() * 10 * 60_000)
        }, 90_000)
      }, delay)
    }
    scheduleCatEventRef.current = schedule
    schedule(5 * 60_000 + Math.random() * 7 * 60_000)
    return () => {
      mounted = false
      if (catEventScheduleRef.current !== null) window.clearTimeout(catEventScheduleRef.current)
      if (catEventExpireRef.current !== null) window.clearTimeout(catEventExpireRef.current)
      catEventScheduleRef.current = null
      catEventExpireRef.current = null
      scheduleCatEventRef.current = () => {}
    }
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const now = Date.now()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    const timer = window.setTimeout(() => {
      const current = dataRef.current
      const refreshedAt = Date.now()
      if (current.orders.dailyTasks.date !== localDayKey(refreshedAt)) {
        commit({ ...current, orders: { ...current.orders, dailyTasks: createDailyTaskBoard(refreshedAt) } })
      }
    }, Math.max(1, midnight.getTime() - now))
    return () => window.clearTimeout(timer)
  }, [ready, data.orders.dailyTasks.date, commit])

  useEffect(() => {
    const tick = window.setInterval(() => {
      const current = dataRef.current
      const now = Date.now()
      const next = { ...current, pets: { ...current.pets }, droppings: [...current.droppings] }
      for (const id of ['dakuan'] as const) {
        const oldPet = current.pets[id]
        const elapsed = Math.max(0, now - oldPet.lastUpdated)
        const pet = current.paused
          ? { ...oldPet, lastUpdated: now, starvingSince: oldPet.hunger === 0 && oldPet.starvingSince ? oldPet.starvingSince + elapsed : oldPet.starvingSince }
          : decayPet(oldPet, now, current.droppings.length)
        const walking = !current.paused && selected !== id && ['walk', 'run'].includes(actionsRef.current[id]) && dragRef.current?.id !== id
        if (current.constipationMode) pet.lastPoopAt = now
        else if (now - pet.lastPoopAt >= POOP_INTERVAL_MS) {
          // Drop at the cat's trail while moving, or at its feet when stationary/paused.
          const compost = { ...next.compost }
          const rainbow = compost.ordinarySinceRainbow >= compost.nextRainbowAt
          const x = walking
            ? (facingLeftRef.current[id] ? pet.x + PET_WIDTH + 6 : pet.x - 34)
            : pet.x + PET_WIDTH / 2
          const y = walking ? pet.y + PET_HEIGHT - 4 : pet.y + PET_HEIGHT + 23
          next.droppings.push({ id: `${now}-${Math.random().toString(36).slice(2, 8)}`, x, y, createdAt: now, rainbow })
          if (rainbow) {
            compost.ordinarySinceRainbow = 0
            compost.nextRainbowAt = 50 + Math.floor(Math.random() * 51)
          } else compost.ordinarySinceRainbow += 1
          next.compost = compost
          pet.lastPoopAt = now
        }
        if (current.paused) {
          next.pets[id] = pet
          continue
        }
        const hoursStarving = pet.hunger === 0 && pet.starvingSince ? Math.floor(Math.max(0, now - pet.starvingSince) / 3_600_000) : 0
        const penalty = Math.max(0, hoursStarving - pet.hungerPenaltyHours)
        pet.hungerPenaltyHours += penalty
        if (penalty) next.affection = { ...next.affection, dakuan: Math.max(0, next.affection.dakuan - penalty) }
        next.pets[id] = pet
      }
      if (current.orders.nextRefreshAt <= now) next.orders = { ...createOrderBoard(now), dailyTasks: current.orders.dailyTasks }
      if (next.orders.dailyTasks.date !== localDayKey(now)) next.orders = { ...next.orders, dailyTasks: createDailyTaskBoard(now) }
      next.wardrobe = refreshOutfitShop(current.wardrobe, now)
      commit(next)
    }, 30_000)
    return () => window.clearInterval(tick)
  }, [commit, selected])

  useEffect(() => {
    if (!ready || data.paused) return
    const now = window.setInterval(() => {
      const current = dataRef.current
      const next = { ...current, pets: { ...current.pets } }
      for (const id of ['dakuan'] as const) {
        if (selected === id || !['idle', 'walk', 'run'].includes(actions[id]) || dragRef.current?.id === id) continue
        const pet = current.pets[id]
        const target = targetRef.current[id]
        const dx = target.x - pet.x; const dy = target.y - pet.y
        if (Math.hypot(dx, dy) < 10) {
          if (actions[id] !== 'idle') {
            targetRef.current[id] = { x: pet.x, y: pet.y }
            idleUntilRef.current[id] = Date.now() + 2500 + Math.random() * 5500
            setActions((old) => ['walk', 'run'].includes(old[id]) ? { ...old, [id]: 'idle' } : old)
          } else {
            if (Date.now() < idleUntilRef.current[id]) continue
            targetRef.current[id] = chooseTarget(pet, desktop)
            setActions((old) => old[id] === 'idle' ? { ...old, [id]: Math.random() < 0.2 ? 'run' : 'walk' } : old)
          }
          continue
        }
        const distance = Math.hypot(dx, dy)
        setFacingLeft((old) => old[id] === (dx < 0) ? old : { ...old, [id]: dx < 0 })
        const step = Math.min(distance, (actions[id] === 'run' ? 2.2 : 0.95) * 0.05 * 60)
        next.pets[id] = clampPet({ ...pet, x: pet.x + dx / distance * step, y: pet.y + dy / distance * step }, desktop)
        if (actions[id] === 'idle') setActions((old) => old[id] === 'idle' ? { ...old, [id]: Math.random() < 0.2 ? 'run' : 'walk' } : old)
      }
      commit(next, false)
    }, 50)
    return () => window.clearInterval(now)
  }, [ready, data.paused, desktop, actions, selected, commit])

  useEffect(() => {
    if (!ready || data.soundMuted) return
    let timeout = 0
    const chirp = () => {
      const min = 24_000; const delay = min + Math.random() * 30_000
      timeout = window.setTimeout(() => {
        if (!dataRef.current.soundMuted && !dataRef.current.paused && Math.random() < 0.42) playYip(dataRef.current.soundVolume)
        chirp()
      }, delay)
    }
    chirp()
    return () => window.clearTimeout(timeout)
  }, [ready, data.soundMuted])

  const setAction = useCallback((id: PetId, action: PetAction, message = '') => {
    if (actionTimers.current[id]) window.clearTimeout(actionTimers.current[id])
    setActions((old) => ({ ...old, [id]: action }))
    setThoughts((old) => ({ ...old, [id]: message }))
    const catDurations: Partial<Record<PetAction, number>> = { walk: 2400, run: 1800, eat: 3800, can: 4600, bath: 4200, pet: 4200, sun: 8500, sleep: 9500, groom: 3800, facewash: 3800, stretch: 3500, sunSleep: 9500, together: 5200 }
    const duration = catDurations[action] ?? 4200
    actionTimers.current[id] = window.setTimeout(() => setActions((old) => old[id] === action ? { ...old, [id]: 'idle' } : old), duration)
    window.setTimeout(() => setThoughts((old) => ({ ...old, [id]: undefined })), 2300)
    if (!dataRef.current.soundMuted && (action === 'bark' || action === 'play' || action === 'pet' || action === 'ball')) playYip(dataRef.current.soundVolume)
  }, [])

  useEffect(() => {
    if (!ready || data.paused) return
    const interval = window.setInterval(() => {
      for (const id of ['dakuan'] as const) {
        const petState = dataRef.current.pets[id]
        const needsAllZero = allNeedsZero(petState)
        if ((selected === id && !needsAllZero) || actionsRef.current[id] !== 'idle' || dragRef.current?.id === id) continue
        if (Math.random() > 0.72) continue
        const options: Record<PetId, PetAction[]> = { dakuan: petState.hunger === 0 ? ['hungry'] : needsAllZero ? ['hungry', 'sad', 'dirty'] : ['wag', 'bark', 'ball', 'sleep', 'groom', 'facewash', 'stretch', 'sunSleep', 'excited'] }
        const choices = [...new Set(options[id])]
        const recent = idleActionHistory.current[id]
        const freshChoices = choices.filter((action) => !recent.includes(action))
        const pool = freshChoices.length ? freshChoices : choices
        const action = pool[Math.floor(Math.random() * pool.length)]
        recent.push(action)
        if (recent.length > 2) recent.shift()
        const messages: Partial<Record<PetAction, string>> = { wag: '尾巴摇呀摇！', bark: '喵～', ball: '球球来啦！', sleep: '呼……睡一小会儿。', groom: '认真舔舔毛。', facewash: '洗把脸，精神满满。', stretch: '伸个懒腰～', sunSleep: '太阳暖洋洋。', excited: '看到你就开心！', hungry: petState.hunger === 0 ? '饿鼠了……' : petState.hunger < 20 ? '我很饿了……' : '我有点饿了……', sad: '陪我一会儿嘛……', dirty: '我想洗澡啦。' }
        setAction(id, action, messages[action] ?? '')
      }
    }, 10_000)
    return () => window.clearInterval(interval)
  }, [ready, data.paused, selected, setAction])

  const care = (id: PetId, action: PetAction) => {
    const current = dataRef.current
    const now = Date.now()
    const old = current.paused ? current.pets[id] : decayPet(current.pets[id], now, current.droppings.length)
    if (action === 'bath') {
      if (old.cleanliness >= 85) { setThoughts((previous) => ({ ...previous, [id]: '已经很干净了，先不用洗澡。' })); return }
    }
    const pet = { ...old }
    let message = ''
    let affection = 0
    if (action === 'walk') {
      pet.hunger = clamp(pet.hunger - 10); pet.mood = clamp(pet.mood + 22); pet.cleanliness = clamp(pet.cleanliness - 5); message = '出去玩好开心！'; affection = 10
      const area = desktop.displays.find((display) => pet.x >= display.x && pet.x <= display.x + display.width) ?? desktop.displays[0]
      if (area) targetRef.current.dakuan = { x: clamp(pet.x + (Math.random() < .5 ? -1 : 1) * 310, area.x, area.x + area.width - PET_WIDTH), y: clamp(pet.y + (Math.random() - .5) * 90, area.y, area.y + area.height - PET_HEIGHT) }
    }
    if (action === 'play') { pet.hunger = clamp(pet.hunger - 7); pet.mood = clamp(pet.mood + 18); message = '再来一次！'; affection = 8 }
    if (action === 'pet') { pet.mood = clamp(pet.mood + 17); message = '好舒服呀……'; affection = 8 }
    if (action === 'sun') { pet.hunger = clamp(pet.hunger - 7); pet.mood = clamp(pet.mood + 18); message = '晒太阳最舒服啦。'; affection = 8 }
    if (action === 'bath') { pet.cleanliness = 100; pet.mood = clamp(pet.mood - 7); message = '洗完澡，蓬松松。'; affection = 3 }
    Object.assign(pet, updateSatiety(pet, pet.hunger, now, old.hunger))
    const affectionReady = old.lastAffectionAt === 0 || now - old.lastAffectionAt >= INTERACTION_COOLDOWN_MS
    const affectionReward = affectionReady ? affection : 0
    if (affectionReward > 0) pet.lastAffectionAt = now
    else if (affection > 0) message = `${message} 亲密度奖励还要等${shortWait(INTERACTION_COOLDOWN_MS - (now - old.lastAffectionAt))}。`
    pet.lastUpdated = now
    const orders = ['walk', 'play', 'pet', 'sun'].includes(action) ? recordDailyProgress(current.orders, 'play-with-cat', 1, now) : current.orders
    const next = { ...current, pets: { ...current.pets, [id]: pet }, affection: { ...current.affection, [id]: current.affection[id] + affectionReward }, orders }
    commit(next)
    setAction(id, action, message)
  }

  const feed = (id: PetId, recipeId: RecipeId) => {
    const current = dataRef.current
    const recipe = RECIPES[recipeId]
    if (!recipe || recipe.kind === 'dog' || current.kitchen.pantry[recipeId] < 1) return
    const now = Date.now()
    const oldPet = current.paused ? current.pets[id] : decayPet(current.pets[id], now, current.droppings.length)
    if (oldPet.hunger >= 100) {
      setThoughts((previous) => ({ ...previous, [id]: '已经吃饱啦，先不吃了。' }))
      window.setTimeout(() => setThoughts((previous) => ({ ...previous, [id]: undefined })), 2300)
      return
    }
    const { weightTenthsJin, gain } = addMealWeight(oldPet.weightTenthsJin)
    const pet = updateSatiety({ ...oldPet, mood: clamp(oldPet.mood + 5), weightTenthsJin, lastUpdated: now }, oldPet.hunger + recipe.hunger, now, oldPet.hunger)
    const pantry = { ...current.kitchen.pantry, [recipeId]: current.kitchen.pantry[recipeId] - 1 }
    const next = { ...current, pets: { ...current.pets, [id]: pet }, affection: { ...current.affection, [id]: current.affection[id] + recipe.affection }, kitchen: { ...current.kitchen, pantry }, orders: recordDailyProgress(current.orders, 'feed-cat', 1, now) }
    commit(next)
    targetRef.current[id] = { x: pet.x, y: pet.y }
    setAction(id, recipe.kind === 'can' ? 'can' : 'eat', `吃到${recipe.outputName}啦，长了 ${formatWeight(gain)}！`)
  }

  const collectCatEvent = () => {
    const event = catEventRef.current
    if (!event) return
    const current = dataRef.current
    const pet = { ...current.pets.dakuan, mood: clamp(current.pets.dakuan.mood + (event.mood ?? 0)) }
    const next = {
      ...current,
      coins: current.coins + (event.coins ?? 0),
      affection: { ...current.affection, dakuan: current.affection.dakuan + (event.affection ?? 0) },
      pets: { ...current.pets, dakuan: pet }
    }
    commit(next)
    setCatEvent(null)
    if (catEventExpireRef.current !== null) window.clearTimeout(catEventExpireRef.current)
    catEventExpireRef.current = null
    if (event.page) {
      setSelected('dakuan')
      setPanelPage(event.page)
    }
    scheduleCatEventRef.current(15 * 60_000 + Math.random() * 10 * 60_000)
    setThoughts((previous) => ({ ...previous, dakuan: event.description }))
    window.setTimeout(() => setThoughts((previous) => ({ ...previous, dakuan: undefined })), 2600)
  }

  const startCooking = (potIndex: number, recipeId: RecipeId) => {
    const current = dataRef.current
    const recipe = RECIPES[recipeId]
    const pot = current.kitchen.pots[potIndex]
    if (!recipe || !pot || pot.recipeId || !isCookingPotUnlocked(potIndex, weightValue(current.pets.dakuan.weightTenthsJin))) return false
    const ingredients = { ...current.kitchen.ingredients }
    if (recipe.ingredients.some((ingredient) => ingredients[ingredient] < 1)) return false
    recipe.ingredients.forEach((ingredient) => { ingredients[ingredient] -= 1 })
    const now = Date.now()
    const pots = [...current.kitchen.pots]
    pots[potIndex] = { recipeId, startedAt: now, doneAt: now + recipe.cookMs }
    commit({ ...current, kitchen: { ...current.kitchen, ingredients, pots, lastIngredients: recipe.ingredients } })
    return true
  }

  const collectCooking = (potIndex: number) => {
    const current = dataRef.current
    const pot = current.kitchen.pots[potIndex]
    if (!pot.recipeId || pot.doneAt > Date.now()) return
    const now = Date.now()
    const pantry = { ...current.kitchen.pantry, [pot.recipeId]: current.kitchen.pantry[pot.recipeId] + 1 }
    const pots = [...current.kitchen.pots]
    pots[potIndex] = { recipeId: null, startedAt: 0, doneAt: 0 }
    let orders = current.orders
    if (RECIPES[pot.recipeId].kind !== 'dog') orders = recordDailyProgress(orders, 'cook-meals', 1, now)
    if (RECIPES[pot.recipeId].kind === 'can') orders = recordDailyProgress(orders, 'cook-cans', 1, now)
    commit({ ...current, kitchen: { ...current.kitchen, pantry, pots }, orders })
  }

  const collectAllReadyMeals = () => {
    const current = dataRef.current
    const now = Date.now()
    const pots = [...current.kitchen.pots]
    const pantry = { ...current.kitchen.pantry }
    let collected = 0
    let catMeals = 0
    let cans = 0
    pots.forEach((pot, index) => {
      if (!pot.recipeId || pot.doneAt > now) return
      pantry[pot.recipeId] += 1
      if (RECIPES[pot.recipeId].kind !== 'dog') catMeals += 1
      if (RECIPES[pot.recipeId].kind === 'can') cans += 1
      pots[index] = { ...EMPTY_COOKING_POT }
      collected += 1
    })
    if (collected) {
      let orders = current.orders
      if (catMeals) orders = recordDailyProgress(orders, 'cook-meals', catMeals, now)
      if (cans) orders = recordDailyProgress(orders, 'cook-cans', cans, now)
      commit({ ...current, kitchen: { ...current.kitchen, pantry, pots }, orders })
    }
    return collected
  }

  const collectDropping = (id: string) => {
    const current = dataRef.current
    const dropping = current.droppings.find((item) => item.id === id)
    const droppings = current.droppings.filter((dropping) => dropping.id !== id)
    if (droppings.length === current.droppings.length) return
    commit({ ...current, droppings, compost: { ...current.compost, poopCount: current.compost.poopCount + Number(!dropping?.rainbow), rainbowPoopCount: current.compost.rainbowPoopCount + Number(Boolean(dropping?.rainbow)) }, orders: recordDailyProgress(current.orders, 'collect-poop') })
  }

  const startFertilizer = (potIndex: number) => {
    const current = dataRef.current
    const pot = current.compost.pots[potIndex]
    if (potIndex >= current.compost.unlockedPots || !pot || pot.startedAt || current.compost.poopCount < 15) return false
    const now = Date.now()
    const pots = [...current.compost.pots]
    pots[potIndex] = { startedAt: now, doneAt: now + 20 * 60_000 }
    commit({ ...current, compost: { ...current.compost, poopCount: current.compost.poopCount - 15, pots } })
    return true
  }

  const collectFertilizer = (potIndex: number) => {
    const current = dataRef.current
    const pot = current.compost.pots[potIndex]
    if (potIndex >= current.compost.unlockedPots || !pot?.startedAt || pot.doneAt > Date.now()) return false
    const pots = [...current.compost.pots]
    pots[potIndex] = { ...EMPTY_COMPOST_POT }
    commit({ ...current, compost: { ...current.compost, fertilizerCount: current.compost.fertilizerCount + 1, pots } })
    return true
  }

  const unlockFertilizerFactory = (payment: 'poop' | 'rainbow') => {
    const current = dataRef.current
    if (current.compost.unlockedPots >= 5) return false
    if (payment === 'poop' && current.compost.poopCount < 200) return false
    if (payment === 'rainbow' && current.compost.rainbowPoopCount < 5) return false
    commit({ ...current, compost: { ...current.compost, unlockedPots: current.compost.unlockedPots + 1, poopCount: current.compost.poopCount - (payment === 'poop' ? 200 : 0), rainbowPoopCount: current.compost.rainbowPoopCount - (payment === 'rainbow' ? 5 : 0) } })
    return true
  }

  const claimOrder = (index: number) => {
    const current = dataRef.current
    const order = current.orders.orders[index]
    if (!order || order.claimed || order.requirements.some((item) => orderRequirementStock(item, current) < item.amount)) return false
    const compost = { ...current.compost }
    const pantry = { ...current.kitchen.pantry }
    for (const requirement of order.requirements) {
      if (requirement.kind === 'poop') compost.poopCount -= requirement.amount
      else if (requirement.kind === 'rainbowPoop') compost.rainbowPoopCount -= requirement.amount
      else pantry[requirement.recipeId] -= requirement.amount
    }
    const orders = [...current.orders.orders]
    orders[index] = { ...order, claimed: true }
    const orderBoard = recordDailyProgress(current.orders, 'complete-orders')
    commit({ ...current, compost, kitchen: { ...current.kitchen, pantry }, coins: current.coins + order.reward, orders: { ...orderBoard, orders } })
    return true
  }

  const claimDailyTask = (index: number) => {
    const current = dataRef.current
    const now = Date.now()
    const board = current.orders.dailyTasks.date === localDayKey(now) ? current.orders.dailyTasks : createDailyTaskBoard(now)
    if (board !== current.orders.dailyTasks) {
      commit({ ...current, orders: { ...current.orders, dailyTasks: board } })
      return false
    }
    const task = board.tasks[index]
    if (!task || task.claimed || task.progress < task.target) return false
    const tasks = [...board.tasks]
    tasks[index] = { ...task, claimed: true }
    commit({ ...current, coins: current.coins + 50, orders: { ...current.orders, dailyTasks: { ...board, tasks } } })
    return true
  }

  const buyOutfit = (id: OutfitId) => {
    const current = dataRef.current
    const refreshed = refreshOutfitShop(current.wardrobe, Date.now())
    const item = OUTFITS.find((entry) => entry.id === id)
    if (!item || !refreshed.shop.stock.includes(id) || refreshed.owned.includes(id) || current.coins < item.price) {
      if (refreshed !== current.wardrobe) commit({ ...current, wardrobe: refreshed })
      return false
    }
    const wardrobe = {
      ...refreshed,
      owned: [...refreshed.owned, id],
      shop: { ...refreshed.shop, stock: refreshed.shop.stock.filter((stockId) => stockId !== id) }
    }
    commit({ ...current, wardrobe, coins: current.coins - item.price })
    return true
  }

  const redeemPoopOutfit = () => {
    const current = dataRef.current
    const id: OutfitId = 'poop-pudding'
    if (current.wardrobe.owned.includes(id) || current.compost.poopCount < 500) return false
    commit({
      ...current,
      compost: { ...current.compost, poopCount: current.compost.poopCount - 500 },
      wardrobe: { ...current.wardrobe, owned: [...current.wardrobe.owned, id] }
    })
    return true
  }

  const equipOutfit = (id: OutfitId | null) => {
    const current = dataRef.current
    if (id && !current.wardrobe.owned.includes(id)) return
    commit({ ...current, wardrobe: { ...current.wardrobe, equipped: id } })
  }

  const plantCrop = (plotIndex: number, cropId: CropId) => {
    const current = dataRef.current
    const crop = CROPS.find((item) => item.id === cropId)
    const highest = current.affection.dakuan
    if (!crop || highest < crop.unlockAt || plotIndex >= unlockedPlotCount(highest) || current.garden.plots[plotIndex]?.cropId) return
    const plots = [...current.garden.plots]
    plots[plotIndex] = { ...emptyPlot(), cropId, plantedAt: Date.now(), waterDate: localDayKey(Date.now()) }
    commit({ ...current, garden: { plots } })
  }

  const plantAllCrops = (cropId: CropId) => {
    const current = dataRef.current
    const crop = CROPS.find((item) => item.id === cropId)
    const highest = current.affection.dakuan
    if (!crop || highest < crop.unlockAt) return 0
    const unlocked = unlockedPlotCount(highest)
    const plots = [...current.garden.plots]
    let planted = 0
    plots.forEach((plot, index) => {
      if (index >= unlocked || plot.cropId) return
      plots[index] = { ...emptyPlot(), cropId, plantedAt: Date.now(), waterDate: localDayKey(Date.now()) }
      planted += 1
    })
    if (planted) commit({ ...current, garden: { plots } })
    return planted
  }

  const waterCrop = (plotIndex: number) => {
    const current = dataRef.current
    const plot = current.garden.plots[plotIndex]
    if (!plot?.cropId) return
    const now = Date.now()
    const today = localDayKey(now)
    const wateredToday = plot.waterDate === today ? plot.wateringsToday : 0
    const crop = CROPS.find((item) => item.id === plot.cropId)!
    const growth = cropGrowth(plot.cropId, plot, now)
    if (growth.ready || wateredToday >= 4 || (plot.lastWaterAt > 0 && now - plot.lastWaterAt < 600_000)) return
    const plots = [...current.garden.plots]
    plots[plotIndex] = { ...plot, growthBonusMs: plot.growthBonusMs + crop.growMs * .2, lastWaterAt: now, waterDate: today, wateringsToday: wateredToday + 1 }
    commit({ ...current, garden: { plots }, orders: recordDailyProgress(current.orders, 'water-crops', 1, now) })
  }

  const fertilizeCrop = (plotIndex: number) => {
    const current = dataRef.current
    const plot = current.garden.plots[plotIndex]
    if (!plot?.cropId || current.compost.fertilizerCount < 1 || cropGrowth(plot.cropId, plot, Date.now()).ready) return false
    const crop = CROPS.find((item) => item.id === plot.cropId)!
    const elapsed = Date.now() - plot.plantedAt + plot.growthBonusMs
    const plots = [...current.garden.plots]
    plots[plotIndex] = { ...plot, growthBonusMs: plot.growthBonusMs + Math.max(0, crop.growMs - elapsed) }
    commit({ ...current, garden: { plots }, compost: { ...current.compost, fertilizerCount: current.compost.fertilizerCount - 1 } })
    return true
  }

  const harvestCrop = (plotIndex: number) => {
    const current = dataRef.current
    const plot = current.garden.plots[plotIndex]
    if (!plot?.cropId || !cropGrowth(plot.cropId, plot, Date.now()).ready) return
    const crop = CROPS.find((item) => item.id === plot.cropId)!
    const [minimum, maximum] = crop.yield
    const amount = minimum + Math.floor(Math.random() * (maximum - minimum + 1))
    const plots = [...current.garden.plots]
    plots[plotIndex] = emptyPlot()
    const ingredients = { ...current.kitchen.ingredients, [crop.ingredient]: current.kitchen.ingredients[crop.ingredient] + amount }
    const pet = { ...current.pets.dakuan }
    const now = Date.now()
    const affectionReady = pet.lastAffectionAt === 0 || now - pet.lastAffectionAt >= INTERACTION_COOLDOWN_MS
    if (affectionReady) pet.lastAffectionAt = now
    const affection = { ...current.affection, dakuan: current.affection.dakuan + (affectionReady ? 3 : 0) }
    commit({ ...current, pets: { ...current.pets, dakuan: pet }, garden: { plots }, kitchen: { ...current.kitchen, ingredients }, affection, orders: recordDailyProgress(current.orders, 'harvest-crops', 1, now) })
  }

  const harvestAllCrops = () => {
    const current = dataRef.current
    const now = Date.now()
    const plots = [...current.garden.plots]
    const ingredients = { ...current.kitchen.ingredients }
    let harvested = 0
    plots.forEach((plot, index) => {
      if (!plot.cropId || !cropGrowth(plot.cropId, plot, now).ready) return
      const crop = CROPS.find((item) => item.id === plot.cropId)!
      const [minimum, maximum] = crop.yield
      ingredients[crop.ingredient] += minimum + Math.floor(Math.random() * (maximum - minimum + 1))
      plots[index] = emptyPlot()
      harvested += 1
    })
    if (!harvested) return
    const pet = { ...current.pets.dakuan }
    const affectionReady = pet.lastAffectionAt === 0 || now - pet.lastAffectionAt >= INTERACTION_COOLDOWN_MS
    if (affectionReady) pet.lastAffectionAt = now
    const affection = { ...current.affection, dakuan: current.affection.dakuan + (affectionReady ? 3 : 0) }
    commit({ ...current, pets: { ...current.pets, dakuan: pet }, garden: { plots }, kitchen: { ...current.kitchen, ingredients }, affection, orders: recordDailyProgress(current.orders, 'harvest-crops', harvested, now) })
  }

  const digCrop = (plotIndex: number) => {
    const current = dataRef.current
    if (!current.garden.plots[plotIndex]?.cropId) return
    const plots = [...current.garden.plots]
    plots[plotIndex] = emptyPlot()
    commit({ ...current, garden: { plots } })
  }

  const togglePaused = () => {
    const now = Date.now()
    const current = dataRef.current
    const next = { ...current, paused: !current.paused, pets: { dakuan: { ...current.pets.dakuan, lastUpdated: now } } }
    commit(next)
    if (next.paused) setActions({ dakuan: 'idle' })
  }

  const togglePetPanel = (id: PetId, isSelected: boolean) => {
    if (isSelected) pointerLeave()
    if (!isSelected) {
      setPanelPage(1)
      const pet = dataRef.current.pets[id]
      targetRef.current[id] = { x: pet.x, y: pet.y }
      if (actionTimers.current[id]) window.clearTimeout(actionTimers.current[id])
      setActions((old) => ({ ...old, [id]: 'idle' }))
      setThoughts((old) => ({ ...old, [id]: undefined }))
    }
    setSelected(isSelected ? null : id)
  }

  const updatePetPosition = (id: PetId, x: number, y: number, save = false) => {
    const current = dataRef.current
    const pet = clampPet({ ...current.pets[id], x, y }, desktop)
    const next = { ...current, pets: { ...current.pets, [id]: pet } }
    commit(next, save)
  }

  const pointerEnter = () => {
    if (hoverRef.current) window.clearTimeout(hoverRef.current)
    if (!pointerActiveRef.current) {
      pointerActiveRef.current = true
      window.desktopPets.setPointerActive(true)
    }
  }
  const pointerLeave = () => {
    if (hoverRef.current) window.clearTimeout(hoverRef.current)
    hoverRef.current = window.setTimeout(() => {
      hoverRef.current = null
      const activeElement = document.elementFromPoint(lastPointerRef.current.x, lastPointerRef.current.y)
      if (activeElement?.closest('.pet-button, .care-card, .dropping-button, .cosmetic-modal-layer')) return
      pointerActiveRef.current = false
      window.desktopPets.setPointerActive(false)
    }, 120)
  }
  const down = (id: PetId, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const pet = dataRef.current.pets[id]
    dragRef.current = { id, pointerId: event.pointerId, startX: event.screenX, startY: event.screenY, petX: pet.x, petY: pet.y, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (id: PetId, event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== id || drag.pointerId !== event.pointerId) return
    const dx = event.screenX - drag.startX; const dy = event.screenY - drag.startY
    if (Math.hypot(dx, dy) > 5) drag.moved = true
    if (drag.moved) updatePetPosition(id, drag.petX + dx, drag.petY + dy)
  }
  const up = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    const drag = dragRef.current
    if (drag.moved) {
      updatePetPosition(drag.id, dataRef.current.pets[drag.id].x, dataRef.current.pets[drag.id].y, true)
      targetRef.current[drag.id] = { x: dataRef.current.pets[drag.id].x, y: dataRef.current.pets[drag.id].y }
      idleUntilRef.current[drag.id] = Date.now() + 3500
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 350)
    }
    dragRef.current = null
  }

  const panelPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation()
    if ((event.target as HTMLElement).closest('button, input, textarea, select, a, label')) return
    panelDragRef.current = { pointerId: event.pointerId, startX: event.screenX, startY: event.screenY, offsetX: panelOffset.x, offsetY: panelOffset.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const panelPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = panelDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setPanelOffset({ x: drag.offsetX + event.screenX - drag.startX, y: drag.offsetY + event.screenY - drag.startY })
  }
  const panelPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation()
    if (panelDragRef.current?.pointerId === event.pointerId) panelDragRef.current = null
  }

  if (!ready) return null
  return <main className="desktop" aria-label="大款桌面宠物">
    {data.droppings.map((dropping) => <button key={dropping.id} className={`dropping-button ${dropping.rainbow ? 'rainbow' : ''}`} aria-label={dropping.rainbow ? '收集彩色便便制作化肥' : '收集便便制作化肥'} title={dropping.rainbow ? '彩色便便，点击收集' : '点击收集，带去制作化肥'} style={{ left: dropping.x - desktop.origin.x - 22, top: dropping.y - desktop.origin.y - 23 }} onPointerEnter={pointerEnter} onPointerLeave={pointerLeave} onClick={() => collectDropping(dropping.id)}><PoopMark rainbow={dropping.rainbow} /></button>)}
    {(['dakuan'] as const).map((id) => {
      const pet = data.pets[id]
      const weight = weightValue(pet.weightTenthsJin)
      const weightProgress = weight >= ONE_TON_TENTHS_JIN ? 100 : Number(weight * 100n / ONE_TON_TENTHS_JIN)
      // Keep the cat at its full normal size regardless of weight; weight remains
      // a gameplay/stat value but no longer drives a 30-jin visual growth step.
      const scale = 1
      const isSelected = selected === id
      const need = lowestNeed(pet)
      const allZero = allNeedsZero(pet)
      const low = allZero ? '需要照顾' : need?.label ?? ''
      const statusAction = actions[id] === 'hungry' || actions[id] === 'sad' || actions[id] === 'dirty'
      // A need pose (for example hungry) may decorate an idle cat, but must not
      // replace the locomotion pose while the movement controller advances it.
      const locomoting = actions[id] === 'walk' || actions[id] === 'run'
      const visibleAction: PetAction = data.paused ? 'idle' : locomoting ? actions[id] : allZero ? (statusAction ? actions[id] : 'idle') : actions[id] === 'idle' && need ? need.action : actions[id]
      const pos: CSSProperties = { left: pet.x - desktop.origin.x, top: pet.y - desktop.origin.y }
      const localX = pet.x - desktop.origin.x
      const localY = pet.y - desktop.origin.y
      const panelWidth = Math.min(desktop.width - 28, panelPage === 1 ? 310 : panelPage === 6 || panelPage === 7 ? 760 : panelPage === 8 ? 420 : 480)
      const panelHeight = Math.min(700, desktop.height * .78)
      const cardOnTop = localY > desktop.height * .52
      const cardFitsRight = localX + PET_WIDTH + panelWidth + 18 < desktop.width
      const cardLeft = cardOnTop ? (localX > desktop.width - panelWidth - 20 ? -panelWidth - 8 : 0) : (cardFitsRight ? 180 : -panelWidth - 10)
      const cardStyle: CSSProperties = {
        top: clamp((cardOnTop ? localY - panelHeight : localY + 160) + panelOffset.y, 14, Math.max(14, desktop.height - panelHeight - 14)) - localY,
        left: clamp(localX + cardLeft + panelOffset.x, 14, Math.max(14, desktop.width - panelWidth - 14)) - localX,
        maxHeight: panelHeight
      }
      return <div className={`pet-scene ${isSelected ? 'selected' : ''}`} style={pos} key={id}>
        {catEvent && <button className="cat-event-bubble" onClick={collectCatEvent} onPointerEnter={pointerEnter} onPointerLeave={pointerLeave}><b>✨ {catEvent.title}</b><span>{catEvent.description}</span><strong>{catEvent.actionLabel ?? '点我领取'} · {catEvent.reward}</strong></button>}
        {thoughts[id] && <div className="thought">{thoughts[id]}</div>}
        <button className="pet-button" aria-label={`打开${LABELS[id]}的状态和照料选项`} onPointerEnter={pointerEnter} onPointerLeave={pointerLeave} onPointerDown={(event) => down(id, event)} onPointerMove={(event) => move(id, event)} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onClick={() => { if (suppressClickRef.current) return; togglePetPanel(id, isSelected); if (!data.soundMuted) playYip(data.soundVolume) }}>
          <span className="character-sizer" style={{ transform: `scale(${scale})` }}><PetCharacter id={id} action={visibleAction} facingLeft={facingLeft[id]} visualStyle={visualStyle} freezeFrames={data.paused || (isSelected && actions[id] === 'idle')} outfit={data.wardrobe.equipped} /></span>
          <span className="name-tag"><i className={`status-dot ${low ? 'needs-care' : ''}`} />{LABELS[id]}{low && <em>{low}</em>}</span>
          {data.paused && <span className="paused-mark">休息中</span>}
        </button>
        {isSelected && <section key={panelPage} className={`care-card ${panelPage === 1 ? 'pet-page-card' : 'activity-card'} ${panelPage === 6 ? 'wardrobe-card' : ''} ${panelPage === 7 ? 'outfit-store-card' : ''}`} style={{ ...cardStyle, width: panelWidth }} aria-label={`${LABELS[id]}状态面板`} onPointerEnter={pointerEnter} onPointerLeave={pointerLeave} onPointerDown={panelPointerDown} onPointerMove={panelPointerMove} onPointerUp={panelPointerUp} onPointerCancel={panelPointerUp}>
          <div className="card-head"><div><div className="eyebrow">{IS_TEST_BUILD ? '全服饰解锁测试版' : panelPage === 1 ? '陪伴小档案' : '大款的共享空间'}</div><h2>{panelPage === 1 ? LABELS[id] : panelPage === 2 ? '小厨房' : panelPage === 3 ? '小菜园' : panelPage === 4 ? '化肥工坊' : panelPage === 5 ? '订单中心' : panelPage === 6 ? '衣服仓库' : panelPage === 7 ? '穿搭商店' : '设置'} <span>{panelPage === 1 ? '暹罗猫 · 蓝眼重点色' : `当前陪伴：${LABELS[id]}`}</span></h2></div><div className="card-head-actions"><button className={`pin-button ${data.alwaysOnTop !== false ? 'active' : ''}`} onClick={() => commit({ ...dataRef.current, alwaysOnTop: dataRef.current.alwaysOnTop === false })} aria-label={data.alwaysOnTop === false ? '置顶宠物和页面' : '取消宠物和页面置顶'} title={data.alwaysOnTop === false ? '点击后大款和所有页面保持在最前面' : '已置顶：大款和所有页面保持在最前面'}>{data.alwaysOnTop === false ? '📍' : '📌'}</button><button className="icon-button close" onClick={() => { setSelected(null); pointerLeave() }} aria-label="关闭">×</button></div></div>
          <div className="pet-intro">{panelPage === 1 ? '圆滚滚的大款 · 白手套蓝眼睛' : panelPage === 2 ? '搭配食材，为大款做一顿香喷喷的饭' : panelPage === 3 ? '种下作物，收获新鲜食材' : panelPage === 4 ? '收集便便制作化肥，帮助作物生长' : panelPage === 5 ? '完成订单与每日任务，赚取金币' : panelPage === 6 ? '看看收藏的穿搭，点击就能换装' : panelPage === 7 ? '挑选限时上架的大款专属穿搭' : '调节声音、兑换礼包，或退出桌宠'}</div>
          <nav className="page-tabs" aria-label="面板页面">
            <button className={panelPage === 1 ? 'active' : ''} onClick={() => setPanelPage(1)}>🐾 宠物</button>
            <button className={panelPage === 2 ? 'active' : ''} onClick={() => setPanelPage(2)}>🍳 厨房</button>
            <button className={panelPage === 3 ? 'active' : ''} onClick={() => setPanelPage(3)}>🌱 菜园</button>
            <button className={panelPage === 4 ? 'active' : ''} onClick={() => setPanelPage(4)}>🧪 化肥</button>
            <button className={panelPage === 5 ? 'active' : ''} onClick={() => setPanelPage(5)}>📦 订单</button>
            <button className={panelPage === 6 ? 'active' : ''} onClick={() => setPanelPage(6)}>👘 穿搭</button>
            <button className={panelPage === 7 ? 'active' : ''} onClick={() => setPanelPage(7)}>🛍️ 商店</button>
          </nav>
          {panelPage === 1 ? <>
            <div className="stats">
              <StatBar label="饱腹" value={pet.hunger} reverse />
              <StatBar label="心情" value={pet.mood} reverse />
              <StatBar label="清洁" value={pet.cleanliness} reverse />
            </div>
            <div className="affection-card"><div className="affection-heading"><span>💞 亲密度 · Lv.{affectionProgress(data.affection[id]).level}</span><b>{data.affection[id]} / {affectionProgress(data.affection[id]).next}</b></div><div className="affection-track"><i style={{ width: `${affectionProgress(data.affection[id]).progress}%` }} /></div><small>{pet.lastAffectionAt && clock < pet.lastAffectionAt + INTERACTION_COOLDOWN_MS ? `互动亲密度奖励冷却中：${shortWait(pet.lastAffectionAt + INTERACTION_COOLDOWN_MS - clock)}；照料仍可进行，喂食仍增加亲密度。` : '互动亲密度奖励冷却 10 分钟，喂食不受冷却限制。'} 洗澡在清洁度低于 85% 时可用且没有冷却。饱腹值为 0 时，每持续 1 小时会扣 1 点亲密度。升级里程碑：100、200、500、900……</small></div>
            <div className="weight-card"><div className="weight-heading"><span>⚖️ 大款的体重</span><b>{formatWeight(weight)}</b></div><div className="weight-track"><i style={{ width: `${weightProgress}%` }} /></div><small>{weight >= ONE_TON_TENTHS_JIN ? '一吨目标达成啦！继续喂食还会继续长，没有上限。' : `距离一吨目标还差 ${formatWeight(ONE_TON_TENTHS_JIN - weight)}。每次喂食增加当前体重的 20%，最低 0.5 斤。`}</small></div>
            <div className="care-title">粮柜里的食物 · 点击喂食</div>
            <div className="care-actions food-actions">
              {(Object.entries(RECIPES) as [RecipeId, (typeof RECIPES)[RecipeId]][]).filter(([, recipe]) => recipe.kind !== 'dog').map(([recipeId, recipe]) => <button key={recipeId} className="care-action food" disabled={pet.hunger >= 100 || data.kitchen.pantry[recipeId] < 1} onClick={() => feed(id, recipeId)} title={pet.hunger >= 100 ? '饱腹值已满，暂时不能喂食' : `饱腹 +${recipe.hunger}，亲密度 +${recipe.affection}`}><span>{recipe.outputIcon}</span>{recipe.outputName}<small>×{data.kitchen.pantry[recipeId]}</small></button>)}
            </div>
            <div className="care-title">陪它做点喜欢的事</div>
            <div className="care-actions">
              <button className="care-action" onClick={() => care(id, 'walk')}><span>🐾</span>出去逛逛</button><button className="care-action" onClick={() => care(id, 'play')}><span>🎾</span>陪我玩</button><button className="care-action" onClick={() => care(id, 'pet')}><span>🤍</span>摸摸我</button><button className="care-action" onClick={() => care(id, 'sun')}><span>☀️</span>晒太阳</button><button className="care-action" disabled={pet.cleanliness >= 85} title={pet.cleanliness >= 85 ? '清洁度低于 85% 时可以洗澡' : '随时可以洗澡'} onClick={() => care(id, 'bath')}><span>🫧</span>洗澡澡</button>
            </div>
            <button className="settings-open" onClick={() => setPanelPage(8)}>⚙ 设置</button>
          </> : panelPage === 8 ? <SettingsPage state={data} onVolume={(soundVolume) => commit({ ...dataRef.current, soundVolume })} onToggleMuted={() => commit({ ...dataRef.current, soundMuted: !dataRef.current.soundMuted })} onPreviewSound={() => { if (!dataRef.current.soundMuted) playYip(dataRef.current.soundVolume) }} onRedeem={(code) => { const result = redeemGiftCode(dataRef.current, code); if (result.success) commit(result.state); return result }} onBack={() => setPanelPage(1)} onQuit={quitPet} /> : panelPage === 6 ? <WardrobePage state={data.wardrobe} action={visibleAction} facingLeft={facingLeft[id]} visualStyle={visualStyle} paused={data.paused} onEquip={equipOutfit} /> : panelPage === 7 ? <OutfitStorePage state={data.wardrobe} coins={data.coins} poopCount={data.compost.poopCount} now={clock} onBuy={buyOutfit} onRedeemPoop={redeemPoopOutfit} visualStyle={visualStyle} /> : <ActivityPages page={panelPage as 2 | 3 | 4 | 5} petId={id} state={data} now={clock} onCook={startCooking} onCollect={collectCooking} onCollectAllMeals={collectAllReadyMeals} onPlant={plantCrop} onPlantAll={plantAllCrops} onWater={waterCrop} onHarvest={harvestCrop} onHarvestAll={harvestAllCrops} onDig={digCrop} onFertilize={fertilizeCrop} onStartFertilizer={startFertilizer} onCollectFertilizer={collectFertilizer} onUnlockFertilizerFactory={unlockFertilizerFactory} onToggleConstipation={(enabled) => { const current = dataRef.current; const pet = { ...current.pets.dakuan, ...(enabled ? { lastPoopAt: Date.now() } : {}) }; commit({ ...current, constipationMode: enabled, pets: { ...current.pets, dakuan: pet } }) }} onClaimOrder={claimOrder} onClaimDailyTask={claimDailyTask} weightTenthsJin={pet.weightTenthsJin} />}
          <div className="card-footer"><span>{panelPage === 1 ? ACTION_LABEL[actions[id]] : panelPage === 2 ? '做好的餐点会出现在宠物页粮柜' : panelPage === 3 ? '浇水、施肥和作物生长都会保存' : panelPage === 4 ? '收集便便制作化肥，催熟菜园作物' : panelPage === 5 ? '完成订单领取金币，购买喜欢的装饰' : panelPage === 6 ? '选择装饰后会立即同步到桌面大款' : panelPage === 7 ? '购买后的整套服饰会保存在衣服仓库' : '设置和兑换记录会自动保存'}</span></div>
          <button className={`pause-button ${data.paused ? 'is-paused' : ''}`} onClick={togglePaused}>{data.paused ? '▶ 继续活动' : 'Ⅱ 让大款原地休息'}</button>
        </section>}
      </div>
    })}
  </main>
}
