import { describe, expect, it } from 'vitest'
import type { ExperienceType, Rarity } from '../data/catalog'
import { favouriteLabel, shareStats, shareText } from './shareCard'

function c(title: string, type: ExperienceType, rarity: Rarity) {
  return { title, type, rarity }
}

describe('shareStats', () => {
  it('handles an empty collection', () => {
    const stats = shareStats([])
    expect(stats).toEqual({
      caught: 0,
      level: 1,
      rarities: { common: 0, uncommon: 0, rare: 0, legendary: 0 },
      favouriteType: null,
      recent: [],
    })
  })

  it('counts rarities and takes the level from total XP', () => {
    const stats = shareStats([c('A', 'music', 'rare'), c('B', 'food', 'common')])
    expect(stats.caught).toBe(2)
    expect(stats.rarities).toEqual({ common: 1, uncommon: 0, rare: 1, legendary: 0 })
    expect(stats.level).toBe(2) // 250 + 50 XP: past the 250 needed for level 2
  })

  it('names a favourite type only when one clearly leads', () => {
    expect(shareStats([c('A', 'food', 'common'), c('B', 'music', 'common'), c('C', 'music', 'common')]).favouriteType).toBe(
      'music',
    )
  })

  it('has no favourite on a tie or with a single catch of a type', () => {
    // Found by looking at a rendered card: four types caught once each read "Mostly Food".
    expect(shareStats([c('A', 'food', 'common'), c('B', 'music', 'common')]).favouriteType).toBeNull()
    expect(shareStats([c('A', 'food', 'common')]).favouriteType).toBeNull()
    expect(
      shareStats([c('A', 'food', 'common'), c('B', 'food', 'common'), c('C', 'music', 'common'), c('D', 'music', 'common')])
        .favouriteType,
    ).toBeNull()
  })

  it('lists the most recent catches, newest first', () => {
    const stats = shareStats([c('1', 'food', 'common'), c('2', 'food', 'common'), c('3', 'food', 'common'), c('4', 'food', 'common')])
    expect(stats.recent.map((r) => r.title)).toEqual(['4', '3', '2'])
  })
})

describe('shareText', () => {
  it('names the best rarity caught', () => {
    expect(shareText(shareStats([c('A', 'music', 'legendary'), c('B', 'food', 'rare')]))).toBe(
      "I've caught 2 Montréal experiences on Spawn, including 1 Legendary.",
    )
  })

  it('falls back to Rare, then to the count alone', () => {
    expect(shareText(shareStats([c('A', 'music', 'rare')]))).toBe(
      "I've caught 1 Montréal experience on Spawn, including 1 Rare.",
    )
    expect(shareText(shareStats([c('A', 'music', 'common')]))).toBe("I've caught 1 Montréal experience on Spawn.")
  })
})

describe('favouriteLabel', () => {
  it('reads like a caption, or is absent with no catches', () => {
    expect(favouriteLabel(shareStats([c('A', 'night', 'common'), c('B', 'night', 'common')]))).toBe('Mostly Night')
    expect(favouriteLabel(shareStats([]))).toBeNull()
  })
})
