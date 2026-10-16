import type { Spawn } from '../data/spawns'

export type SpawnStatus = 'live' | 'upcoming' | 'ended'

export function statusOf(spawn: Spawn, now: number): SpawnStatus {
  if (now < spawn.startsAt) return 'upcoming'
  if (now > spawn.endsAt) return 'ended'
  return 'live'
}

export function formatDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`
  return `${Math.round(h / 24)}d`
}

/** Short human label like "ends in 2h 10m" or "starts in 25 min". */
export function timeLabel(spawn: Spawn, now: number): string {
  const status = statusOf(spawn, now)
  if (status === 'upcoming') return `starts in ${formatDuration(spawn.startsAt - now)}`
  if (status === 'ended') return 'ended'
  if (spawn.recurring) return spawn.recurring
  return `ends in ${formatDuration(spawn.endsAt - now)}`
}

/** True when a live spawn has less than 45 minutes left. */
export function isEndingSoon(spawn: Spawn, now: number): boolean {
  return statusOf(spawn, now) === 'live' && !spawn.recurring && spawn.endsAt - now < 45 * 60_000
}
