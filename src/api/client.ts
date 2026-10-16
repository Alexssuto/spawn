import type { Spawn } from '../data/spawns'
import type { LatLng } from '../lib/geo'
import type { components } from './schema'

type ApiSpawn = components['schemas']['NearbySpawnOut']
type NearbyPage = components['schemas']['NearbyPage']

// Empty in development: Vite proxies /api to the backend (vite.config.ts), so requests are same-origin.
const BASE_URL: string = import.meta.env.VITE_API_URL ?? ''

/** Search area used by the app: the whole island of Montréal, a week ahead. */
export const DEFAULT_QUERY = { radius_m: 25_000, days_ahead: 7, limit: 500 } as const

/** Converts the API's snake_case contract into the frontend's Spawn shape. */
export function toSpawn(s: ApiSpawn): Spawn {
  return {
    id: s.id,
    title: s.title,
    type: s.type,
    rarity: s.rarity,
    place: s.place_name ?? s.borough ?? 'Montréal',
    lat: s.location.lat,
    lng: s.location.lng,
    description: s.description ?? '',
    startsAt: Date.parse(s.starts_at),
    endsAt: Date.parse(s.ends_at),
    price: s.is_free === true ? 'Free' : s.is_free === false ? 'Paid' : undefined,
    hidden: s.hidden,
    recurring: s.recurring ?? undefined,
    allDay: s.all_day,
    url: s.url ?? undefined,
    source: s.source,
  }
}

export class ApiError extends Error {}

/** Fetches every page of spawns around a point. */
export async function fetchNearbySpawns(
  center: LatLng,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<Spawn[]> {
  const spawns: Spawn[] = []
  let cursor: string | null = null
  do {
    const params = new URLSearchParams({
      lat: String(center.lat),
      lng: String(center.lng),
      radius_m: String(DEFAULT_QUERY.radius_m),
      days_ahead: String(DEFAULT_QUERY.days_ahead),
      limit: String(DEFAULT_QUERY.limit),
    })
    if (cursor) params.set('cursor', cursor)
    const response = await fetchImpl(`${BASE_URL}/api/v1/spawns?${params}`, { signal })
    if (!response.ok) throw new ApiError(`API responded ${response.status}`)
    const page = (await response.json()) as NearbyPage
    spawns.push(...page.items.map(toSpawn))
    cursor = page.next_cursor
  } while (cursor)
  return spawns
}
