import { useCallback, useState } from 'react'
import type { Spawn } from '../data/spawns'

export interface Catch {
  spawnId: string
  title: string
  type: Spawn['type']
  rarity: Spawn['rarity']
  place: string
  caughtAt: number
}

const KEY = 'spawn.collection.v1'

function read(): Catch[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Catch[]
  } catch {
    return []
  }
}

function write(catches: Catch[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(catches))
  } catch {
    // Storage unavailable (private mode); the collection just won't persist.
  }
}

export function useCollection() {
  const [catches, setCatches] = useState<Catch[]>(read)

  const add = useCallback((spawn: Spawn) => {
    setCatches((prev) => {
      if (prev.some((c) => c.spawnId === spawn.id)) return prev
      const next = [
        ...prev,
        {
          spawnId: spawn.id,
          title: spawn.title,
          type: spawn.type,
          rarity: spawn.rarity,
          place: spawn.place,
          caughtAt: Date.now(),
        },
      ]
      write(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    write([])
    setCatches([])
  }, [])

  const has = useCallback((id: string) => catches.some((c) => c.spawnId === id), [catches])

  return { catches, add, has, reset }
}
