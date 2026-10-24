import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { RestaurantAction, RestaurantCustomer, RestaurantMachine, RestaurantOrder, RestaurantState, RestaurantStock, RestaurantTray, WrapIngredient } from '../shared/restaurant'
import { dailyGoal, drinkSeconds, fryBatch, frySeconds, grillSeconds, INGREDIENT_LABELS, isRestaurantServing, meatClicks, nextOpeningDay, seatCount, SERVICE_SECONDS, trayCount, UPGRADE_DEFS } from '../shared/restaurant'
import { PetCharacter } from './PetCharacter'
import './restaurant.css'

const ICONS: Record<RestaurantStock, string> = { bread: '🫓', meat: '🥩', fries: '🍟', pickles: '🥒', sauce: '🥣', soda: '🥤', juice: '🍊' }
const WRAP_ITEMS: WrapIngredient[] = ['meat', 'fries', 'pickles', 'sauce']
const timeText = (seconds: number) => { const total = Math.ceil(Math.max(0, seconds)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}` }

/** Small original vector characters keep all customers crisp at every panel size. */
function CafeCat({ appearance = 0, thief = false, happy = false }: { appearance?: number; thief?: boolean; happy?: boolean }) {
  const colors = [['#d7b994', '#6d4c3e'], ['#e6a35c', '#be7540'], ['#ede5d6', '#b8b2a4'], ['#8d9597', '#535b61'], ['#5b5558', '#353137'], ['#f5d9c7', '#b99885']][appearance % 6]
  return <svg className={`cafe-cat ${happy ? 'happy' : ''}`} viewBox="0 0 160 140" role="img" aria-label={thief ? '戴面罩的捣蛋小猫' : '来大款餐厅吃饭的小猫'}>
    <ellipse cx="80" cy="130" rx="49" ry="7" fill="#45362c" opacity=".1" />
    <path d="M33 119C8 121 8 87 23 87c10 0 3 14 13 15" fill="none" stroke={colors[1]} strokeWidth="12" strokeLinecap="round" />
    <ellipse cx="80" cy="111" rx="39" ry="24" fill={colors[0]} />
    <path d="m35 54-3-39q3-11 34 14m29 0q31-25 34-14l-4 42" fill={colors[1]} stroke="#55443b" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="m40 42-1-18 17 13m49 0 16-13-2 20" fill="#d9a399" />
    <ellipse cx="80" cy="65" rx="51" ry="44" fill={colors[0]} stroke="#735c4b" strokeWidth="2" />
    {appearance === 0 && <path d="M53 40q27-17 54 0l6 35q-32 35-65 0Z" fill={colors[1]} opacity=".9" />}
    {appearance === 1 && <g stroke={colors[1]} strokeWidth="6" strokeLinecap="round"><path d="m65 27 4 12m11-14v12m15-10-5 12" /><path d="m33 62 12 3m80-3-12 3" /></g>}
    {appearance === 4 && <path d="M78 28 87 78 75 87 65 78Z" fill="#f1e4d6" />}
    {thief && <path d="M30 55q50-17 100 0v24q-50 11-100 0Z" fill="#374249" />}
    {happy ? <g fill="none" stroke="#3e3331" strokeWidth="4" strokeLinecap="round"><path d="M48 65q9-10 18 0m28 0q9-10 18 0" /></g> : <g><ellipse cx="57" cy="64" rx="10" ry="12" fill={appearance === 0 ? '#94cfe6' : '#c5d391'} /><ellipse cx="103" cy="64" rx="10" ry="12" fill={appearance === 0 ? '#94cfe6' : '#c5d391'} /><ellipse cx="58" cy="65" rx="5" ry="9" fill="#313438" /><ellipse cx="102" cy="65" rx="5" ry="9" fill="#313438" /><circle cx="54" cy="60" r="3" fill="white" /><circle cx="99" cy="60" r="3" fill="white" /></g>}
    <ellipse cx="68" cy="83" rx="13" ry="10" fill="#f4e7d6" /><ellipse cx="92" cy="83" rx="13" ry="10" fill="#f4e7d6" />
    <path d="m74 78 6 6 6-6q-6-5-12 0" fill="#71514e" /><path d="M80 83v5m0-1q-6 6-11 0m11 0q6 6 11 0" fill="none" stroke="#71514e" strokeWidth="1.8" strokeLinecap="round" />
    <g stroke="#ae9786" strokeWidth="1.4" strokeLinecap="round"><path d="m45 80-23-4m23 10-24 3m94-9 23-4m-23 10 24 3" /></g>
    <ellipse cx="57" cy="126" rx="15" ry="8" fill="#f9ecdb" /><ellipse cx="104" cy="126" rx="15" ry="8" fill="#f9ecdb" />
    {thief && <path d="m51 108 29-12 30 12-30 17Z" fill="#5c6a58" />}
  </svg>
}

function WrapArt({ tray }: { tray: RestaurantTray }) {
  const folded = ['wrapped', 'grilling', 'grilled', 'burnt'].includes(tray.stage)
  return <svg className="cafe-wrap-art" viewBox="0 0 240 160" role="img" aria-label={tray.stage === 'empty' ? '空备餐盘' : '当前制作的卷饼'}>
    <ellipse cx="120" cy="106" rx="104" ry="41" fill="#d4d2bf" opacity=".35" /><ellipse cx="120" cy="98" rx="104" ry="41" fill="#fffdfa" stroke="#e0dfcc" strokeWidth="3" />
    {tray.stage === 'empty' ? <g fill="#d0c9b6"><circle cx="107" cy="91" r="5" /><circle cx="121" cy="85" r="5" /><circle cx="134" cy="91" r="5" /><path d="M109 105q12-28 25 0Z" /></g> : folded ? <g transform="rotate(-12 120 80)">
      <path d="m64 53 108 7 8 48q-57 35-114-3Z" fill={tray.stage === 'burnt' ? '#6e4932' : '#e8c487'} stroke="#b68c53" strokeWidth="2" />
      <ellipse cx="118" cy="59" rx="54" ry="18" fill="#b9804d" />
      <path d="m75 57 18-8 13 9 22-8 16 12 17-4" fill="none" stroke="#7f4d32" strokeWidth="9" />
      {tray.ingredients.includes('fries') && <g stroke="#f6ce6b" strokeWidth="6" strokeLinecap="round"><path d="m94 60-4-15m25 16 5-18m22 16 1-14" /></g>}
      {tray.ingredients.includes('pickles') && <g fill="#7d9a50"><ellipse cx="80" cy="59" rx="9" ry="4" /><ellipse cx="134" cy="57" rx="9" ry="5" /></g>}
      {tray.ingredients.includes('sauce') && <path d="m88 60 13-5 15 7 16-4 16 4" fill="none" stroke="#fff1cf" strokeWidth="4" strokeLinecap="round" />}
      <path d="M69 87q55 31 106 0l5 21q-57 35-114-3Z" fill="#f8f4e9" /><path d="m104 96 16 7 16-7" fill="none" stroke="#7d9872" strokeWidth="3" />
      {tray.stage === 'grilled' && <g stroke="#97633e" strokeWidth="3" opacity=".8"><path d="m86 72 12 15m16-17 10 18m17-17 8 13" /></g>}
    </g> : <g>
      <ellipse cx="120" cy="86" rx="74" ry="36" fill="#eed09a" stroke="#c8a66b" strokeWidth="2" />
      {tray.ingredients.includes('meat') && <g fill="#a96540" stroke="#7f4c31" strokeWidth="1"><path d="m68 78 32-16 25 10-20 18Z" /><path d="m113 84 29-18 27 13-24 19Z" /><path d="m89 99 26-16 27 10-17 16Z" /></g>}
      {tray.ingredients.includes('fries') && <g stroke="#f4bd4f" strokeWidth="7" strokeLinecap="round"><path d="m87 77 51 16m-34-25 49 19m-66 7 44 13" /></g>}
      {tray.ingredients.includes('pickles') && <g fill="#799c50" stroke="#567535" strokeWidth="1.5"><ellipse cx="83" cy="87" rx="12" ry="5" /><ellipse cx="141" cy="75" rx="12" ry="5" /><ellipse cx="144" cy="100" rx="12" ry="5" /></g>}
      {tray.ingredients.includes('sauce') && <path d="m76 78 65 21-43-26 65 18" stroke="#fff7e7" strokeWidth="5" fill="none" strokeLinecap="round" />}
    </g>}
    {tray.fries && <g><path d="m176 104 30-1-4 30-21-1Z" fill="#d17b57" /><g stroke="#efc364" strokeWidth="5"><path d="m180 108-3-24m12 23V79m8 28 5-24" /></g></g>}
    {tray.drink && <g><path d="m29 100 28 1-3 35H33Z" fill={tray.drink === 'juice' ? '#eab655' : '#759e8d'} /><ellipse cx="43" cy="100" rx="15" ry="4" fill="#f6f3e3" /><path d="m43 100 6-29 8-3" fill="none" stroke="#91694e" strokeWidth="3" /></g>}
  </svg>
}

function OrderContents({ order }: { order: RestaurantOrder }) {
  const omitted = WRAP_ITEMS.filter((id) => !order.ingredients.includes(id))
  return <>
    <b>{order.grilled ? '🔥 烤卷饼' : '🌯 经典卷饼'}</b>
    <span className="cafe-order-ingredients">{order.ingredients.map((id) => <span key={id}>{ICONS[id]} {INGREDIENT_LABELS[id]}</span>)}</span>
    {omitted.length > 0 && <strong className="cafe-omit">不要{omitted.map((id) => INGREDIENT_LABELS[id]).join('、')}</strong>}
    {(order.fries || order.drink) && <span className="cafe-order-extras">另加 {order.fries ? '🍟 一份薯条 ' : ''}{order.drink ? `${ICONS[order.drink]} ${INGREDIENT_LABELS[order.drink]}` : ''}</span>}
  </>
}

function Customer({ cat, selected, disabled, onAction }: { cat: RestaurantCustomer; selected: boolean; disabled: boolean; onAction: (action: RestaurantAction) => void }) {
  return <div className={`cafe-customer ${selected ? 'selected' : ''} ${cat.kind === 'thief' ? 'mischief' : ''}`}>
    <button className="cafe-order-bubble" disabled={disabled} onClick={() => onAction(cat.kind === 'thief' || cat.status === 'remind' ? { type: 'special', id: cat.id } : cat.status === 'payment' ? { type: 'collect-money', id: cat.id } : { type: 'select-customer', id: cat.id })}>
      {cat.kind === 'thief' ? <><b>捣蛋猫出没！</b><span>{cat.hasStolen ? `拿走了 ${cat.stolen} 金币` : '正盯着你的收款台'}</span><strong>点我赶走 · {cat.taps}/3</strong></> : cat.status === 'payment' ? <><b className="cafe-coin">🪙 {cat.payment}</b><span>谢谢款老板！</span><strong>点击收款</strong></> : cat.status === 'remind' ? <><b>哎呀，忘记付钱啦</b><span>点我提醒 · {cat.taps}/3</span></> : <OrderContents order={cat.order} />}
    </button>
    <button className="cafe-cat-trigger" aria-label={cat.kind === 'thief' ? '点击赶走捣蛋猫' : `选择${cat.name}的订单`} disabled={disabled} onClick={() => onAction(cat.kind === 'thief' || cat.status === 'remind' ? { type: 'special', id: cat.id } : cat.status === 'payment' ? { type: 'collect-money', id: cat.id } : { type: 'select-customer', id: cat.id })}><CafeCat appearance={cat.appearance} thief={cat.kind === 'thief'} happy={cat.status !== 'waiting'} /></button>
    <div className="cafe-customer-name">{cat.name}{selected && <small>正在为它备餐</small>}</div>
    {cat.status === 'waiting' && <div className={`cafe-patience ${cat.patience / cat.maxPatience < .3 ? 'urgent' : ''}`} role="progressbar" aria-label={`${cat.name}的耐心`} aria-valuemin={0} aria-valuemax={Math.ceil(cat.maxPatience)} aria-valuenow={Math.ceil(cat.patience)}><i style={{ width: `${cat.patience / cat.maxPatience * 100}%` }} /></div>}
  </div>
}

function MachineProgress({ machine, duration, label }: { machine: RestaurantMachine; duration: number; label: string }) {
  return <div className={`cafe-machine-progress ${machine.stage}`}><i style={{ width: `${machine.stage === 'idle' ? 0 : machine.stage !== 'working' ? 100 : (1 - machine.remaining / duration) * 100}%` }} /><span>{machine.stage === 'working' ? `${label} ${Math.ceil(machine.remaining)}s` : machine.stage === 'ready' ? '做好了，点击取出' : machine.stage === 'burnt' ? '焦了，点击清理' : '空闲'}</span></div>
}

function Equipment({ state, coins, onAction }: { state: RestaurantState; coins: number; onAction: (action: RestaurantAction) => void }) {
  const busy = isRestaurantServing(state)
  return <div className="cafe-equipment">
    <div className="cafe-section-note">营业前后升级设备。餐厅与买衣服使用同一份金币，购买会立即扣款并保存。</div>
    <div className="cafe-upgrade-grid">{UPGRADE_DEFS.map((def) => {
      const level = state.upgrades[def.id]
      const price = def.prices[level]
      const locked = nextOpeningDay(state) < def.days[level]
      return <article className="cafe-upgrade" key={def.id}><span className="cafe-upgrade-icon">{def.icon}</span><div><h3>{def.name} <small>Lv.{level}/{def.prices.length}</small></h3><p>{price === undefined ? def.effects.at(-1) : def.effects[level]}</p><div className="cafe-upgrade-levels">{def.prices.map((_, i) => <i key={i} className={i < level ? 'filled' : ''} />)}</div></div><button disabled={busy || price === undefined || locked || coins < price} onClick={() => onAction({ type: 'upgrade', id: def.id })}>{price === undefined ? '已升满' : locked ? `第 ${def.days[level]} 天解锁` : busy ? '打烊后升级' : `🪙 ${price} · 升级`}</button></article>
    })}</div>
  </div>
}

function CafeGuide() {
  return <div className="cafe-guide">
    <h3>款老板的开店手册</h3>
    <ol><li><b>备料：</b>点击烤肉 3 次出一批；土豆切 3 次，再点下锅。薯条炸好后及时取出。</li><li><b>组装：</b>铺饼皮 → 按顾客气泡加配料 → 卷起来。气泡写“不要”的配料不能放。</li><li><b>套餐：</b>“另加薯条”是盘边的小食，和饼里的薯条分开；饮料先装杯、取出，再放进餐盘。</li><li><b>烤卷饼：</b>卷好后放入烤饼机，烤好要点击取出；普通卷饼订单不需要烤。</li><li><b>出餐收钱：</b>点选顾客，再点“出餐”；点击顾客留下的金币，钱才进入共用余额。</li></ol>
    <div className="cafe-guide-grid"><section><h4>多线操作</h4><p>等薯条或饮料时可以做别的。升级出餐台可同时备多盘，点击餐盘编号切换。配错了可丢弃重做，不会扣金币。</p></section><section><h4>顾客与特殊访客</h4><p>耐心条耗尽，小猫会离开。第 2 天起偶遇迷糊猫，吃完点它 3 次提醒付款；第 3 天起可能有捣蛋猫，及时点 3 次，能追回被它拿走的金币。</p></section><section><h4>补货与猫咪员工</h4><p>基础原料每日免费备好，饼皮、酸黄瓜和酱汁用完可免费补货，需等 8 秒。雇用猫咪员工后，它会逐步学会补货、备肉和炸薯条。</p></section><section><h4>每天一小轮</h4><p>每轮迎客 3 分钟，之后最多再留 40 秒收尾。完成当天出餐目标奖励 20 金币。打烊时自动收好待收款；未做完的食物下轮清空。</p></section><section><h4>慢慢升级</h4><p>设备、套餐、饮料、烤饼机随营业天数和购买解锁。装修增加耐心和小费，小饼干每天 3 份，每位顾客限用一次。</p></section><section><h4>随时离开</h4><p>切换页面、关闭面板、窗口在后台或让大款休息时，餐厅计时暂停。退出后重新打开会先暂停营业，点击继续即可接着玩，不产生离线营业收入。</p></section></div>
  </div>
}

export default function RestaurantPage({ state, coins, globallyPaused, soundMuted, volume, eventMessage, onAction }: {
  state: RestaurantState; coins: number; globallyPaused: boolean; soundMuted: boolean; volume: number
  eventMessage: string
  onAction: (action: RestaurantAction) => { message?: string; sound?: 'tap' | 'cash' | 'ding' | 'wrong' }
}) {
  const [tab, setTab] = useState<'service' | 'equipment' | 'guide'>('service')
  const [notice, setNotice] = useState('欢迎来到大款餐厅，今天也一起认真做好每一份卷饼。')
  const [confirmEnd, setConfirmEnd] = useState(false)
  useEffect(() => { if (eventMessage) setNotice(eventMessage) }, [eventMessage])
  useEffect(() => { if (state.phase === 'summary') setConfirmEnd(false) }, [state.phase])
  const active = isRestaurantServing(state)
  const disabled = !active || state.paused || globallyPaused
  const selectedCat = state.customers.find((cat) => cat.id === state.selectedCustomer)
  const tray = state.trays[state.selectedTray]
  const action = (next: RestaurantAction) => {
    const result = onAction(next)
    if (result.message) setNotice(result.message)
    if (!soundMuted && volume > 0 && result.sound) playCafeSound(result.sound, volume)
  }
  const changeTab = (next: typeof tab) => {
    if (next !== 'service' && active && !state.paused) action({ type: 'pause' })
    setTab(next); setConfirmEnd(false)
  }
  return <div className="restaurant-page">
    <div className="cafe-topline"><div><span className="cafe-day-pill">第 {state.day} 天</span><span>{state.phase === 'ready' ? '准备开张' : state.phase === 'summary' ? '今日打烊' : state.phase === 'closing' ? '最后一轮出餐' : '欢迎光临，喵！'}</span></div><strong className="cafe-wallet">🪙 {coins.toLocaleString('zh-CN')} <small>共用金币</small></strong></div>
    <nav className="cafe-tabs" aria-label="餐厅页面"><button aria-pressed={tab === 'service'} onClick={() => changeTab('service')}>营业间</button><button aria-pressed={tab === 'equipment'} onClick={() => changeTab('equipment')}>店铺升级</button><button aria-pressed={tab === 'guide'} onClick={() => changeTab('guide')}>开店手册</button></nav>
    {tab === 'equipment' ? <Equipment state={state} coins={coins} onAction={action} /> : tab === 'guide' ? <CafeGuide /> : <>
      {!active ? <div className="cafe-lobby">
        <div className="cafe-shopfront"><div className="cafe-window"><span>慢慢做，好好吃</span></div><div className="cafe-awning" /><div className="cafe-sign"><small>猫咪们的小食光</small><b>大款餐厅</b><span>现烤卷饼 · 薯条 · 饮料</span></div><div className="cafe-owner"><PetCharacter id="dakuan" action="idle" outfit="chef" visualStyle="illustrated" freezeFrames /></div><div className="cafe-lobby-plant">🪴</div><div className="cafe-front-counter"><span>款老板，今天也请多指教</span></div></div>
        {state.phase === 'summary' && state.lastReport ? <section className="cafe-report"><div className="cafe-report-heading"><b>第 {state.lastReport.day} 天营业小记</b><span>{state.lastReport.served >= state.lastReport.goal ? '✦ 今日目标达成' : '明天再接再厉'}</span></div><div className="cafe-report-numbers"><span><strong>{state.lastReport.served}</strong>份成功出餐</span><span><strong>+{state.lastReport.earned}</strong>金币收入 <small>含小费 {state.lastReport.tips}</small></span><span><strong>+{state.lastReport.bonus}</strong>目标奖励</span></div><p>离开的顾客 {state.lastReport.lost} 位 · 损耗 {state.lastReport.wasted} 份 · 赶走捣蛋猫 {state.lastReport.caught} 次{state.lastReport.stolen > 0 ? ` · 未追回金币 ${state.lastReport.stolen}` : ''}。金币已保存，无需再次领取。</p></section> : <div className="cafe-welcome"><h3>从一张饼皮，开始今天的小生意</h3><p>切肉、炸薯条、卷好饼，递给等餐的小猫。攒下的金币可以升级小店，也可以买喜欢的衣服。</p><div className="cafe-opening-steps"><span><b>01</b> 手动备料</span><span><b>02</b> 按单制作</span><span><b>03</b> 出餐收钱</span><span><b>04</b> 升级小店</span></div></div>}
        <div className="cafe-open-row"><div><b>今日目标：完成 {dailyGoal(state.phase === 'summary' ? state.day + 1 : state.day)} 单</b><small>迎客 3 分钟 · 达标额外 +20 金币 · 基础原料免费补充</small></div><button className="cafe-primary" disabled={globallyPaused} onClick={() => action({ type: 'start' })}>{state.phase === 'summary' ? `开始第 ${state.day + 1} 天 →` : '开门营业 →'}</button></div>
        <div className="cafe-lifetime"><span>累计服务 <b>{state.lifetimeServed}</b> 位小猫</span><span>已营业 <b>{state.completedDays}</b> 天</span><button onClick={() => changeTab('equipment')}>去升级设备 ↗</button></div>
      </div> : <>
        <div className="cafe-shift-bar"><span className={state.phase === 'closing' ? 'closing' : ''}>◷ {state.phase === 'closing' ? `收尾 ${timeText(40 - state.closingElapsed)}` : timeText(SERVICE_SECONDS - state.elapsed)}</span><span>出餐 <b>{state.stats.served}/{dailyGoal(state.day)}</b></span><span>收入 <b>{state.stats.earned}</b></span><button onClick={() => action({ type: 'pause' })} disabled={globallyPaused}>{state.paused ? '▶ 继续营业' : 'Ⅱ 暂停'}</button><button onClick={() => setConfirmEnd(!confirmEnd)}>提前打烊</button></div>
        {confirmEnd && <div className="cafe-end-confirm" role="alert"><span>现在打烊会结束未完成订单，已赚金币保留。</span><button disabled={disabled} onClick={() => { action({ type: 'end' }); setConfirmEnd(false) }}>确认打烊</button><button onClick={() => setConfirmEnd(false)}>继续做饭</button></div>}
        {(state.paused || globallyPaused) && <div className="cafe-paused" role="status"><b>Ⅱ 营业已暂停</b><span>{globallyPaused ? '大款正在休息，点击下方“继续活动”后再营业。' : '顾客和机器都会等你，点击“继续营业”即可。'}</span></div>}
        <div className={`cafe-customer-room seats-${seatCount(state)}`} style={{ '--cafe-seats': seatCount(state) } as CSSProperties}>
          {Array.from({ length: seatCount(state) }, (_, index) => state.customers[index] ? <Customer key={state.customers[index].id} cat={state.customers[index]} selected={state.customers[index].id === state.selectedCustomer} disabled={disabled} onAction={action} /> : <div className="cafe-empty-seat" key={`empty-${index}`}><span>✧</span><small>{state.phase === 'closing' ? '明天见，喵' : '等待下一位小猫'}</small></div>)}
        </div>
        <div className="cafe-counter-edge"><span>现做现卖 · 每一份都用心</span>{state.upgrades.helper > 0 && <span>🐱 员工 Lv.{state.upgrades.helper} · {Math.ceil(state.helperIn)} 秒后备料</span>}</div>
        <div className={`cafe-workbench ${disabled ? 'inactive' : ''}`}>
          <section className="cafe-prep"><h3><span>01</span> 备料台 <small>点击准备</small></h3>
            <div className="cafe-prep-pair"><button className="cafe-meat-station" disabled={disabled} onClick={() => action({ type: 'slice-meat' })}><span className="cafe-meat-spit"><i /><i /><i /><i /><i /><i /></span><b>切烤肉</b><small>{state.meatCuts}/{meatClicks(state)} 刀 · 现有 {state.stock.meat} 份</small></button><button className="cafe-potato-station" disabled={disabled} onClick={() => action({ type: 'cut-potato' })}><span className="cafe-potato-art">🥔<i>🔪</i></span><b>切土豆</b><small>{state.potatoCuts}/3 刀 · 生薯条 {state.rawFries} 批</small></button></div>
            <div className="cafe-machine-box"><div><b>🍟 炸锅</b><small>每锅 {fryBatch(state)} 份 · {frySeconds(state)} 秒</small></div><MachineProgress machine={state.fryer} duration={frySeconds(state)} label="油炸中" /><button disabled={disabled || state.fryer.stage === 'working' || state.fryer.stage === 'idle' && state.rawFries === 0} onClick={() => action({ type: state.fryer.stage === 'ready' || state.fryer.stage === 'burnt' ? 'collect-fries' : 'fry' })}>{state.fryer.stage === 'ready' ? '取出薯条' : state.fryer.stage === 'burnt' ? '清理炸锅' : state.fryer.stage === 'working' ? '滋滋滋…' : '生薯条下锅'}</button></div>
            <div className="cafe-restock-label">免费补货 <small>补充需要 8 秒</small></div><div className="cafe-restocks">{(['bread', 'pickles', 'sauce'] as const).map((item) => <button key={item} disabled={disabled || Boolean(state.restocking[item]) || state.stock[item] >= (item === 'bread' ? 12 : 10)} onClick={() => action({ type: 'restock', item })}>{ICONS[item]} {INGREDIENT_LABELS[item]}<small>{state.restocking[item] ? `${Math.ceil(state.restocking[item]!)}s` : `${state.stock[item]} · 补货`}</small></button>)}</div>
          </section>
          <section className="cafe-assembly"><h3><span>02</span> 备餐盘 <div className="cafe-tray-tabs">{Array.from({ length: trayCount(state) }, (_, index) => <button key={index} disabled={disabled} aria-pressed={index === state.selectedTray} onClick={() => action({ type: 'select-tray', index })}>{index + 1}{state.trays[index].stage !== 'empty' ? '·' : ''}</button>)}</div></h3>
            <div className="cafe-selected-order">{selectedCat ? <><b>给 {selectedCat.name}</b><span>{selectedCat.order.grilled ? '烤卷饼' : '卷饼'}{selectedCat.order.fries ? ' + 额外薯条' : ''}{selectedCat.order.drink ? ` + ${INGREDIENT_LABELS[selectedCat.order.drink]}` : ''}</span></> : <span>点击上方小猫，选中要服务的顾客</span>}</div>
            <WrapArt tray={tray} />
            <div className="cafe-tray-caption">{tray.stage === 'empty' ? '先铺一张饼皮' : tray.stage === 'open' ? tray.ingredients.length ? tray.ingredients.map((id) => INGREDIENT_LABELS[id]).join(' · ') : '按订单加入配料' : tray.stage === 'grilling' ? '卷饼在烤饼机里' : tray.stage === 'burnt' ? '烤焦啦，请丢弃重做' : tray.stage === 'grilled' ? '烤卷饼准备好了' : '卷饼准备好了'}</div>
            <div className="cafe-ingredients">{WRAP_ITEMS.map((item) => <button disabled={disabled || tray.stage !== 'open' || tray.ingredients.includes(item) || state.stock[item] < 1} className={tray.ingredients.includes(item) ? 'added' : ''} key={item} onClick={() => action({ type: 'ingredient', ingredient: item })}><span>{ICONS[item]}</span><b>{INGREDIENT_LABELS[item]}</b><small>{tray.ingredients.includes(item) ? '✓ 已加' : `×${state.stock[item]}`}</small></button>)}</div>
            <div className="cafe-assembly-actions"><button disabled={disabled || tray.stage !== 'empty' || state.stock.bread < 1} onClick={() => action({ type: 'bread' })}>① 铺饼皮</button><button disabled={disabled || tray.stage !== 'open' || !tray.ingredients.includes('meat')} onClick={() => action({ type: 'wrap' })}>② 卷起来</button><button className="cafe-serve" disabled={disabled || !selectedCat || !['wrapped', 'grilled'].includes(tray.stage)} onClick={() => action({ type: 'serve' })}>③ 出餐 →</button></div>
            <div className="cafe-tray-tools"><button disabled={disabled || tray.stage === 'empty' && !tray.fries && !tray.drink || state.grillTray === state.selectedTray} onClick={() => action({ type: 'trash' })}>清空餐盘</button>{state.upgrades.sweets > 0 && <button disabled={disabled || state.sweets === 0 || !selectedCat || selectedCat.sweetUsed} onClick={() => action({ type: 'sweet' })}>🍪 安抚顾客 ×{state.sweets}</button>}</div>
          </section>
          <section className="cafe-finish"><h3><span>03</span> 小食与饮料 <small>按需添加</small></h3>
            <div className={`cafe-machine-box ${!state.upgrades.grill ? 'locked' : ''}`}><div><b>🔥 烤饼机</b><small>{state.upgrades.grill ? `备餐盘 ${state.grillTray === null ? '—' : state.grillTray + 1}` : '第 2 天起在店铺升级解锁'}</small></div>{state.upgrades.grill > 0 && <MachineProgress machine={state.grill} duration={grillSeconds(state)} label="烘烤中" />}<button disabled={disabled || !state.upgrades.grill || state.grill.stage === 'working' || state.grill.stage === 'idle' && tray.stage !== 'wrapped'} onClick={() => action({ type: state.grill.stage === 'ready' || state.grill.stage === 'burnt' ? 'collect-grill' : 'grill' })}>{!state.upgrades.grill ? '尚未解锁' : state.grill.stage === 'ready' ? '取出烤卷饼' : state.grill.stage === 'burnt' ? '取出并清理' : state.grill.stage === 'working' ? '烘烤中…' : '将当前卷饼放入'}</button></div>
            <div className="cafe-drinks">{(['soda', 'juice'] as const).map((item) => {
              const locked = state.upgrades.drinks < (item === 'juice' ? 2 : 1)
              return <div className={`cafe-drink-machine ${locked ? 'locked' : ''}`} key={item}><span>{ICONS[item]}</span><b>{INGREDIENT_LABELS[item]}</b>{!locked && <MachineProgress machine={state[item]} duration={drinkSeconds(state)} label="装杯" />}<button disabled={disabled || locked || state[item].stage === 'working'} onClick={() => action({ type: 'drink', item })}>{locked ? '待升级' : state[item].stage === 'ready' ? '取出饮料' : state[item].stage === 'working' ? '装杯中…' : '开始装杯'}</button></div>
            })}</div>
            <div className="cafe-restock-label">套餐加餐 <small>放在盘边，不放进饼里</small></div><div className="cafe-sides">{(['fries', 'soda', 'juice'] as const).map((item) => <button disabled={disabled || state.stock[item] < 1 || (item === 'fries' ? tray.fries : Boolean(tray.drink))} key={item} onClick={() => action({ type: 'side', item })}>{ICONS[item]}<b>{INGREDIENT_LABELS[item]}</b><small>×{state.stock[item]}</small></button>)}</div>
          </section>
        </div>
      </>}
    </>}
    {globallyPaused && !active && <div className="cafe-paused">大款正在休息，点击下方“继续活动”后即可开店。</div>}
    <div className="cafe-notice" role="status"><span>🐾</span>{notice}</div>
  </div>
}

export function playCafeSound(kind: 'tap' | 'cash' | 'ding' | 'wrong', volume: number) {
  if (volume <= 0) return
  try {
    const audio = new AudioContext()
    const notes = kind === 'cash' ? [660, 880, 1100] : kind === 'ding' ? [720, 960] : kind === 'wrong' ? [220, 180] : [420]
    notes.forEach((frequency, index) => {
      const at = audio.currentTime + index * .07
      const tone = audio.createOscillator()
      const gain = audio.createGain()
      tone.type = 'sine'; tone.frequency.value = frequency
      gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(.035 * volume / 100, at + .01); gain.gain.exponentialRampToValueAtTime(.0001, at + .12)
      tone.connect(gain); gain.connect(audio.destination); tone.start(at); tone.stop(at + .13)
    })
    window.setTimeout(() => { void audio.close() }, 600)
  } catch { /* A silent machine must remain playable. */ }
}
