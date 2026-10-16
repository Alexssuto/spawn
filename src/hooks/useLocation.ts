import { useEffect, useRef, useState } from 'react'
import { distanceMeters, type LatLng } from '../lib/geo'

export const MONTREAL_CENTER: LatLng = { lat: 45.5088, lng: -73.5698 }
const MAX_REAL_DISTANCE = 50_000

export type LocationSource = 'gps' | 'demo'

/**
 * Uses the device's GPS when it's in Montreal. Otherwise (or if location is
 * denied) falls back to a demo position that can be moved by tapping the map.
 * Teleporting pins the demo position until `followGps` is called.
 */
export function useLocation() {
  const [position, setPosition] = useState<LatLng>(MONTREAL_CENTER)
  const [source, setSource] = useState<LocationSource>('demo')
  const [gpsAvailable, setGpsAvailable] = useState(false)
  const lastGps = useRef<LatLng | null>(null)
  const pinned = useRef(false)

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (distanceMeters(p, MONTREAL_CENTER) > MAX_REAL_DISTANCE) return
        lastGps.current = p
        setGpsAvailable(true)
        if (!pinned.current) {
          setPosition(p)
          setSource('gps')
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const teleport = (p: LatLng) => {
    pinned.current = true
    setSource('demo')
    setPosition(p)
  }

  const followGps = () => {
    pinned.current = false
    if (lastGps.current) {
      setPosition(lastGps.current)
      setSource('gps')
    }
  }

  return { position, source, gpsAvailable, teleport, followGps }
}
