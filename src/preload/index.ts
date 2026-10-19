import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopPetApi, DesktopInfo, PersistedState } from '../shared/types'

const api: DesktopPetApi = {
  loadState: () => ipcRenderer.invoke('state:load') as Promise<PersistedState>,
  saveState: (state) => ipcRenderer.send('state:save', state),
  setPointerActive: (active) => ipcRenderer.send('pointer:active', active),
  getDesktopInfo: () => ipcRenderer.invoke('desktop:info') as Promise<DesktopInfo>,
  setPaused: (paused) => ipcRenderer.send('state:paused', paused),
  setSoundMuted: (soundMuted) => ipcRenderer.send('state:muted', soundMuted),
  quit: () => ipcRenderer.send('app:quit')
}

ipcRenderer.on('state:changed', (_event, state: PersistedState) => window.dispatchEvent(new CustomEvent('pet-state-changed', { detail: state })))
ipcRenderer.on('desktop:changed', (_event, info: DesktopInfo) => window.dispatchEvent(new CustomEvent('desktop-info-changed', { detail: info })))
ipcRenderer.on('pointer:released', () => window.dispatchEvent(new Event('desktop-pointer-released')))
contextBridge.exposeInMainWorld('desktopPets', api)
