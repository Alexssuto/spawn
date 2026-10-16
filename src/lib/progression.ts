import { RARITIES, type Rarity } from '../data/catalog'

/** Total XP earned from a list of catches. */
export function totalXp(catches: { rarity: Rarity }[]): number {
  return catches.reduce((sum, c) => sum + RARITIES[c.rarity].xp, 0)
}

/**
 * Converts XP into a level. Each level costs 250 XP more than the last
 * (250 to reach Lv. 2, 500 more for Lv. 3, 750 more for Lv. 4...).
 */
export function levelFromXp(xp: number) {
  let level = 1
  let need = 250
  let rest = xp
  while (rest >= need) {
    rest -= need
    level++
    need += 250
  }
  return { level, progress: rest / need, toNext: need - rest }
}
