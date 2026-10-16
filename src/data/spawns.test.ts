import { describe, expect, it } from 'vitest'
import { distanceMeters } from '../lib/geo'
import { MONTREAL_CENTER } from '../hooks/useLocation'
import { statusOf } from '../lib/time'
import { RARITIES, TYPES } from './catalog'
import { loadSpawns } from './spawns'

const NOW = Date.UTC(2026, 9, 15, 18, 0)
const spawns = loadSpawns(NOW)

describe('sample spawn data', () => {
  it('has unique ids', () => {
    expect(new Set(spawns.map((s) => s.id)).size).toBe(spawns.length)
  })

  it('uses only known types and rarities', () => {
    for (const s of spawns) {
      expect(TYPES).toHaveProperty(s.type)
      expect(RARITIES).toHaveProperty(s.rarity)
    }
  })

  it('ends every spawn after it starts', () => {
    for (const s of spawns) expect(s.endsAt).toBeGreaterThan(s.startsAt)
  })

  it('places every spawn in the Montreal area', () => {
    for (const s of spawns) expect(distanceMeters(s, MONTREAL_CENTER)).toBeLessThan(30_000)
  })

  it('always has something live and something upcoming when the app opens', () => {
    const statuses = new Set(spawns.map((s) => statusOf(s, NOW)))
    expect(statuses).toContain('live')
    expect(statuses).toContain('upcoming')
  })
})
