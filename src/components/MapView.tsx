import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { TYPES } from '../data/catalog'
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

function spawnIcon(v: SpawnView, selected: boolean, endingSoon: boolean) {
  const t = TYPES[v.spawn.type]
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
  return L.divIcon({
    className: '',
    html: `<div class="${classes}" style="--c:${t.color}"><span>${v.concealed ? '?' : t.icon}</span>${
      v.caught ? '<i class="pin-check">✓</i>' : ''
    }</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
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
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
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
        pathOptions={{ color: '#a78bfa', weight: 1, fillColor: '#a78bfa', fillOpacity: 0.08 }}
      />
      <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} />
      {views.map((v) => (
        <Marker
          key={v.spawn.id}
          position={[v.spawn.lat, v.spawn.lng]}
          icon={spawnIcon(v, v.spawn.id === selectedId, isEndingSoon(v.spawn, now))}
          eventHandlers={{ click: () => onSelect(v.spawn.id) }}
          zIndexOffset={v.spawn.id === selectedId ? 1000 : v.status === 'live' ? 100 : 0}
        />
      ))}
    </MapContainer>
  )
}
