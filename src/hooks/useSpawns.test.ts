// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { fetchNearbySpawns } from '../api/client'
import { loadSpawns } from '../data/spawns'
import { useSpawns } from './useSpawns'

type Fetcher = typeof fetchNearbySpawns

describe('useSpawns', () => {
  it('uses real events when the API returns some', async () => {
    const real = loadSpawns().slice(0, 2).map((s) => ({ ...s, source: 'montreal-events' }))
    const fetcher = vi.fn<Fetcher>().mockResolvedValue(real)
    const { result } = renderHook(() => useSpawns(fetcher))

    expect(result.current.source.kind).toBe('loading')
    await waitFor(() => expect(result.current.source.kind).toBe('api'))
    expect(result.current.spawns).toEqual(real)
  })

  it('falls back to sample data when the API is unreachable', async () => {
    const fetcher = vi.fn<Fetcher>().mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useSpawns(fetcher))

    await waitFor(() => expect(result.current.source.kind).toBe('demo'))
    expect(result.current.spawns.length).toBe(loadSpawns().length)
    expect(result.current.source).toMatchObject({ reason: expect.stringContaining('unreachable') })
  })

  it('falls back to sample data when the API has no events yet', async () => {
    const fetcher = vi.fn<Fetcher>().mockResolvedValue([])
    const { result } = renderHook(() => useSpawns(fetcher))

    await waitFor(() => expect(result.current.source.kind).toBe('demo'))
    expect(result.current.source).toMatchObject({ reason: expect.stringContaining('ingestion') })
  })
})
