import { useState } from 'react'
import type { PersistedState } from '../shared/types'
import { WELCOME_GIFT_ID } from '../shared/rewards'

export default function SettingsPage({ state, onVolume, onToggleMuted, onPreviewSound, onRedeem, onBack, onQuit }: {
  state: PersistedState
  onVolume: (volume: number) => void
  onToggleMuted: () => void
  onPreviewSound: () => void
  onRedeem: (code: string) => { success: boolean; message: string }
  onBack: () => void
  onQuit: () => void
}) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  return <div className="settings-page">
    <button className="settings-back" onClick={onBack}>← 返回宠物</button>
    <section className="settings-section" aria-label="声音设置">
      <div className="settings-section-heading"><b>声音</b><button aria-pressed={state.soundMuted} onClick={onToggleMuted}>{state.soundMuted ? '🔇 已静音' : '🔊 声音开启'}</button></div>
      <label className="volume-label" htmlFor="pet-volume">叫声音量 <strong>{state.soundVolume}%</strong></label>
      <input id="pet-volume" type="range" min="0" max="100" step="1" value={state.soundVolume} onChange={(event) => onVolume(Number(event.target.value))} />
      <div className="volume-actions"><small>{state.soundMuted ? '取消静音后使用此音量。' : '拖动滑块调节大款叫声的大小。'}</small><button disabled={state.soundMuted || state.soundVolume === 0} onClick={onPreviewSound}>试听</button></div>
    </section>
    <section className="settings-section" aria-label="礼包兑换">
      <div className="settings-section-heading"><b>兑换码</b>{state.redeemedCodes.includes(WELCOME_GIFT_ID) && <small>“大款”礼包已领取</small>}</div>
      <p>每份存档每个兑换码可领取一次，奖励会自动保存。</p>
      <form className="redeem-code-form" onSubmit={(event) => { event.preventDefault(); const next = onRedeem(code); setResult(next); if (next.success) setCode('') }}>
        <input aria-label="输入兑换码" placeholder="输入兑换码" value={code} maxLength={64} onChange={(event) => { setCode(event.target.value); setResult(null) }} />
        <button type="submit" disabled={!code.trim()}>兑换</button>
      </form>
      {result && <p className={`redeem-result ${result.success ? 'success' : ''}`} role="status">{result.message}</p>}
    </section>
    <button className="settings-quit" onClick={onQuit}>退出大款桌宠</button>
    <small className="settings-quit-note">与按 Esc 相同，退出前保存当前进度。</small>
  </div>
}
