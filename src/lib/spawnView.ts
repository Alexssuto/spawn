import { TYPES } from '../data/catalog'
import type { Spawn } from '../data/spawns'
import { distanceMeters, type LatLng } from './geo'
import { statusOf, type SpawnStatus } from './time'

/** How close you need to be to catch a spawn. */
export const CATCH_RADIUS = 150
/** Hidden spawns reveal their name and place within this distance. */
export const REVEAL_RADIUS = 400

export interface SpawnView {
  spawn: Spawn
  status: SpawnStatus
  distance: number
  caught: boolean
  concealed: boolean
  inRange: boolean
  canCatch: boolean
  displayTitle: string
  displayPlace: string
}

export function viewSpawn(spawn: Spawn, me: LatLng, now: number, caught: boolean): SpawnView {
  const status = statusOf(spawn, now)
  const distance = distanceMeters(me, spawn)
  const concealed = !!spawn.hidden && !caught && distance > REVEAL_RADIUS
  const inRange = distance <= CATCH_RADIUS
  return {
    spawn,
    status,
    distance,
    caught,
    concealed,
    inRange,
    canCatch: status === 'live' && inRange && !caught,
    displayTitle: concealed ? `Hidden ${TYPES[spawn.type].label.toLowerCase()} experience` : spawn.title,
    displayPlace: concealed ? 'Get closer to reveal' : spawn.place,
  }
}

/** Live first, then upcoming, each sorted by distance. Ended spawns are dropped. */
export function sortViews(views: SpawnView[]): SpawnView[] {
  const rank = { live: 0, upcoming: 1, ended: 2 } as const
  return views
    .filter((v) => v.status !== 'ended')
    .sort((a, b) => rank[a.status] - rank[b.status] || a.distance - b.distance)
}
