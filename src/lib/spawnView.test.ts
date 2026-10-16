import { describe, expect, it } from 'vitest'
import type { Spawn } from '../data/spawns'
import { CATCH_RADIUS, REVEAL_RADIUS, sortViews, viewSpawn } from './spawnView'

const MIN = 60_000
const NOW = Date.UTC(2026, 9, 15, 18, 0)
const ME = { lat: 45.5, lng: -73.57 }
const METERS_PER_DEGREE_LAT = 111_195

/** A spawn `meters` north of ME, live by default. */
function spawnNorth(meters: number, extra: Partial<Spawn> = {}): Spawn {
  return {
    id: `s-${meters}`,
    title: 'Late-night poutine',
    type: 'food',
    rarity: 'rare',
    place: 'La Banquise',
    lat: ME.lat + meters / METERS_PER_DEGREE_LAT,
    lng: ME.lng,
    description: '',
    startsAt: NOW - 30 * MIN,
    endsAt: NOW + 60 * MIN,
    ...extra,
  }
}

describe('viewSpawn: catching', () => {
  it('can catch a live spawn inside the catch radius', () => {
    const v = viewSpawn(spawnNorth(CATCH_RADIUS - 10), ME, NOW, false)
    expect(v.inRange).toBe(true)
    expect(v.canCatch).toBe(true)
  })

  it('cannot catch from outside the radius', () => {
    const v = viewSpawn(spawnNorth(CATCH_RADIUS + 10), ME, NOW, false)
    expect(v.inRange).toBe(false)
    expect(v.canCatch).toBe(false)
  })

  it('cannot catch something that has not started', () => {
    const upcoming = spawnNorth(20, { startsAt: NOW + 10 * MIN })
    expect(viewSpawn(upcoming, ME, NOW, false).canCatch).toBe(false)
  })

  it('cannot catch something that already ended', () => {
    const ended = spawnNorth(20, { endsAt: NOW - MIN })
    expect(viewSpawn(ended, ME, NOW, false).canCatch).toBe(false)
  })

  it('cannot catch the same spawn twice', () => {
    expect(viewSpawn(spawnNorth(20), ME, NOW, true).canCatch).toBe(false)
  })
})

describe('viewSpawn: hidden spawns', () => {
  it('conceals the name and place when far away', () => {
    const v = viewSpawn(spawnNorth(REVEAL_RADIUS + 50, { hidden: true }), ME, NOW, false)
    expect(v.concealed).toBe(true)
    expect(v.displayTitle).toBe('Hidden food experience')
    expect(v.displayPlace).toBe('Get closer to reveal')
  })

  it('reveals within the reveal radius', () => {
    const v = viewSpawn(spawnNorth(REVEAL_RADIUS - 50, { hidden: true }), ME, NOW, false)
    expect(v.concealed).toBe(false)
    expect(v.displayTitle).toBe('Late-night poutine')
  })

  it('stays revealed once caught, even from far away', () => {
    const v = viewSpawn(spawnNorth(5_000, { hidden: true }), ME, NOW, true)
    expect(v.concealed).toBe(false)
  })

  it('never conceals normal spawns', () => {
    expect(viewSpawn(spawnNorth(5_000), ME, NOW, false).concealed).toBe(false)
  })
})

describe('sortViews', () => {
  it('drops ended spawns and puts live ones first, nearest first', () => {
    const views = [
      viewSpawn(spawnNorth(100, { id: 'upcoming-near', startsAt: NOW + MIN }), ME, NOW, false),
      viewSpawn(spawnNorth(900, { id: 'live-far' }), ME, NOW, false),
      viewSpawn(spawnNorth(50, { id: 'ended', endsAt: NOW - MIN }), ME, NOW, false),
      viewSpawn(spawnNorth(300, { id: 'live-near' }), ME, NOW, false),
    ]
    expect(sortViews(views).map((v) => v.spawn.id)).toEqual(['live-near', 'live-far', 'upcoming-near'])
  })
})
