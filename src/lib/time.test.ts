import { describe, expect, it } from 'vitest'
import type { Spawn } from '../data/spawns'
import { formatDuration, isEndingSoon, statusOf, timeLabel } from './time'

const MIN = 60_000
const NOW = Date.UTC(2026, 9, 15, 18, 0)

function spawnAt(startMin: number, endMin: number, extra: Partial<Spawn> = {}): Spawn {
  return {
    id: 'test',
    title: 'Test',
    type: 'music',
    rarity: 'common',
    place: 'Somewhere',
    lat: 45.5,
    lng: -73.57,
    description: '',
    startsAt: NOW + startMin * MIN,
    endsAt: NOW + endMin * MIN,
    ...extra,
  }
}

describe('statusOf', () => {
  it('is upcoming before the start', () => {
    expect(statusOf(spawnAt(10, 60), NOW)).toBe('upcoming')
  })

  it('is live between start and end, inclusive', () => {
    expect(statusOf(spawnAt(-10, 10), NOW)).toBe('live')
    expect(statusOf(spawnAt(0, 10), NOW)).toBe('live')
    expect(statusOf(spawnAt(-10, 0), NOW)).toBe('live')
  })

  it('is ended after the end', () => {
    expect(statusOf(spawnAt(-60, -1), NOW)).toBe('ended')
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '1 min'],
    [25 * MIN, '25 min'],
    [60 * MIN, '1h'],
    [130 * MIN, '2h 10m'],
    [24 * 60 * MIN, '1d'],
  ])('formats %d ms as "%s"', (ms, label) => {
    expect(formatDuration(ms)).toBe(label)
  })
})

describe('timeLabel', () => {
  it('counts down to the start of upcoming spawns', () => {
    expect(timeLabel(spawnAt(25, 60), NOW)).toBe('starts in 25 min')
  })

  it('counts down to the end of live spawns', () => {
    expect(timeLabel(spawnAt(-30, 60), NOW)).toBe('ends in 1h')
  })

  it('shows the schedule instead of a countdown for recurring spawns', () => {
    expect(timeLabel(spawnAt(-30, 60, { recurring: 'Daily' }), NOW)).toBe('Daily')
  })

  it('says ended once over', () => {
    expect(timeLabel(spawnAt(-60, -5), NOW)).toBe('ended')
  })
})

describe('isEndingSoon', () => {
  it('is true for live spawns with under 45 minutes left', () => {
    expect(isEndingSoon(spawnAt(-60, 44), NOW)).toBe(true)
  })

  it('is false at 45 minutes or more', () => {
    expect(isEndingSoon(spawnAt(-60, 45), NOW)).toBe(false)
  })

  it('ignores recurring and upcoming spawns', () => {
    expect(isEndingSoon(spawnAt(-60, 10, { recurring: 'Daily' }), NOW)).toBe(false)
    expect(isEndingSoon(spawnAt(5, 20), NOW)).toBe(false)
  })
})
