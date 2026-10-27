import { describe, expect, it } from 'vitest'
import type { Spawn } from '../data/spawns'
import { viewSpawn } from './spawnView'
import { groupByVenue, venueKey, venuePlace } from './venues'

const MIN = 60_000
const NOW = Date.UTC(2026, 9, 27, 18, 0)
const ME = { lat: 45.5, lng: -73.57 }
const LIBRARY = { lat: 45.53283, lng: -73.5514 }

function spawn(id: string, extra: Partial<Spawn> = {}): Spawn {
  return {
    id,
    title: id,
    type: 'culture',
    rarity: 'common',
    place: 'Ville-Marie',
    ...LIBRARY,
    description: '',
    startsAt: NOW - 30 * MIN,
    endsAt: NOW + 60 * MIN,
    ...extra,
  }
}

const view = (s: Spawn, caught = false) => viewSpawn(s, ME, NOW, caught)

describe('venueKey', () => {
  it('treats points under about a metre apart as the same venue', () => {
    expect(venueKey({ lat: 45.532831, lng: -73.551402 })).toBe(venueKey(LIBRARY))
    expect(venueKey({ lat: 45.53293, lng: -73.5514 })).not.toBe(venueKey(LIBRARY)) // ~11 m north
  })
})

describe('groupByVenue', () => {
  it('puts spawns at the same point under one venue and keeps others apart', () => {
    const elsewhere = spawn('park', { lat: 45.51, lng: -73.58 })
    const venues = groupByVenue([view(spawn('a')), view(elsewhere), view(spawn('b'))])

    expect(venues.map((v) => v.views.map((x) => x.spawn.id))).toEqual([['a', 'b'], ['park']])
    expect(venues[0]).toMatchObject({ key: venueKey(LIBRARY), lat: LIBRARY.lat, lng: LIBRARY.lng })
  })

  it('every view ends up in exactly one venue', () => {
    const views = ['a', 'b', 'c', 'd'].map((id, i) => view(spawn(id, { lat: LIBRARY.lat + (i % 2) * 0.01 })))
    const ids = groupByVenue(views).flatMap((v) => v.views.map((x) => x.spawn.id))
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('orders a venue: live, then not caught, then rarer, then earliest', () => {
    const upcoming = spawn('upcoming', { rarity: 'legendary', startsAt: NOW + 60 * MIN, endsAt: NOW + 120 * MIN })
    const caught = spawn('caught', { rarity: 'legendary' })
    const common = spawn('common', { startsAt: NOW - 90 * MIN })
    const rare = spawn('rare', { rarity: 'rare' })
    const earlier = spawn('earlier', { startsAt: NOW - 120 * MIN })

    const [venue] = groupByVenue([view(upcoming), view(caught, true), view(common), view(rare), view(earlier)])

    expect(venue.views.map((v) => v.spawn.id)).toEqual(['rare', 'earlier', 'common', 'caught', 'upcoming'])
  })
})

describe('venuePlace', () => {
  it('names the venue only when its spawns agree on a place', () => {
    const [same] = groupByVenue([view(spawn('a')), view(spawn('b'))])
    expect(venuePlace(same)).toBe('Ville-Marie')

    const [mixed] = groupByVenue([view(spawn('a')), view(spawn('b', { place: 'Bibliothèque Frontenac' }))])
    expect(venuePlace(mixed)).toBeNull()
  })
})
