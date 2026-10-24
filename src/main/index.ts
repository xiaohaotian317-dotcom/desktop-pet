import { app, BrowserWindow, dialog, ipcMain, Menu, screen, Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import type { DesktopInfo, PersistedState } from '../shared/types'
import { createDailyTaskBoard } from '../shared/dailyTasks'
import { createRestaurantState } from '../shared/restaurant'
import { atomicWriteState, readStateFile, writeStateFile } from './stateFiles'

let petWindow: BrowserWindow | null = null
let tray: Tray | null = null
let persisted: PersistedState | null = null

function applyAlwaysOnTop(enabled: boolean) {
  if (!petWindow || petWindow.isDestroyed()) return
  // Use the highest normal desktop level so both the pet and its in-window
  // panels stay above ordinary windows on Windows.
  petWindow.setAlwaysOnTop(enabled, enabled ? 'screen-saver' : 'normal')
}

// Transparent desktop overlays can fail to initialize on older/integrated GPUs.
// This app is 2D, so software compositing is a reasonable compatibility fallback.
app.disableHardwareAcceleration()

function writeDiagnostic(message: string) {
  try {
    const logDirectory = join(app.getPath('appData'), __DAKUAN_TEST_BUILD__ ? 'DakuanDesktopPet-Test' : 'DakuanDesktopPet', 'logs')
    mkdirSync(logDirectory, { recursive: true })
    appendFileSync(join(logDirectory, 'startup.log'), `${new Date().toISOString()} ${message}\n`, 'utf8')
  } catch (error) {
    console.error('无法写入启动诊断日志。', error)
  }
}

process.on('uncaughtException', (error) => {
  writeDiagnostic(`主进程异常：${error.stack ?? error.message}`)
  dialog.showErrorBox('大款桌宠启动失败', `程序遇到错误，诊断记录已保存到应用数据目录。\n\n${error.message}`)
  app.quit()
})

process.on('unhandledRejection', (reason) => {
  writeDiagnostic(`未处理的异步错误：${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`)
})

function localDayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const appDataDirectory = app.getPath('appData')
const previousDefaultUserDataDirectory = app.getPath('userData')
const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR
const stableDataDirectory = join(app.getPath('appData'), __DAKUAN_TEST_BUILD__ ? 'DakuanDesktopPet-Test' : 'DakuanDesktopPet')
mkdirSync(stableDataDirectory, { recursive: true })
app.setPath('userData', stableDataDirectory)

function stateProgressScore(state: PersistedState) {
  const number = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
  const weight = /^\d+$/u.test(state.pets?.dakuan?.weightTenthsJin ?? '') ? Number(BigInt(state.pets.dakuan.weightTenthsJin) / 10n) : 1
  const affection = Object.values(state.affection ?? {}).reduce((sum, value) => sum + number(value), 0)
  const ownedOutfits = state.wardrobe?.owned?.length ?? 0
  const ownedCosmetics = state.cosmetics?.owned?.length ?? 0
  const poop = number(state.compost?.poopCount) + number(state.compost?.rainbowPoopCount)
  const ingredients = Object.values(state.kitchen?.ingredients ?? {}).reduce((sum, value) => sum + number(value), 0)
  const meals = Math.max(0, Object.values(state.kitchen?.pantry ?? {}).reduce((sum, value) => sum + number(value), 0) - 7)
  const planted = state.garden?.plots?.filter((plot) => Boolean(plot?.cropId)).length ?? 0
  const claimed = state.orders?.orders?.filter((order) => order?.claimed).length ?? 0
  const moved = Math.abs(number(state.pets.dakuan.x) - 340) + Math.abs(number(state.pets.dakuan.y) - 500)
  const restaurantProgress = number(state.restaurant?.lifetimeRevenue) * 10 + number(state.restaurant?.upgradeSpent) * 10 + number(state.restaurant?.completedDays) * 1000
  return number(state.coins) * 10 + affection * 5 + Math.min(Math.max(0, weight - 1), 1_000_000) + ownedOutfits * 100_000 + ownedCosmetics * 10_000 + poop * 20 + ingredients * 10 + meals * 10 + planted * 100 + claimed * 50 + moved + restaurantProgress
}

function legacyStatePaths() {
  const paths: string[] = []
  const addDirectory = (directory: string) => {
    if (!directory || directory.toLowerCase() === stableDataDirectory.toLowerCase()) return
    paths.push(join(directory, 'pet-state.json'), join(directory, 'pet-state.json.bak'))
  }
  addDirectory(previousDefaultUserDataDirectory)
  for (const name of ['dakuan-desktop-pet', 'Dakuan Desktop Pet', '大款桌宠']) addDirectory(join(appDataDirectory, name))
  try {
    for (const name of readdirSync(appDataDirectory)) {
      if (/大款桌宠数据-v[\d.]+/u.test(name)) addDirectory(join(appDataDirectory, name))
    }
  } catch { /* The app-data directory may not be listable on restricted devices. */ }
  for (const base of [app.getPath('desktop'), app.getPath('downloads')]) {
    try {
      for (const name of readdirSync(base)) {
        if (/^大款桌宠数据-v[\d.]+$/u.test(name)) addDirectory(join(base, name))
      }
    } catch { /* Old portable data may sit beside a copy stored on the Desktop or Downloads folder. */ }
  }
  if (!__DAKUAN_TEST_BUILD__ && portableDirectory) {
    paths.push(join(portableDirectory, 'pet-state.json'), join(portableDirectory, 'pet-state.json.bak'))
    try {
      for (const name of readdirSync(portableDirectory)) {
        if (/^大款桌宠数据-v[\d.]+$/u.test(name)) addDirectory(join(portableDirectory, name))
      }
    } catch { /* Portable migration is best-effort; the stable profile remains untouched. */ }
  }
  return [...new Set(paths)]
}

const initialState: PersistedState = {
  pets: { dakuan: { hunger: 80, mood: 80, cleanliness: 80, x: 340, y: 500, lastUpdated: Date.now(), lastBathAt: 0, bathDate: localDayKey(), bathsToday: 0, lastAffectionAt: 0, starvingSince: 0, hungerPenaltyHours: 0, weightTenthsJin: '10', lastPoopAt: Date.now() } },
  paused: false,
  soundMuted: false,
  soundVolume: 100,
  redeemedCodes: [],
  schemaVersion: 13,
  affection: { dakuan: 0 },
  kitchen: {
    ingredients: { wheat: 0, catnip: 0, carrot: 0, fish: 0, pumpkin: 0, chicken: 0, milk: 0, silverherb: 0, goldfish: 0 },
    pantry: { dog_biscuit: 3, catnip_kibble: 3, fish_feast: 0, fish_can: 1, silverherb_meal: 0, goldfish_can: 0 },
    pots: Array.from({ length: 6 }, () => ({ recipeId: null, startedAt: 0, doneAt: 0 })),
    lastIngredients: null
  },
  garden: { plots: Array.from({ length: 10 }, () => ({ cropId: null, plantedAt: 0, growthBonusMs: 0, lastWaterAt: 0, waterDate: localDayKey(), wateringsToday: 0 })) },
  droppings: [],
  compost: { poopCount: 0, rainbowPoopCount: 0, fertilizerCount: 0, pots: Array.from({ length: 5 }, () => ({ startedAt: 0, doneAt: 0 })), unlockedPots: 2, ordinarySinceRainbow: 0, nextRainbowAt: 50 + Math.floor(Math.random() * 51) },
  coins: 0,
  orders: { orders: [], nextRefreshAt: 0, dailyTasks: createDailyTaskBoard(Date.now()) },
  constipationMode: false,
  cosmetics: { owned: [], equipped: { bell: null, clothes: null, hat: null, scarf: null, tie: null }, shop: { stock: [], nextRefreshAt: 0 } },
  wardrobe: { owned: [], equipped: null, shop: { stock: [], nextRefreshAt: 0 } },
  restaurant: createRestaurantState(),
  alwaysOnTop: true
}

function getStatePath() { return join(app.getPath('userData'), 'pet-state.json') }

function loadPersistedState(): PersistedState {
  if (persisted) return persisted
  const file = getStatePath()
  const current = readStateFile(file)
  if (current && stateProgressScore(current) > 0) {
    persisted = current
    return persisted
  }
  const recoveryFiles = [
    `${file}.bak`,
    ...legacyStatePaths()
  ]
  const candidates = recoveryFiles
    .filter((candidate, index, all) => all.indexOf(candidate) === index && candidate.toLowerCase() !== file.toLowerCase())
    .map((candidate) => ({ file: candidate, state: readStateFile(candidate) }))
    .filter((candidate): candidate is { file: string; state: PersistedState } => Boolean(candidate.state))
    .sort((a, b) => stateProgressScore(b.state) - stateProgressScore(a.state))
  const recovery = candidates[0]
  if (recovery && (!current || stateProgressScore(recovery.state) > stateProgressScore(current))) {
    try {
      if (existsSync(file) && !existsSync(`${file}.recovered-backup`)) copyFileSync(file, `${file}.recovered-backup`)
      atomicWriteState(file, readFileSync(recovery.file, 'utf8'))
      persisted = recovery.state
      writeDiagnostic(`已从 ${recovery.file} 恢复桌宠存档；原存档保留在 pet-state.json.recovered-backup。`)
      return persisted
    } catch (error) { writeDiagnostic(`存档恢复失败：${error instanceof Error ? error.message : String(error)}`) }
  }
  if (current) persisted = current
  else {
    if (existsSync(file) && !existsSync(`${file}.corrupt-backup`)) {
      try { copyFileSync(file, `${file}.corrupt-backup`) } catch { /* Keep startup available if backup creation fails. */ }
    }
    persisted = structuredClone(initialState)
  }
  return persisted
}

function savePersistedState(state: PersistedState) {
  persisted = state
  try {
    const file = getStatePath()
    writeStateFile(file, state)
  } catch (error) { writeDiagnostic(`保存宠物状态失败：${error instanceof Error ? error.message : String(error)}`) }
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('state:changed', state)
  applyAlwaysOnTop(state.alwaysOnTop !== false)
  updateTrayMenu()
}

function desktopInfo(): DesktopInfo {
  const displays = screen.getAllDisplays()
  const minX = Math.min(...displays.map(({ bounds }) => bounds.x))
  const minY = Math.min(...displays.map(({ bounds }) => bounds.y))
  const maxX = Math.max(...displays.map(({ bounds }) => bounds.x + bounds.width))
  const maxY = Math.max(...displays.map(({ bounds }) => bounds.y + bounds.height))
  return {
    origin: { x: minX, y: minY }, width: maxX - minX, height: maxY - minY,
    displays: displays.map(({ workArea }) => ({ x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height }))
  }
}

function updateTrayMenu() {
  if (!tray) return
  const state = loadPersistedState()
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: state.paused ? '继续活动' : '暂停活动', click: () => { state.paused = !state.paused; savePersistedState(state); petWindow?.webContents.send('state:changed', state) } },
    { label: state.soundMuted ? '打开大款叫声' : '静音大款', click: () => { state.soundMuted = !state.soundMuted; savePersistedState(state); petWindow?.webContents.send('state:changed', state) } },
    { label: state.alwaysOnTop === false ? '📌 置顶桌宠' : '📍 取消置顶', click: () => savePersistedState({ ...state, alwaysOnTop: state.alwaysOnTop === false }) },
    { type: 'separator' },
    { label: '退出桌宠', click: () => app.quit() }
  ]))
}

function createTray() {
  const image = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVQ4T2NkYGD4z0AEYBxVSFUBCjAqgCKAEQkYgAIAAP//R7oCAWzgMLcAAAAASUVORK5CYII=')
  tray = new Tray(image)
  tray.setToolTip('大款桌宠')
  updateTrayMenu()
  tray.on('click', () => {
    if (!petWindow) createWindow()
    else petWindow.showInactive()
  })
}

function createWindow() {
  const info = desktopInfo()
  petWindow = new BrowserWindow({
    x: info.origin.x, y: info.origin.y, width: info.width, height: info.height,
    show: false, frame: false, transparent: true, backgroundColor: '#00000000',
    alwaysOnTop: loadPersistedState().alwaysOnTop !== false, skipTaskbar: true, resizable: false, movable: false, focusable: true,
    hasShadow: false, webPreferences: {
      preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  })
  applyAlwaysOnTop(loadPersistedState().alwaysOnTop !== false)
  petWindow.setIgnoreMouseEvents(true, { forward: true })
  let shown = false
  const showPet = () => {
    if (shown || !petWindow || petWindow.isDestroyed()) return
    shown = true
    petWindow.showInactive()
  }
  // `ready-to-show` may never fire on some graphics drivers. A successful local
  // page load is sufficient to reveal the window, with a timed fallback as well.
  petWindow.once('ready-to-show', showPet)
  petWindow.webContents.once('did-finish-load', showPet)
  const startupFallback = setTimeout(() => {
    if (!shown) {
      writeDiagnostic('启动窗口等待页面完成超时，使用备用显示路径。')
      showPet()
    }
  }, 8000)
  petWindow.once('show', () => clearTimeout(startupFallback))
  petWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return
    writeDiagnostic(`页面加载失败：${errorCode} ${errorDescription} ${validatedURL}`)
    dialog.showErrorBox('大款桌宠无法显示', `桌宠界面加载失败（${errorCode}）。\n\n${errorDescription}\n\n诊断日志保存在 %APPDATA%\\DakuanDesktopPet\\logs\\startup.log。`)
    app.quit()
  })
  petWindow.webContents.on('render-process-gone', (_event, details) => {
    writeDiagnostic(`界面进程退出：${details.reason}，退出码 ${details.exitCode}`)
    if (details.reason !== 'clean-exit') {
      dialog.showErrorBox('大款桌宠界面异常', '桌宠界面未能正常运行。诊断日志已保存到 %APPDATA%\\DakuanDesktopPet\\logs\\startup.log。')
      app.quit()
    }
  })
  petWindow.on('blur', () => {
    if (!petWindow || petWindow.isDestroyed()) return
    petWindow.setIgnoreMouseEvents(true, { forward: true })
    petWindow.webContents.send('pointer:released')
  })
  petWindow.on('focus', () => applyAlwaysOnTop(loadPersistedState().alwaysOnTop !== false))
  petWindow.on('show', () => applyAlwaysOnTop(loadPersistedState().alwaysOnTop !== false))
  petWindow.on('restore', () => applyAlwaysOnTop(loadPersistedState().alwaysOnTop !== false))
  if (process.env.ELECTRON_RENDERER_URL) petWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else petWindow.loadFile(join(__dirname, '../renderer/index.html'))
  petWindow.on('closed', () => { petWindow = null })

  screen.on('display-added', resizeOverlay)
  screen.on('display-removed', resizeOverlay)
  screen.on('display-metrics-changed', resizeOverlay)
}

function resizeOverlay() {
  if (!petWindow) return
  const info = desktopInfo()
  petWindow.setBounds({ x: info.origin.x, y: info.origin.y, width: info.width, height: info.height })
  petWindow.webContents.send('desktop:changed', info)
}

app.whenReady().then(() => {
  writeDiagnostic(`启动应用：Electron ${process.versions.electron}，Windows ${process.getSystemVersion()}，架构 ${process.arch}。`)
  loadPersistedState()
  ipcMain.handle('state:load', () => loadPersistedState())
  ipcMain.on('state:save', (_event, state: PersistedState) => savePersistedState(state))
  ipcMain.handle('desktop:info', () => desktopInfo())
  ipcMain.on('state:paused', (_event, paused: boolean) => {
    const current = loadPersistedState()
    const now = Date.now()
    savePersistedState({ ...current, paused, pets: { dakuan: { ...current.pets.dakuan, lastUpdated: now } } })
  })
  ipcMain.on('state:muted', (_event, soundMuted: boolean) => savePersistedState({ ...loadPersistedState(), soundMuted }))
  ipcMain.on('pointer:active', (_event, active: boolean) => {
    if (petWindow && !petWindow.isDestroyed()) petWindow.setIgnoreMouseEvents(!active, { forward: true })
  })
  ipcMain.on('app:quit', () => app.quit())
  createTray()
  createWindow()
})

app.on('window-all-closed', () => {})
app.on('before-quit', () => { if (tray && !tray.isDestroyed()) tray.destroy() })
