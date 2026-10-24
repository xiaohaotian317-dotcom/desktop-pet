const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

// Load the real pure game modules without a browser or a player's save files.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  })
  module._compile(outputText, filename)
}
const { affectionLevel, affectionProgress, affectionThreshold, INITIAL_INGREDIENTS, INITIAL_PANTRY, RECIPES, INGREDIENTS, emptyPlot, createOrderBoard, ingredientRecipeHint } = require('../src/renderer/activities.ts')
const { createCosmeticState } = require('../src/renderer/cosmetics.ts')
const { createWardrobeState } = require('../src/renderer/outfits.ts')
const { restoreSavedState } = require('../src/renderer/savedState.ts')
const { normalizePlayerPreferences, redeemGiftCode } = require('../src/shared/rewards.ts')
const { readStateFile, writeStateFile } = require('../src/main/stateFiles.ts')

const originalMilestones = [0, 100, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400, 6600, 7900, 9300]
originalMilestones.forEach((points, index) => assert.equal(affectionLevel(points), index + 1))
for (let level = 2; level <= 10000; level++) {
  const threshold = affectionThreshold(level)
  assert.equal(affectionLevel(threshold - 1), level - 1, `below Lv.${level}`)
  assert.equal(affectionLevel(threshold), level, `at Lv.${level}`)
  const progress = affectionProgress(threshold)
  assert.equal(progress.progress, 0)
  assert.equal(progress.next, affectionThreshold(level + 1))
}
for (const points of [6601, 1000000, 1e12, Number.MAX_SAFE_INTEGER]) {
  const result = affectionProgress(points)
  assert.ok(result.current <= points && result.next > points)
}
console.log('PASS: all original milestones, Lv.11 regression, 10,000 level boundaries and large point totals')

const now = Date.now()
const initial = {
  schemaVersion: 12, paused: false, soundMuted: false, soundVolume: 100, redeemedCodes: [],
  pets: { dakuan: { hunger: 80, mood: 80, cleanliness: 80, x: 340, y: 500, lastUpdated: now, lastPoopAt: now, weightTenthsJin: '10' } },
  affection: { dakuan: 0 },
  kitchen: { ingredients: structuredClone(INITIAL_INGREDIENTS), pantry: structuredClone(INITIAL_PANTRY), pots: Array.from({ length: 6 }, () => ({ recipeId: null, startedAt: 0, doneAt: 0 })), lastIngredients: null },
  garden: { plots: Array.from({ length: 10 }, emptyPlot) },
  compost: { poopCount: 0, rainbowPoopCount: 0, fertilizerCount: 0, unlockedPots: 2, ordinarySinceRainbow: 0, nextRainbowAt: 75, pots: Array.from({ length: 5 }, () => ({ startedAt: 0, doneAt: 0 })) },
  droppings: [], coins: 0, orders: createOrderBoard(now), constipationMode: false,
  cosmetics: createCosmeticState(now), wardrobe: createWardrobeState(now), alwaysOnTop: true
}
const old = structuredClone(initial)
old.schemaVersion = 11
delete old.soundVolume
delete old.redeemedCodes
delete old.kitchen.pantry.goldfish_can
old.coins = 321
old.affection.dakuan = 6601
old.soundMuted = true
old.pets.dakuan.weightTenthsJin = '50000'
old.kitchen.ingredients.goldfish = 12
old.kitchen.pantry.fish_can = 19
old.kitchen.pots[2] = { recipeId: 'fish_can', startedAt: now, doneAt: now + 45000 }
old.garden.plots[0] = { ...emptyPlot(), cropId: 'goldfishTree', plantedAt: now }
old.compost.fertilizerCount = 17
old.compost.pots[0] = { startedAt: now, doneAt: now + 1200000 }
old.wardrobe = { owned: ['dunhuang'], equipped: 'dunhuang', shop: { stock: ['gardener', 'christmas'], nextRefreshAt: now + 100000 } }
const restored = restoreSavedState(JSON.parse(JSON.stringify(old)), initial, false, now)
assert.equal(restored.coins, 321)
assert.deepEqual(restored.pets, old.pets)
assert.deepEqual(restored.affection, old.affection)
assert.equal(restored.soundMuted, true)
assert.equal(restored.soundVolume, 100)
assert.deepEqual(restored.redeemedCodes, [])
assert.deepEqual(restored.kitchen.ingredients, old.kitchen.ingredients)
assert.equal(restored.kitchen.pantry.fish_can, 19)
assert.equal(restored.kitchen.pantry.goldfish_can, 0)
assert.deepEqual(restored.kitchen.pots, old.kitchen.pots)
assert.deepEqual(restored.garden, old.garden)
assert.deepEqual(restored.compost, old.compost)
assert.deepEqual(restored.orders, old.orders)
assert.equal(restored.wardrobe.equipped, 'dunhuang')
assert.ok(restored.wardrobe.owned.includes('dunhuang'))
assert.deepEqual(restored.wardrobe.shop, old.wardrobe.shop)
assert.deepEqual(restoreSavedState(restored, initial, false, now), restored)
console.log('PASS: old save migration preserves coins, affection, wardrobe, food, planting and crafting timers')

const before = JSON.stringify(restored)
assert.equal(redeemGiftCode(restored, '错误').state, restored)
const gift = redeemGiftCode(restored, ' 大款 ')
assert.equal(gift.success, true)
assert.equal(JSON.stringify(restored), before, 'redemption must not mutate source state')
assert.equal(gift.state.coins, 521)
assert.equal(gift.state.compost.fertilizerCount, 27)
assert.ok(gift.state.wardrobe.owned.includes('gardener'))
assert.ok(!gift.state.wardrobe.shop.stock.includes('gardener'))
assert.equal(gift.state.wardrobe.equipped, 'dunhuang')
const reloaded = restoreSavedState(JSON.parse(JSON.stringify(gift.state)), initial, false, now)
assert.equal(redeemGiftCode(reloaded, '大款').success, false)
assert.equal(redeemGiftCode(reloaded, '大款').state, reloaded)
const alreadyOwned = { ...restored, wardrobe: { ...restored.wardrobe, owned: [...restored.wardrobe.owned, 'gardener'] } }
assert.equal(redeemGiftCode(alreadyOwned, '大款').state.wardrobe.owned.filter((id) => id === 'gardener').length, 1)
for (const [input, expected] of [[undefined, 100], [NaN, 100], [-50, 0], [500, 100], [35, 35]]) {
  assert.equal(normalizePlayerPreferences({ soundVolume: input }).soundVolume, expected)
}
console.log('PASS: correct gift rewards, repeat redemption after reload, duplicate outfit and volume defaults')

const path = require('node:path')
fs.mkdirSync(path.join(__dirname, '../out'), { recursive: true })
const fixtureDirectory = fs.mkdtempSync(path.join(__dirname, '../out/state-check-'))
const fixture = path.join(fixtureDirectory, 'pet-state.json')
fs.writeFileSync(fixture, JSON.stringify(old))
writeStateFile(fixture, gift.state)
assert.deepEqual(readStateFile(fixture), gift.state)
assert.deepEqual(JSON.parse(fs.readFileSync(fixture + '.bak', 'utf8')), old)
assert.deepEqual(JSON.parse(fs.readFileSync(fixture + '.schema-11.bak', 'utf8')), old)
writeStateFile(fixture, { ...gift.state, coins: 1 })
assert.deepEqual(JSON.parse(fs.readFileSync(fixture + '.bak', 'utf8')), gift.state)
assert.deepEqual(JSON.parse(fs.readFileSync(fixture + '.schema-11.bak', 'utf8')), old)
fs.writeFileSync(fixture, '{broken json')
writeStateFile(fixture, gift.state)
assert.deepEqual(JSON.parse(fs.readFileSync(fixture + '.bak', 'utf8')), gift.state)
assert.throws(() => writeStateFile(fixture, {}), /空白状态/)
assert.deepEqual(readStateFile(fixture), gift.state)
assert.ok(!fs.existsSync(fixture + '.' + process.pid + '.tmp'))
console.log('PASS: actual disk save, immutable migration backup, previous valid backup and rejected empty payload')

for (const recipe of Object.values(RECIPES)) {
  for (const ingredient of recipe.ingredients) assert.ok(INGREDIENTS.some((item) => item.id === ingredient))
}
assert.deepEqual(RECIPES.goldfish_can.ingredients, ['goldfish', 'milk'])
assert.equal(RECIPES.goldfish_can.kind, 'can')
assert.ok(ingredientRecipeHint('goldfish').includes('金鱼果 + 奶果 → 金鱼奶香罐头'))
console.log('PASS: goldfish recipe, ingredient catalogue and crop-use hint')
