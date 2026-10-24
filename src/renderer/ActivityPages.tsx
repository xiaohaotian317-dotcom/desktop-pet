import { useState } from 'react'
import type { CompostState, GardenPlotState, IngredientId, PetId, PersistedState, RecipeId, CropId } from '../shared/types'
import { CROPS, INGREDIENTS, RECIPES, cropGrowth, ingredientRecipeHint, localDayKey, orderRequirementLabel, orderRequirementStock, unlockedPlotCount } from './activities'
import kitchenBackground from './assets/rooms/kitchen-reference.png'
import gardenBackground from './assets/rooms/garden-reference.png'
import { isCookingPotUnlocked, POT_WEIGHT_UNLOCKS_TENTHS_JIN, unlockedCookingPotCount } from '../shared/kitchenProgression'

type Props = {
  page: 2 | 3 | 4 | 5
  petId: PetId
  state: PersistedState
  now: number
  onCook: (pot: number, recipe: RecipeId) => boolean
  onCollect: (pot: number) => void
  onCollectAllMeals: () => number
  onPlant: (plot: number, crop: CropId) => void
  onPlantAll: (crop: CropId) => number
  onWater: (plot: number) => void
  onHarvest: (plot: number) => void
  onHarvestAll: () => void
  onDig: (plot: number) => void
  onFertilize: (plot: number) => boolean
  onStartFertilizer: (pot: number) => boolean
  onCollectFertilizer: (pot: number) => boolean
  onUnlockFertilizerFactory: (payment: 'poop' | 'rainbow') => boolean
  onToggleConstipation: (enabled: boolean) => void
  onClaimOrder: (index: number) => boolean
  onClaimDailyTask: (index: number) => boolean
  weightTenthsJin: string
}

function prettyTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  if (seconds < 60) return `${seconds}秒`
  return `${Math.floor(seconds / 60)}分${seconds % 60 ? `${seconds % 60}秒` : ''}`
}

function IngredientChip({ id, count, selected, onClick }: { id: IngredientId; count: number; selected: boolean; onClick: () => void }) {
  const ingredient = INGREDIENTS.find((item) => item.id === id)!
  return <button className={`ingredient-chip ${selected ? 'selected' : ''}`} onClick={onClick} disabled={count < 1} title={`${ingredient.name} ×${count}`}>
    <span>{ingredient.icon}</span><b>{ingredient.name}</b><small>×{count}</small>
  </button>
}

function KitchenPage({ state, now, onCook, onCollect, onCollectAllMeals, weightTenthsJin }: Pick<Props, 'state' | 'now' | 'onCook' | 'onCollect' | 'onCollectAllMeals' | 'weightTenthsJin'>) {
  const [selected, setSelected] = useState<IngredientId[]>([])
  const [notice, setNotice] = useState('')
  const [showRecipeBook, setShowRecipeBook] = useState(false)
  const selectedRecipe = Object.entries(RECIPES).find(([, recipe]) => selected.length === 2 && recipe.ingredients.every((id) => selected.includes(id))) as [RecipeId, (typeof RECIPES)[RecipeId]] | undefined
  const weight = /^\d+$/u.test(weightTenthsJin) ? BigInt(weightTenthsJin) : 10n
  const unlockedPots = unlockedCookingPotCount(weight)
  const hasEmptyUnlockedPot = state.kitchen.pots.some((pot, index) => isCookingPotUnlocked(index, weight) && !pot.recipeId)
  const readyMeals = state.kitchen.pots.filter((pot) => pot.recipeId && pot.doneAt <= now).length
  const selectedCounts: Partial<Record<IngredientId, number>> = {}
  selected.forEach((id) => { selectedCounts[id] = (selectedCounts[id] ?? 0) + 1 })

  const chooseIngredient = (id: IngredientId) => {
    if (selected.length === 2) setSelected([id])
    else setSelected((items) => [...items, id])
  }
  const repeatLastCombo = () => {
    const last = state.kitchen.lastIngredients
    if (!last) return
    const recipe = (Object.entries(RECIPES) as [RecipeId, (typeof RECIPES)[RecipeId]][]).find(([, item]) => item.ingredients.every((ingredient) => last.includes(ingredient)))
    const emptyPot = state.kitchen.pots.findIndex((pot, index) => isCookingPotUnlocked(index, weight) && !pot.recipeId)
    if (!recipe || emptyPot < 0 || last.some((ingredient) => state.kitchen.ingredients[ingredient] < 1)) return
    if (onCook(emptyPot, recipe[0])) setNotice(`上次搭配已放进第 ${emptyPot + 1} 口锅。`)
    else setNotice('食材不足或没有空锅，暂时不能开煮。')
    window.setTimeout(() => setNotice(''), 1800)
  }

  return <div className="activity-page kitchen-page" style={{ backgroundImage: `linear-gradient(180deg, rgba(255,249,235,.20), rgba(255,249,235,.70) 48%, rgba(255,249,235,.97) 100%), url(${kitchenBackground})` }}>
    <div className="activity-summary"><span>第 3–6 口锅：20 斤 / 100 斤 / 500 斤 / 2 吨解锁</span><span className="activity-badge">🍳 {unlockedPots}/6 口锅</span></div>
    <button className="pantry-all-button" disabled={!readyMeals} onClick={() => { const count = onCollectAllMeals(); setNotice(`一键收进粮柜 ${count} 份餐点。`); window.setTimeout(() => setNotice(''), 1800) }}>📦 一键收进粮柜（{readyMeals}）</button>

    <div className="pots-row">
      {state.kitchen.pots.map((pot, index) => {
        if (!isCookingPotUnlocked(index, weight)) {
          const weightRequirement = index === 2 ? '20 斤' : index === 3 ? '100 斤' : index === 4 ? '500 斤' : '2 吨'
          return <article className="pot-card pot-locked" key={index}><div className="pot-illustration">🔒</div><div className="pot-info"><b>第 {index + 1} 口锅</b><span>体重达到 {weightRequirement} 解锁 · 当前 {formatKitchenWeight(weight)}</span></div></article>
        }
        const recipe = pot.recipeId ? RECIPES[pot.recipeId] : null
        const remaining = Math.max(0, pot.doneAt - now)
        const cooking = Boolean(recipe && remaining > 0)
        const progress = recipe ? Math.min(100, ((now - pot.startedAt) / (pot.doneAt - pot.startedAt)) * 100) : 0
        return <article className={`pot-card ${cooking ? 'is-cooking' : ''} ${recipe && !cooking ? 'is-ready' : ''}`} key={index}>
          <div className={`pot-illustration ${cooking ? 'steam' : ''}`}>{recipe?.icon ?? '🍲'}{cooking && <i>♨</i>}</div>
          <div className="pot-info"><b>第 {index + 1} 口锅</b><span>{!recipe ? '空锅待命' : cooking ? `正在煮：${recipe.name}` : `${recipe.outputName}做好啦`}</span>
            {recipe && cooking && <div className="cook-progress"><i style={{ width: `${progress}%` }} /></div>}
          </div>
          {!recipe ? <button className="pot-button" disabled={!selectedRecipe} onClick={() => { if (selectedRecipe && onCook(index, selectedRecipe[0])) setSelected([]) }}>{selectedRecipe ? '放入开煮' : '选好食材'}</button>
            : cooking ? <span className="pot-countdown">{prettyTime(remaining)}</span>
              : <button className="pot-button ready-button" onClick={() => { onCollect(index); setNotice(`${recipe.outputName}收进共享粮柜啦！`); window.setTimeout(() => setNotice(''), 1800) }}>收进粮柜</button>}
        </article>
      })}
    </div>

    <section className="recipe-selection">
      <div className="section-label"><span>放进锅里的食材</span><div className="recipe-tools"><small>先选两种，再挑一口锅</small><button className="recipe-book-toggle" onClick={() => setShowRecipeBook((open) => !open)}>{showRecipeBook ? '收起目录' : '📖 合成目录'}</button></div></div>
      {showRecipeBook && <div className="recipe-book"><div className="recipe-book-heading"><b>食材合成目录</b><button onClick={() => setShowRecipeBook(false)} aria-label="关闭食谱目录">×</button></div>
        {(Object.entries(RECIPES) as [RecipeId, (typeof RECIPES)[RecipeId]][]).map(([id, recipe]) => {
          const first = INGREDIENTS.find((item) => item.id === recipe.ingredients[0])!
          const second = INGREDIENTS.find((item) => item.id === recipe.ingredients[1])!
          return <div className="recipe-book-row" key={id}><span>{first.icon} {first.name} + {second.icon} {second.name}</span><b>→</b><strong>{recipe.outputIcon} {recipe.outputName}</strong><small>饱腹 +{recipe.hunger}</small></div>
        })}
      </div>}
      <div className="selected-ingredients">
        {[0, 1].map((slot) => {
          const item = selected[slot] ? INGREDIENTS.find((ingredient) => ingredient.id === selected[slot]) : null
          return <span className={`ingredient-slot ${item ? 'filled' : ''}`} key={slot}>{item ? `${item.icon} ${item.name}` : `食材 ${slot + 1}`}</span>
        })}
        {selected.length > 0 && <button className="clear-selection" onClick={() => setSelected([])}>清空</button>}
      </div>
      {state.kitchen.lastIngredients && <button className="last-combo" disabled={state.kitchen.lastIngredients.some((id) => state.kitchen.ingredients[id] < 1) || !hasEmptyUnlockedPot} onClick={repeatLastCombo}><span>上次搭配</span>{state.kitchen.lastIngredients.map((id, index) => <b key={`${id}-${index}`}>{INGREDIENTS.find((item) => item.id === id)?.icon} {INGREDIENTS.find((item) => item.id === id)?.name}</b>)}<strong>点一下再做一份 →</strong></button>}
      {selectedRecipe ? <div className="matched-recipe"><span>{selectedRecipe[1].icon}</span><div><b>{selectedRecipe[1].name}</b><small>成品饱腹 +{selectedRecipe[1].hunger} · 喂食亲密度 +{selectedRecipe[1].affection}</small></div></div>
        : selected.length === 2 ? <div className="recipe-hint">这两种食材还没有搭配出食谱，换一种试试。</div> : <div className="recipe-hint">不同搭配会做出不同餐点，稀有食谱更顶饱也更能增加亲密度。</div>}
      <div className="ingredient-tray">
        {INGREDIENTS.map((item) => <IngredientChip key={item.id} id={item.id} count={state.kitchen.ingredients[item.id]} selected={Boolean(selectedCounts[item.id])} onClick={() => chooseIngredient(item.id)} />)}
      </div>
    </section>
    {notice && <div className="activity-toast kitchen-toast">✨ {notice}</div>}
    <div className="kitchen-note">{(Object.entries(RECIPES) as [RecipeId, (typeof RECIPES)[RecipeId]][]).map(([id, recipe]) => `${recipe.outputName} ${state.kitchen.pantry[id]}`).join(' · ')}</div>
  </div>
}

function formatKitchenWeight(weightTenthsJin: bigint) {
  if (weightTenthsJin >= 40_000n) return `${(weightTenthsJin / 20_000n).toString()} 吨`
  const whole = weightTenthsJin / 10n
  const fraction = weightTenthsJin % 10n
  return `${whole}${fraction ? `.${fraction}` : ''} 斤`
}

function plotStage(cropId: CropId, plot: GardenPlotState, now: number) {
  const crop = CROPS.find((item) => item.id === cropId)!
  const growth = cropGrowth(cropId, plot, now)
  if (growth.ready) return { icon: `✨${crop.icon}`, text: '可收获', progress: 100, ready: true }
  const stageIcon = growth.stage === 0 ? '🌱' : growth.stage === 1 ? crop.icon : `🌿${crop.icon}`
  return { icon: stageIcon, text: growth.stage === 0 ? '小苗' : growth.stage === 1 ? '生长中' : '快成熟', progress: growth.progress, ready: false }
}

function GardenPage({ petId, state, now, onPlant, onPlantAll, onWater, onHarvest, onHarvestAll, onDig, onFertilize }: Pick<Props, 'petId' | 'state' | 'now' | 'onPlant' | 'onPlantAll' | 'onWater' | 'onHarvest' | 'onHarvestAll' | 'onDig' | 'onFertilize'>) {
  const [selectedPlot, setSelectedPlot] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [animatedPlot, setAnimatedPlot] = useState<number | null>(null)
  const [showPlantMenu, setShowPlantMenu] = useState(false)
  const [shovelMode, setShovelMode] = useState(false)
  const showNotice = (message: string, plotIndex?: number) => {
    setNotice(message)
    if (plotIndex !== undefined) setAnimatedPlot(plotIndex)
    window.setTimeout(() => { setNotice(''); setAnimatedPlot(null) }, 1800)
  }
  const highestAffection = state.affection.dakuan
  const unlockedPlots = unlockedPlotCount(highestAffection)
  const ripeCount = state.garden.plots.filter((item) => item.cropId && cropGrowth(item.cropId, item, now).ready).length
  const plot = selectedPlot === null ? null : state.garden.plots[selectedPlot]
  const crop = plot?.cropId ? CROPS.find((item) => item.id === plot.cropId) : null
  const growth = plot?.cropId && plot ? cropGrowth(plot.cropId, plot, now) : null
  const waterDate = plot ? localDayKey(now) : ''
  const wateredToday = plot && plot.waterDate === waterDate ? plot.wateringsToday : 0
  const waterCooldown = plot && plot.lastWaterAt ? Math.max(0, plot.lastWaterAt + 600_000 - now) : 0
  const canWater = Boolean(plot?.cropId && growth && !growth.ready && wateredToday < 4 && waterCooldown === 0)
  const lockedCrops = CROPS.filter((item) => highestAffection < item.unlockAt).length

  return <div className={`activity-page garden-page ${shovelMode ? 'shovel-mode' : ''}`} style={{ backgroundImage: `linear-gradient(180deg, rgba(236,255,206,.10), rgba(238,255,219,.48) 45%, rgba(250,255,236,.98) 100%), url(${gardenBackground})` }}>
    <div className="activity-summary"><span>亲密度 {highestAffection} · {lockedCrops ? `还有 ${lockedCrops} 种种子待解锁` : '种子已全部解锁'}</span><span className="activity-badge garden-badge">🌱 {unlockedPlots}/10 块地</span></div>
    <div className="garden-summary"><span>每块地间隔 10 分钟浇水 · 每天最多 4 次</span></div>
    <div className="garden-bulk-actions"><button className="harvest-all-button" disabled={ripeCount === 0} onClick={() => { onHarvestAll(); setSelectedPlot(null); showNotice(`一键收获完成，共收下 ${ripeCount} 株成熟作物。`) }}>🧺 一键收获（{ripeCount}）</button><button className={`shovel-toggle ${shovelMode ? 'active' : ''}`} onClick={() => setShovelMode((mode) => !mode)}>{shovelMode ? '🪏 正在铲除 · 点击植物' : '🪏 铲子工具'}</button></div>
    <div className="garden-grid">
      {state.garden.plots.slice(0, 10).map((item, index) => {
        const isUnlocked = index < unlockedPlots
        const cropInfo = item.cropId ? plotStage(item.cropId, item, now) : null
        const unlockNeed = [0, 0, 0, 100, 200, 300, 500, 800, 1200, 1800][index]
        return <button className={`garden-plot ${!isUnlocked ? 'locked' : ''} ${selectedPlot === index ? 'selected' : ''} ${cropInfo?.ready ? 'ripe' : ''} ${animatedPlot === index ? 'plot-celebrate' : ''}`} key={index} disabled={!isUnlocked} onClick={() => {
          if (shovelMode && item.cropId) {
            onDig(index); setSelectedPlot(null); setShovelMode(false); showNotice(`已铲除第 ${index + 1} 块地的作物。`); return
          }
          setSelectedPlot(index)
        }}>
          {!isUnlocked ? <><span className="plot-lock">🔒</span><small>{unlockNeed}</small></> : item.cropId && cropInfo ? <><span className="plot-crop">{cropInfo.icon}</span><small>{cropInfo.text}</small><i className="plot-progress"><i style={{ width: `${cropInfo.progress}%` }} /></i></> : <><span className="plot-empty">＋</span><small>空地</small></>}
          {animatedPlot === index && <span className="watering-splash">💦✨</span>}
        </button>
      })}
    </div>

    {notice && <div className="activity-toast garden-toast">{notice}</div>}
    {selectedPlot === null ? <div className="plot-detail empty-detail">点一块空地种植，或查看作物的生长和浇水情况。</div>
      : !plot?.cropId ? <section className="plot-detail"><div className="section-label"><span>第 {selectedPlot + 1} 块地 · 选择种子</span><small>亲密度解锁新作物</small></div><div className="seed-grid">
        {CROPS.map((item) => {
          const unlocked = highestAffection >= item.unlockAt
          return <button key={item.id} disabled={!unlocked} title={ingredientRecipeHint(item.ingredient) || '收获后放入厨房食材仓库'} className={`seed-option ${unlocked ? '' : 'seed-locked'}`} onClick={() => { onPlant(selectedPlot, item.id); setSelectedPlot(null); showNotice(`种下${item.name}啦，记得来看它长大。`, selectedPlot) }}>
            <span>{unlocked ? item.icon : '🔒'}</span><b>{item.name}</b><small>{unlocked ? prettyTime(item.growMs) : `亲密度 ${item.unlockAt}`}</small>
          </button>
        })}
      </div></section>
        : crop && growth ? <section className="plot-detail crop-detail"><div className="crop-detail-head"><span className="crop-big-icon">{crop.icon}</span><div><b>第 {selectedPlot + 1} 块地 · {crop.name}</b><small>{growth.ready ? '成熟啦，可以采摘！' : `${prettyTime(Math.max(0, crop.growMs - growth.elapsed))} 后成熟`}</small></div></div>
          {ingredientRecipeHint(crop.ingredient) && <p className="crop-recipe-hint">🍳 用途：{ingredientRecipeHint(crop.ingredient)}</p>}
          <div className="growth-bar"><i style={{ width: `${growth.progress}%` }} /></div><div className="growth-stages"><span className={growth.progress < 30 ? 'active' : ''}>小苗 0–30%</span><span className={growth.progress >= 30 && growth.progress < 70 ? 'active' : ''}>生长 30–70%</span><span className={growth.progress >= 70 ? 'active' : ''}>成熟 70–100%</span></div>
          {!growth.ready && <div className="water-row"><button className="water-button" disabled={!canWater} onClick={() => { onWater(selectedPlot); showNotice('浇透啦，作物一下子长快了！', selectedPlot) }}>💧 浇水（立即完成 20%）</button><span>{wateredToday}/4 次 · {waterCooldown > 0 ? `${prettyTime(waterCooldown)}后可浇` : wateredToday >= 4 ? '今天次数已用完' : '可浇水'}</span></div>}
          {!growth.ready && <button className="fertilize-button" disabled={state.compost.fertilizerCount < 1} onClick={() => { if (onFertilize(selectedPlot)) showNotice('施肥成功，这株作物立即成熟啦！', selectedPlot) }}>🧪 施肥催熟（剩余 {state.compost.fertilizerCount}）</button>}
          {growth.ready ? <button className="harvest-button" onClick={() => { onHarvest(selectedPlot); showNotice(`${crop.name}采收完成，食材放进厨房啦。`, selectedPlot); setSelectedPlot(null) }}>🧺 摘下来（获得 {crop.name}）</button> : null}
          <small className="garden-care-credit">收获作物会存入食材，也会让大款更亲近你。</small>
        </section> : null}
    <div className="plant-all-button-row"><button className="plant-all-toggle" onClick={() => setShowPlantMenu((open) => !open)}>🌱 一键种植</button></div>
    {showPlantMenu && <section className="plant-all-menu"><b>选择一种作物，种满可用空地</b><div>{CROPS.map((item) => { const unlocked = highestAffection >= item.unlockAt; return <button key={item.id} disabled={!unlocked} onClick={() => { const count = onPlantAll(item.id); setShowPlantMenu(false); showNotice(count ? `已种下 ${count} 株${item.name}。` : '没有可种植的空地，或该种子尚未解锁。') }}><span>{item.icon}</span>{item.name}</button> })}</div></section>}
  </div>
}

function CompostPage({ state, now, onStartFertilizer, onCollectFertilizer, onUnlockFertilizerFactory, onToggleConstipation }: Pick<Props, 'state' | 'now' | 'onStartFertilizer' | 'onCollectFertilizer' | 'onUnlockFertilizerFactory' | 'onToggleConstipation'>) {
  const [notice, setNotice] = useState('')
  return <div className="activity-page compost-page">
    <div className="activity-summary"><span>15 坨便便 → 1 个化肥 · 制作需 20 分钟</span><span className="activity-badge">🧪 化肥 ×{state.compost.fertilizerCount}</span></div>
    <div className="constipation-card"><div><b>便秘模式</b><small>勾选后大款不会再生成便便。</small></div><input aria-label="便秘模式" type="checkbox" checked={state.constipationMode} onChange={(event) => onToggleConstipation(event.target.checked)} /></div>
    <div className="compost-stock">💩 普通便便 <b>{state.compost.poopCount}</b> 坨　·　🌈 彩色便便 <b>{state.compost.rainbowPoopCount}</b> 坨</div>
    {state.compost.unlockedPots < 5 && <div className="factory-unlock"><b>解锁化肥加工厂（{state.compost.unlockedPots}/5）</b><div><button disabled={state.compost.poopCount < 200} onClick={() => { if (onUnlockFertilizerFactory('poop')) setNotice('已用 200 坨普通便便解锁一个加工厂。') }}>💩 200 坨解锁</button><button disabled={state.compost.rainbowPoopCount < 5} onClick={() => { if (onUnlockFertilizerFactory('rainbow')) setNotice('已用 5 坨彩色便便解锁一个加工厂。') }}>🌈 5 坨解锁</button></div></div>}
    <div className="compost-pots">{state.compost.pots.map((pot, index) => {
      if (index >= state.compost.unlockedPots) return <article className="compost-pot pot-locked" key={index}><span className="compost-icon">🔒</span><div><b>加工厂 {index + 1}</b><small>解锁后可同时制作更多化肥</small></div></article>
      const working = pot.startedAt > 0
      const ready = working && pot.doneAt <= now
      const progress = working ? Math.min(100, Math.max(0, (now - pot.startedAt) / (pot.doneAt - pot.startedAt) * 100)) : 0
      return <article className={`compost-pot ${ready ? 'is-ready' : ''}`} key={index}><span className="compost-icon">🪴</span><div><b>加工厂 {index + 1}</b><small>{!working ? '空槽待制作' : ready ? '化肥做好啦！' : '正在发酵'}</small>{working && <i className="compost-progress"><i style={{ width: `${progress}%` }} /></i>}</div>{!working ? <button disabled={state.compost.poopCount < 15} onClick={() => { if (onStartFertilizer(index)) setNotice('投进 15 坨便便，开始制作 20 分钟啦。') }}>制作化肥</button> : ready ? <button className="ready-button" onClick={() => { if (onCollectFertilizer(index)) setNotice('化肥已放进库存，可以给作物施肥催熟。') }}>收取化肥</button> : <span>{prettyTime(pot.doneAt - now)}</span>}</article>
    })}</div>
    {notice && <div className="activity-toast">{notice}</div>}
    <div className="fertilizer-note">在菜园选中一株未成熟作物，就能使用一份化肥让它立即成熟。</div>
  </div>
}

function OrdersPage({ state, now, onClaimOrder, onClaimDailyTask }: Pick<Props, 'state' | 'now' | 'onClaimOrder' | 'onClaimDailyTask'>) {
  const remaining = Math.max(0, state.orders.nextRefreshAt - now)
  const prettyRemaining = prettyTime(remaining)
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const dailyRemaining = Math.max(0, midnight.getTime() - now)
  const dailyMinutes = Math.ceil(dailyRemaining / 60_000)
  const dailyResetText = dailyMinutes >= 60 ? `${Math.floor(dailyMinutes / 60)}小时${dailyMinutes % 60 ? `${dailyMinutes % 60}分` : ''}` : `${dailyMinutes}分钟`
  return <div className="activity-page orders-page">
    <div className="activity-summary"><span>交付物品领取金币 · 每 2 小时刷新</span><span className="activity-badge">🪙 {state.coins} 金币</span></div>
    <section className="daily-task-panel">
      <div className="daily-task-heading"><b>🌞 每日任务</b><span>每日 00:00 刷新 · {dailyResetText}后</span></div>
      <div className="daily-task-list">{state.orders.dailyTasks.tasks.map((task, index) => {
        const progress = Math.min(task.progress, task.target)
        const complete = progress >= task.target
        return <article className={`daily-task-card ${complete ? 'complete' : ''} ${task.claimed ? 'claimed' : ''}`} key={task.id}>
          <div className="daily-task-main"><div><b>{task.title}</b><small>{progress} / {task.target}</small></div><button disabled={!complete || task.claimed} onClick={() => onClaimDailyTask(index)}>{task.claimed ? '已领取' : '领取 50 金币'}</button></div>
          <div className="daily-task-track"><i style={{ width: `${Math.round(progress / task.target * 100)}%` }} /></div>
        </article>
      })}</div>
    </section>
    <div className="order-refresh-note">下次刷新：{prettyRemaining} 后（未完成的订单也会被替换）</div>
    <div className="orders-list">{state.orders.orders.map((order, index) => {
      const ready = order.requirements.every((requirement) => orderRequirementStock(requirement, state) >= requirement.amount)
      return <article className={`order-card ${order.claimed ? 'claimed' : ready ? 'ready' : ''}`} key={order.id}>
        <div className="order-heading"><b>订单 {index + 1}</b><span>奖励 🪙 {order.reward}</span></div>
        <ul>{order.requirements.map((requirement, taskIndex) => {
          const stock = orderRequirementStock(requirement, state)
          return <li key={taskIndex}><span>{orderRequirementLabel(requirement)} ×{requirement.amount}</span><small>{Math.min(stock, requirement.amount)} / {requirement.amount}</small></li>
        })}</ul>
        <button disabled={!ready || order.claimed} onClick={() => onClaimOrder(index)}>{order.claimed ? '已交付' : ready ? '交付并领取金币' : '物品不足'}</button>
      </article>
    })}</div>
  </div>
}

export default function ActivityPages(props: Props) {
  if (props.page === 2) return <KitchenPage key="kitchen" state={props.state} now={props.now} onCook={props.onCook} onCollect={props.onCollect} onCollectAllMeals={props.onCollectAllMeals} weightTenthsJin={props.weightTenthsJin} />
  if (props.page === 3) return <GardenPage key="garden" petId={props.petId} state={props.state} now={props.now} onPlant={props.onPlant} onPlantAll={props.onPlantAll} onWater={props.onWater} onHarvest={props.onHarvest} onHarvestAll={props.onHarvestAll} onDig={props.onDig} onFertilize={props.onFertilize} />
  if (props.page === 4) return <CompostPage key="compost" state={props.state} now={props.now} onStartFertilizer={props.onStartFertilizer} onCollectFertilizer={props.onCollectFertilizer} onUnlockFertilizerFactory={props.onUnlockFertilizerFactory} onToggleConstipation={props.onToggleConstipation} />
  return <OrdersPage key="orders" state={props.state} now={props.now} onClaimOrder={props.onClaimOrder} onClaimDailyTask={props.onClaimDailyTask} />
}

