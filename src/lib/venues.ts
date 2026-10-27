import { RARITY_ORDER } from '../data/catalog'
import type { LatLng } from './geo'
import type { SpawnView } from './spawnView'

/**
 * Spawns at the same point, shown as one pin. Most city events have no venue name but share
 * the coordinates of their library or cultural centre: up to 26 in a week on a single point.
 * One marker each would stack them, and only the top one could be tapped.
 */
export interface Venue {
  key: string
  lat: number
  lng: number
  /** Best first: see compareInVenue. Never empty. */
  views: SpawnView[]
}

/** Five decimals is about 1 m: points closer than that are the same building. */
export function venueKey(p: LatLng): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
}

const STATUS_RANK = { live: 0, upcoming: 1, ended: 2 } as const

/** Live before upcoming, not yet caught before caught, rarer first, then earliest, then by title. */
export function compareInVenue(a: SpawnView, b: SpawnView): number {
  return (
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    Number(a.caught) - Number(b.caught) ||
    RARITY_ORDER.indexOf(a.spawn.rarity) - RARITY_ORDER.indexOf(b.spawn.rarity) ||
    a.spawn.startsAt - b.spawn.startsAt ||
    a.displayTitle.localeCompare(b.displayTitle)
  )
}

/** Groups views by venue. Venues keep the order in which their first view appears. */
export function groupByVenue(views: SpawnView[]): Venue[] {
  const venues = new Map<string, Venue>()
  for (const v of views) {
    const key = venueKey(v.spawn)
    const venue = venues.get(key)
    if (venue) venue.views.push(v)
    else venues.set(key, { key, lat: v.spawn.lat, lng: v.spawn.lng, views: [v] })
  }
  for (const venue of venues.values()) venue.views.sort(compareInVenue)
  return [...venues.values()]
}

/** A name for the venue when all its spawns agree on one, otherwise null. */
export function venuePlace(venue: Venue): string | null {
  const places = new Set(venue.views.map((v) => v.displayPlace))
  return places.size === 1 ? [...places][0] : null
}
