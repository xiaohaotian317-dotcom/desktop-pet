const TENTHS_PER_JIN = 10n
const JIN_PER_TON = 2_000n

export const POT_WEIGHT_UNLOCKS_TENTHS_JIN = [
  20n * TENTHS_PER_JIN,
  100n * TENTHS_PER_JIN,
  500n * TENTHS_PER_JIN,
  2n * JIN_PER_TON * TENTHS_PER_JIN
] as const

export function isCookingPotUnlocked(potIndex: number, weightTenthsJin: bigint) {
  if (potIndex < 2) return true
  if (potIndex === 2) return weightTenthsJin >= POT_WEIGHT_UNLOCKS_TENTHS_JIN[0]
  if (potIndex === 3) return weightTenthsJin >= POT_WEIGHT_UNLOCKS_TENTHS_JIN[1]
  if (potIndex === 4) return weightTenthsJin >= POT_WEIGHT_UNLOCKS_TENTHS_JIN[2]
  if (potIndex === 5) return weightTenthsJin >= POT_WEIGHT_UNLOCKS_TENTHS_JIN[3]
  return false
}

export function unlockedCookingPotCount(weightTenthsJin: bigint) {
  return Array.from({ length: 6 }, (_, index) => Number(isCookingPotUnlocked(index, weightTenthsJin)))
    .reduce((sum, unlocked) => sum + unlocked, 0)
}
