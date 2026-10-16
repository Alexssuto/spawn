import { describe, expect, it } from 'vitest'
import { distanceMeters, formatDistance } from './geo'

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    const p = { lat: 45.5085, lng: -73.5665 }
    expect(distanceMeters(p, p)).toBe(0)
  })

  it('measures one degree of latitude as about 111.2 km', () => {
    const d = distanceMeters({ lat: 45, lng: -73 }, { lat: 46, lng: -73 })
    expect(d).toBeCloseTo(111_195, -1)
  })

  it('is symmetric', () => {
    const a = { lat: 45.5085, lng: -73.5665 }
    const b = { lat: 45.4961, lng: -73.5693 }
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6)
  })

  it('shrinks longitude distances away from the equator', () => {
    const atEquator = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })
    const atMontreal = distanceMeters({ lat: 45.5, lng: 0 }, { lat: 45.5, lng: 1 })
    expect(atMontreal / atEquator).toBeCloseTo(Math.cos((45.5 * Math.PI) / 180), 3)
  })
})

describe('formatDistance', () => {
  it.each([
    [0, '0 m'],
    [44, '40 m'],
    [149, '150 m'],
    [994, '990 m'],
  ])('shows %d m as "%s"', (m, label) => {
    expect(formatDistance(m)).toBe(label)
  })

  it('switches to km instead of showing "1000 m"', () => {
    expect(formatDistance(996)).toBe('1.0 km')
    expect(formatDistance(1000)).toBe('1.0 km')
  })

  it('uses one decimal under 10 km and none above', () => {
    expect(formatDistance(1_540)).toBe('1.5 km')
    expect(formatDistance(12_345)).toBe('12 km')
  })
})
