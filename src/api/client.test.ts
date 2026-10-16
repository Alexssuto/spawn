import { describe, expect, it, vi } from 'vitest'
import { ApiError, fetchNearbySpawns, toSpawn } from './client'
import type { components } from './schema'

type ApiSpawn = components['schemas']['NearbySpawnOut']

function apiSpawn(overrides: Partial<ApiSpawn> = {}): ApiSpawn {
  return {
    id: '7b0c2b36-0b5e-4d7a-9a59-3c3f4c4f1b10',
    title: 'Shirono Ballon - Cirque à volonté',
    description: 'Un spectacle poétique.',
    type: 'culture',
    rarity: 'common',
    location: { lat: 45.55, lng: -73.6 },
    starts_at: '2026-10-24T04:00:00Z',
    ends_at: '2026-10-25T04:00:00Z',
    all_day: true,
    place_name: 'Maison de la culture',
    address: '123 rue Exemple, H2X 1Y4',
    borough: 'Rosemont',
    audience: 'Pour tous',
    is_free: true,
    is_outdoor: false,
    hidden: false,
    recurring: null,
    url: 'https://montreal.ca/evenements/shirono-ballon-114726',
    source: 'montreal-events',
    distance_m: 1234,
    ...overrides,
  }
}

const CENTER = { lat: 45.5088, lng: -73.5698 }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('toSpawn', () => {
  it('maps the API contract to the frontend shape', () => {
    const spawn = toSpawn(apiSpawn())
    expect(spawn).toMatchObject({
      id: '7b0c2b36-0b5e-4d7a-9a59-3c3f4c4f1b10',
      type: 'culture',
      place: 'Maison de la culture',
      lat: 45.55,
      lng: -73.6,
      startsAt: Date.UTC(2026, 9, 24, 4),
      endsAt: Date.UTC(2026, 9, 25, 4),
      allDay: true,
      price: 'Free',
      source: 'montreal-events',
    })
  })

  it('falls back to the borough, then the city, when there is no place name', () => {
    expect(toSpawn(apiSpawn({ place_name: null })).place).toBe('Rosemont')
    expect(toSpawn(apiSpawn({ place_name: null, borough: null })).place).toBe('Montréal')
  })

  it('distinguishes free, paid and unknown prices', () => {
    expect(toSpawn(apiSpawn({ is_free: false })).price).toBe('Paid')
    expect(toSpawn(apiSpawn({ is_free: null })).price).toBeUndefined()
  })

  it('turns nulls into missing fields', () => {
    const spawn = toSpawn(apiSpawn({ description: null, url: null }))
    expect(spawn.description).toBe('')
    expect(spawn.url).toBeUndefined()
  })
})

describe('fetchNearbySpawns', () => {
  it('requests the Montréal area and follows every page', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ items: [apiSpawn({ id: 'a' })], next_cursor: 'page2' }))
      .mockResolvedValueOnce(jsonResponse({ items: [apiSpawn({ id: 'b' })], next_cursor: null }))

    const spawns = await fetchNearbySpawns(CENTER, fetchMock)

    expect(spawns.map((s) => s.id)).toEqual(['a', 'b'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(first.pathname).toBe('/api/v1/spawns')
    expect(first.searchParams.get('lat')).toBe('45.5088')
    expect(first.searchParams.get('radius_m')).toBe('25000')
    expect(first.searchParams.has('cursor')).toBe(false)
    const second = new URL(String(fetchMock.mock.calls[1][0]), 'http://localhost')
    expect(second.searchParams.get('cursor')).toBe('page2')
  })

  it('throws an ApiError on an HTTP error', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: {} }, 503))
    await expect(fetchNearbySpawns(CENTER, fetchMock)).rejects.toBeInstanceOf(ApiError)
  })
})
