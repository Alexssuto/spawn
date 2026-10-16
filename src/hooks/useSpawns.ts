import { useEffect, useState } from 'react'
import { fetchNearbySpawns } from '../api/client'
import { loadSpawns, type Spawn } from '../data/spawns'
import { MONTREAL_CENTER } from './useLocation'

export type SpawnSource =
  | { kind: 'loading' }
  | { kind: 'api' }
  /** Built-in sample data, with the reason the API wasn't used. */
  | { kind: 'demo'; reason: string }

/**
 * Real events from the backend when it's reachable and has data; otherwise the built-in
 * sample spawns, so the app always works as a demo (e.g. without the backend running).
 */
export function useSpawns(fetcher: typeof fetchNearbySpawns = fetchNearbySpawns) {
  const [spawns, setSpawns] = useState<Spawn[]>([])
  const [source, setSource] = useState<SpawnSource>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetcher(MONTREAL_CENTER, fetch, controller.signal)
      .then((real) => {
        if (real.length > 0) {
          setSpawns(real)
          setSource({ kind: 'api' })
        } else {
          setSpawns(loadSpawns())
          setSource({ kind: 'demo', reason: 'The API has no events yet. Run the ingestion job.' })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setSpawns(loadSpawns())
        setSource({ kind: 'demo', reason: `API unreachable (${String(error)})` })
      })
    return () => controller.abort()
  }, [fetcher])

  return { spawns, source }
}
