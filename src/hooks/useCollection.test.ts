// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadSpawns } from '../data/spawns'
import { useCollection } from './useCollection'

const KEY = 'spawn.collection.v1'
const [first, second] = loadSpawns()

describe('useCollection', () => {
  beforeEach(() => localStorage.clear())

  it('starts empty', () => {
    const { result } = renderHook(() => useCollection())
    expect(result.current.catches).toEqual([])
    expect(result.current.has(first.id)).toBe(false)
  })

  it('adds a catch and saves it to localStorage', () => {
    const { result } = renderHook(() => useCollection())
    act(() => result.current.add(first))

    expect(result.current.has(first.id)).toBe(true)
    expect(result.current.catches[0]).toMatchObject({ spawnId: first.id, title: first.title, rarity: first.rarity })
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(1)
  })

  it('ignores catching the same spawn twice', () => {
    const { result } = renderHook(() => useCollection())
    act(() => result.current.add(first))
    act(() => result.current.add(first))
    expect(result.current.catches).toHaveLength(1)
  })

  it('restores the collection on the next visit', () => {
    const before = renderHook(() => useCollection())
    act(() => before.result.current.add(first))
    act(() => before.result.current.add(second))
    before.unmount()

    const after = renderHook(() => useCollection())
    expect(after.result.current.catches.map((c) => c.spawnId)).toEqual([first.id, second.id])
  })

  it('resets everything', () => {
    const { result } = renderHook(() => useCollection())
    act(() => result.current.add(first))
    act(() => result.current.reset())
    expect(result.current.catches).toEqual([])
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([])
  })

  it('recovers from corrupted saved data', () => {
    localStorage.setItem(KEY, '{not json')
    const { result } = renderHook(() => useCollection())
    expect(result.current.catches).toEqual([])
  })

  it('ignores saved data that is valid JSON but not a list', () => {
    localStorage.setItem(KEY, '{"spawnId":"x"}')
    const { result } = renderHook(() => useCollection())
    expect(result.current.catches).toEqual([])
    expect(result.current.has('x')).toBe(false)
  })
})
