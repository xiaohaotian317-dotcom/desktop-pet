import type { DailyTask, DailyTaskBoardState, DailyTaskKind } from './types'

interface DailyTaskTemplate {
  kind: DailyTaskKind
  targets: number[]
  title: (target: number) => string
}

const TASK_TEMPLATES: DailyTaskTemplate[] = [
  { kind: 'collect-poop', targets: [8, 12, 16], title: (target) => `收集 ${target} 个便便` },
  { kind: 'complete-orders', targets: [1, 2], title: (target) => `完成 ${target} 个订单` },
  { kind: 'cook-cans', targets: [3, 4, 5], title: (target) => `制作并收取 ${target} 个猫罐头` },
  { kind: 'cook-meals', targets: [3, 4, 5], title: (target) => `制作并收取 ${target} 份猫咪餐点` },
  { kind: 'water-crops', targets: [2, 3], title: (target) => `给 ${target} 株作物浇水` },
  { kind: 'harvest-crops', targets: [2, 3], title: (target) => `收获 ${target} 株农作物` },
  { kind: 'feed-cat', targets: [2, 3], title: (target) => `给大款喂食 ${target} 次` },
  { kind: 'play-with-cat', targets: [2, 3], title: (target) => `陪大款玩耍或摸摸 ${target} 次` }
]

export function dailyDateKey(time: number) {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function seededRandom(seedText: string) {
  let seed = 2166136261
  for (const character of seedText) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x1_0000_0000
  }
}

export function createDailyTaskBoard(now: number): DailyTaskBoardState {
  const date = dailyDateKey(now)
  const random = seededRandom(date)
  const shuffled = [...TASK_TEMPLATES]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  const tasks: DailyTask[] = shuffled.slice(0, 3).map((template) => {
    const target = template.targets[Math.floor(random() * template.targets.length)]
    return { id: `${date}-${template.kind}`, kind: template.kind, title: template.title(target), target, progress: 0, claimed: false }
  })
  return { date, tasks }
}

export function advanceDailyTaskBoard(board: DailyTaskBoardState | undefined, kind: DailyTaskKind, amount: number, now: number): DailyTaskBoardState {
  const current = board?.date === dailyDateKey(now) && board.tasks.length === 3 ? board : createDailyTaskBoard(now)
  if (!Number.isFinite(amount) || amount <= 0) return current
  return {
    ...current,
    tasks: current.tasks.map((task) => task.kind === kind && !task.claimed
      ? { ...task, progress: Math.min(task.target, task.progress + amount) }
      : task)
  }
}
