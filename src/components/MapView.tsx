import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { checkMarkup, typeIconMarkup } from './iconMarkup'
import type { LatLng } from '../lib/geo'
import { CATCH_RADIUS, type SpawnView } from '../lib/spawnView'
import { isEndingSoon } from '../lib/time'

interface Props {
  views: SpawnView[]
  me: LatLng
  now: number
  selectedId: string | null
  /** Extra attribution line for the data shown, e.g. a license requirement. */
  dataAttribution?: string
  onSelect: (id: string) => void
  onTeleport: (p: LatLng) => void
}

// Icons are cached by their HTML. The map re-renders every clock tick, and handing react-leaflet a
// new icon object each time made it rebuild every marker's DOM; an unchanged icon is now the same
// object, so only markers whose look actually changed are touched.
const iconCache = new Map<string, L.DivIcon>()

function spawnIcon(v: SpawnView, selected: boolean, endingSoon: boolean) {
  const classes = [
    'pin',
    `pin-${v.spawn.rarity}`,
    `pin-${v.status}`,
    v.caught && 'pin-caught',
    v.concealed && 'pin-concealed',
    selected && 'pin-selected',
    endingSoon && 'pin-ending',
  ]
    .filter(Boolean)
    .join(' ')
  const glyph = v.concealed ? '<span class="pin-unknown">?</span>' : typeIconMarkup(v.spawn.type, 18)
  const html = `<div class="${classes}" aria-hidden="true">${glyph}${v.caught ? `<i class="pin-check">${checkMarkup}</i>` : ''}</div>`
  let icon = iconCache.get(html)
  if (!icon) {
    icon = L.divIcon({ className: '', html, iconSize: [40, 40], iconAnchor: [20, 20] })
    iconCache.set(html, icon)
  }
  return icon
}

const meIcon = L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })

function ClickToTeleport({ onTeleport }: { onTeleport: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onTeleport({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

/** Adds an attribution line (e.g. a data license) to the map's attribution control while mounted. */
function DataAttribution({ text }: { text: string }) {
  const map = useMap()
  useEffect(() => {
    map.attributionControl.addAttribution(text)
    return () => {
      map.attributionControl.removeAttribution(text)
    }
  }, [map, text])
  return null
}

function FlyToSelected({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const zoom = Math.max(map.getZoom(), 15)
    // Leaflet animates in JavaScript, so the CSS reduced-motion rule doesn't reach it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.setView([target.lat, target.lng], zoom)
    else map.flyTo([target.lat, target.lng], zoom, { duration: 0.6 })
  }, [map, target])
  return null
}

export function MapView({ views, me, now, selectedId, dataAttribution, onSelect, onTeleport }: Props) {
  const selected = views.find((v) => v.spawn.id === selectedId)
  const lat = selected?.spawn.lat
  const lng = selected?.spawn.lng
  // Depend on the coordinates (not the view object) so the map only flies when the selection changes.
  const target = useMemo(() => (lat !== undefined && lng !== undefined ? { lat, lng } : null), [lat, lng])

  return (
    <MapContainer center={[me.lat, me.lng]} zoom={14} zoomControl={false} className="map" attributionControl>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <ClickToTeleport onTeleport={onTeleport} />
      <FlyToSelected target={target} />
      {dataAttribution && <DataAttribution text={dataAttribution} />}
      <Circle
        center={[me.lat, me.lng]}
        radius={CATCH_RADIUS}
        // The catch ring is data (your reach), so it carries the one accent hue.
        pathOptions={{ color: '#ff7a1a', weight: 1, dashArray: '4 4', fillColor: '#ff7a1a', fillOpacity: 0.06 }}
      />
      <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} />
      {views.map((v) => (
        <Marker
          // The key includes `concealed` because Leaflet only reads `title` when a marker is created.
          key={`${v.spawn.id}:${v.concealed}`}
          position={[v.spawn.lat, v.spawn.lng]}
          icon={spawnIcon(v, v.spawn.id === selectedId, isEndingSoon(v.spawn, now))}
          // Leaflet makes markers keyboard-focusable buttons; the title gives each one a name.
          title={v.displayTitle}
          eventHandlers={{ click: () => onSelect(v.spawn.id) }}
          zIndexOffset={v.spawn.id === selectedId ? 1000 : v.status === 'live' ? 100 : 0}
        />
      ))}
    </MapContainer>
  )
}
