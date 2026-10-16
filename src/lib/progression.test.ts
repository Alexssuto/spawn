import { describe, expect, it } from 'vitest'
import { levelFromXp, totalXp } from './progression'

describe('totalXp', () => {
  it('sums the XP for each rarity', () => {
    expect(totalXp([])).toBe(0)
    expect(totalXp([{ rarity: 'common' }, { rarity: 'rare' }, { rarity: 'legendary' }])).toBe(50 + 250 + 600)
  })
})

describe('levelFromXp', () => {
  it('starts at level 1', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, progress: 0, toNext: 250 })
  })

  it('stays at level 1 until 250 XP', () => {
    expect(levelFromXp(249).level).toBe(1)
    expect(levelFromXp(250)).toEqual({ level: 2, progress: 0, toNext: 500 })
  })

  it('makes each level cost 250 XP more than the last', () => {
    expect(levelFromXp(250 + 500).level).toBe(3)
    expect(levelFromXp(250 + 500 + 750).level).toBe(4)
  })

  it('reports progress toward the next level', () => {
    const { level, progress, toNext } = levelFromXp(500)
    expect(level).toBe(2)
    expect(progress).toBeCloseTo(0.5)
    expect(toNext).toBe(250)
  })
})
