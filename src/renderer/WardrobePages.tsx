import { useState } from 'react'
import type { OutfitId, PetAction, WardrobeState } from '../shared/types'
import { OUTFIT_ATLASES, PetCharacter, type PetVisualStyle } from './PetCharacter'
import { outfitById, OUTFITS } from './outfits'

function prettyRemaining(milliseconds: number) {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000))
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}`
}

export function WardrobePage({ state, action, facingLeft, visualStyle, paused, onEquip }: {
  state: WardrobeState
  action: PetAction
  facingLeft: boolean
  visualStyle: PetVisualStyle
  paused: boolean
  onEquip: (id: OutfitId | null) => void
}) {
  const current = outfitById(state.equipped)
  const owned = OUTFITS.filter((item) => state.owned.includes(item.id))
  const achievementOutfits = OUTFITS.filter((item) => item.unlock && item.unlock !== 'poop-500')

  return <div className="wardrobe-layout">
    <section className="wardrobe-inventory" aria-label="整套衣服仓库">
      <div className="wardrobe-section-heading"><div><b>我的穿搭</b><small>已收藏 {owned.length} / {OUTFITS.length} 套</small></div><span>点击整套换装</span></div>
      <div className="outfit-unlock-guide" aria-label="成就服装解锁条件">
        {achievementOutfits.map((item) => <div key={item.id} className={state.owned.includes(item.id) ? 'unlocked' : ''}><span>{item.icon}</span><b>{item.name}</b><small>{item.unlock === 'affection-7' ? '亲密度达到 Lv.7' : '体重达到 1 吨'}</small><strong>{state.owned.includes(item.id) ? '已解锁' : '未解锁'}</strong></div>)}
        <div className={state.owned.includes('poop-pudding') ? 'unlocked' : ''}><span>💩</span><b>便便布丁团</b><small>商店用 500 个普通便便兑换</small><strong>{state.owned.includes('poop-pudding') ? '已兑换' : '可兑换'}</strong></div>
      </div>
      <div className="wardrobe-item-grid outfit-item-grid">
        <button className={`wardrobe-item outfit-item ${state.equipped === null ? 'equipped' : ''}`} onClick={() => onEquip(null)} title="穿回大款的日常样子"><span className="wardrobe-item-art outfit-art" style={{ backgroundImage: `url(${OUTFIT_ATLASES['gentleman-red']})`, filter: 'grayscale(1) opacity(.45)' }} /><b>日常原样</b><small>{state.equipped === null ? '正在穿着' : '换回原本的样子'}</small></button>
        {owned.map((item) => <button key={item.id} className={`wardrobe-item outfit-item ${state.equipped === item.id ? 'equipped' : ''}`} onClick={() => onEquip(item.id)} title={item.description}><span className="wardrobe-item-art outfit-art" style={{ backgroundImage: `url(${OUTFIT_ATLASES[item.id]})` }} /><b>{item.icon} {item.name}</b><small>{state.equipped === item.id ? '正在穿着' : item.description}</small></button>)}
      </div>
      {owned.length === 0 && <div className="wardrobe-empty outfit-empty"><span>🧺</span><b>衣柜里还没有新穿搭</b><small>先去装扮商店挑一套吧。</small></div>}
    </section>
    <section className="wardrobe-preview" aria-label="大款穿搭预览">
      <div className="wardrobe-preview-heading"><div><b>穿搭预览</b><small>{current?.name ?? '大款的日常样子'}</small></div><span className="preview-live-dot">实时</span></div>
      <div className="wardrobe-cat-stage"><span className="preview-sparkle sparkle-one">✦</span><span className="preview-sparkle sparkle-two">✧</span><span className="preview-ground" /><span className="wardrobe-cat-sizer"><PetCharacter id="dakuan" action={action} facingLeft={facingLeft} visualStyle={visualStyle} outfit={state.equipped} freezeFrames={paused} /></span></div>
      <div className="wardrobe-outfit-story"><b>{current ? `大款的「${current.name}」小故事` : '大款的日常小故事'}</b><p>{current?.story ?? '不穿新衣服的时候，大款最喜欢找个舒服的位置趴好，等着你来陪它玩。'}</p><small>动作与桌面上的大款同步播放，换装后立即更新。</small></div>
    </section>
  </div>
}

export function OutfitStorePage({ state, coins, poopCount, now, onBuy, onRedeemPoop }: {
  state: WardrobeState
  coins: number
  poopCount: number
  now: number
  onBuy: (id: OutfitId) => boolean
  onRedeemPoop: () => boolean
}) {
  const [notice, setNotice] = useState('')
  const refreshIn = prettyRemaining(state.shop.nextRefreshAt - now)
  const items = state.shop.stock.map((id) => outfitById(id)).filter((item): item is NonNullable<typeof item> => Boolean(item))
  const poopOutfit = outfitById('poop-pudding')!
  const ownsPoopOutfit = state.owned.includes(poopOutfit.id)
  return <section className="cosmetic-store-dialog outfit-store-dialog outfit-store-page" aria-label="装扮商店">
      <header className="cosmetic-store-header"><div><span className="activity-kicker">ROTATING OUTFITS</span><h2>大款装扮商店</h2><p>每 5 小时随机上架 4 套未拥有的整套穿搭。</p></div><div className="cosmetic-store-balance"><span>我的金币</span><b>🪙 {coins}</b></div></header>
      <div className="cosmetic-store-refresh">⏳ 下次上新：{refreshIn} 后 <span>买下整套后就会放进衣服仓库</span></div>
      {items.length ? <div className="cosmetic-store-grid outfit-store-grid">{items.map((item) => <article className="cosmetic-store-item outfit-store-item" key={item.id}><div className="cosmetic-store-item-top"><span className="cosmetic-store-art outfit-art" style={{ backgroundImage: `url(${OUTFIT_ATLASES[item.id]})` }} /><b>{item.icon} {item.name}</b></div><p>{item.description}</p><div className="cosmetic-store-buy-row"><b>🪙 {item.price}</b><button disabled={coins < item.price} onClick={() => { if (onBuy(item.id)) setNotice(`${item.name} 已放进衣服仓库。`) }}>{coins < item.price ? '金币不足' : '购买整套'}</button></div></article>)}</div>
        : <div className="cosmetic-shop-empty"><span>✨</span><b>金币商店的常规穿搭已集齐</b><small>成就服装会按条件解锁，便便主题装可在下方兑换。</small></div>}
      <article className="cosmetic-store-item poop-outfit-redemption"><div className="cosmetic-store-item-top"><span className="cosmetic-store-art outfit-art" style={{ backgroundImage: `url(${OUTFIT_ATLASES[poopOutfit.id]})` }} /><b>{poopOutfit.icon} {poopOutfit.name}</b></div><p>{poopOutfit.description} 焦糖色团子服配小绿叶，专属便便纪念款。</p><div className="cosmetic-store-buy-row"><b>💩 普通便便 {ownsPoopOutfit ? '已兑换' : `${poopCount} / 500`}</b><button disabled={ownsPoopOutfit || poopCount < 500} onClick={() => { if (onRedeemPoop()) setNotice(`${poopOutfit.name} 已兑换并放进衣服仓库。`) }}>{ownsPoopOutfit ? '已拥有' : poopCount < 500 ? '便便不足' : '兑换整套'}</button></div></article>
      {notice && <div className="cosmetic-purchase-notice">{notice}</div>}
      <footer className="cosmetic-store-footer"><span>整套穿搭自带对应动作，保证动画同步；购买后可在“穿搭”页换上。</span></footer>
    </section>
}
