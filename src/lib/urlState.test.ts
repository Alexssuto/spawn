import { describe, expect, it } from 'vitest'
import { DEFAULT_URL_STATE, parseUrlState, toSearch } from './urlState'

describe('parseUrlState', () => {
  it('defaults to the map with no filter and no spawn', () => {
    expect(parseUrlState('')).toEqual(DEFAULT_URL_STATE)
  })

  it('reads tab, type and spawn', () => {
    expect(parseUrlState('?tab=nearby&type=music&spawn=abc-123')).toEqual({
      tab: 'nearby',
      type: 'music',
      spawn: 'abc-123',
    })
  })

  it('ignores unknown tabs and types instead of breaking the app', () => {
    expect(parseUrlState('?tab=settings&type=poetry')).toEqual(DEFAULT_URL_STATE)
  })

  it('ignores inherited object keys as types', () => {
    expect(parseUrlState('?type=toString').type).toBeNull()
  })

  it('treats a blank spawn id as no spawn', () => {
    expect(parseUrlState('?spawn=%20%20').spawn).toBeNull()
  })
})

describe('toSearch', () => {
  it('keeps the plain URL clean for the default view', () => {
    expect(toSearch(DEFAULT_URL_STATE)).toBe('')
  })

  it('writes only what differs from the default', () => {
    expect(toSearch({ tab: 'map', type: 'food', spawn: null })).toBe('?type=food')
  })

  it('round-trips through parseUrlState', () => {
    const state = { tab: 'dex', type: 'night', spawn: '7b0c2b36-0b5e' } as const
    expect(parseUrlState(toSearch(state))).toEqual(state)
  })
})
