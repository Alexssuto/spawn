import { RARITIES, TYPES, type ExperienceType, type Rarity } from '../data/catalog'
import { levelFromXp, totalXp } from './progression'

/** The facts a share card shows, computed from the collection so the card can never disagree with the Dex. */
export interface ShareStats {
  caught: number
  level: number
  rarities: Record<Rarity, number>
  /** The type caught strictly more than any other (and at least twice), or null: a tie has no favourite. */
  favouriteType: ExperienceType | null
  /** The most recent catches, newest first. */
  recent: { title: string; type: ExperienceType; rarity: Rarity }[]
}

interface CatchLike {
  title: string
  type: ExperienceType
  rarity: Rarity
}

export function shareStats(catches: CatchLike[], recentCount = 3): ShareStats {
  const rarities = { common: 0, uncommon: 0, rare: 0, legendary: 0 } satisfies Record<Rarity, number>
  const byType = new Map<ExperienceType, number>()
  for (const c of catches) {
    rarities[c.rarity] += 1
    byType.set(c.type, (byType.get(c.type) ?? 0) + 1)
  }
  const counts = [...byType.entries()].sort((a, b) => b[1] - a[1])
  const [lead, runnerUp] = counts
  // "Mostly Food" after one bagel, or when four types are tied at one each, would be a false claim.
  const favouriteType = lead && lead[1] >= 2 && (!runnerUp || lead[1] > runnerUp[1]) ? lead[0] : null
  return {
    caught: catches.length,
    level: levelFromXp(totalXp(catches)).level,
    rarities,
    favouriteType,
    recent: catches.slice(-recentCount).reverse().map(({ title, type, rarity }) => ({ title, type, rarity })),
  }
}

/** One line under the card: counts in numerals, the best catch named, no exclamation spam. */
export function shareText(stats: ShareStats): string {
  const things = stats.caught === 1 ? 'experience' : 'experiences'
  const best = (['legendary', 'rare'] as const).find((r) => stats.rarities[r] > 0)
  const highlight = best ? `, including ${stats.rarities[best]} ${RARITIES[best].label}` : ''
  return `I've caught ${stats.caught} Montréal ${things} on Spawn${highlight}.`
}

/** A short label for the favourite type, e.g. "Mostly Music". */
export function favouriteLabel(stats: ShareStats): string | null {
  return stats.favouriteType ? `Mostly ${TYPES[stats.favouriteType].label}` : null
}
