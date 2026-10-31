import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { checkMarkup, typeIconMarkup } from './iconMarkup'
import type { LatLng } from '../lib/geo'
import { CATCH_RADIUS, type SpawnView } from '../lib/spawnView'
import { isEndingSoon } from '../lib/time'
import type { Venue } from '../lib/venues'

interface Props {
  venues: Venue[]
  me: LatLng
  now: number
  selectedId: string | null
  selectedVenue: string | null
  /** Extra attribution line for the data shown, e.g. a license requirement. */
  dataAttribution?: string
  onSelect: (id: string) => void
  onSelectVenue: (key: string) => void
  onTeleport: (p: LatLng) => void
}

// Icons are cached by their HTML. The map re-renders every clock tick, and handing react-leaflet a
// new icon object each time made it rebuild every marker's DOM; an unchanged icon is now the same
// object, so only markers whose look actually changed are touched.
const iconCache = new Map<string, L.DivIcon>()

/** A pin looks like its venue's best spawn (live, rarity...), with a count when it holds several. */
function venueIcon(lead: SpawnView, count: number, selected: boolean, endingSoon: boolean) {
  const classes = [
    'pin',
    `pin-${lead.spawn.rarity}`,
    `pin-${lead.status}`,
    lead.caught && 'pin-caught',
    lead.concealed && 'pin-concealed',
    selected && 'pin-selected',
    endingSoon && 'pin-ending',
  ]
    .filter(Boolean)
    .join(' ')
  const glyph = lead.concealed ? '<span class="pin-unknown">?</span>' : typeIconMarkup(lead.spawn.type, 18)
  const badge = count > 1 ? `<i class="pin-count">${count}</i>` : lead.caught ? `<i class="pin-check">${checkMarkup}</i>` : ''
  const html = `<div class="${classes}" aria-hidden="true">${glyph}${badge}</div>`
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

export function MapView({
  venues,
  me,
  now,
  selectedId,
  selectedVenue,
  dataAttribution,
  onSelect,
  onSelectVenue,
  onTeleport,
}: Props) {
  const focused = venues.find((venue) =>
    selectedId ? venue.views.some((v) => v.spawn.id === selectedId) : venue.key === selectedVenue,
  )
  const lat = focused?.lat
  const lng = focused?.lng
  // Depend on the coordinates (not the venue object) so the map only flies when the selection moves.
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
      {venues.map((venue) => {
        const [lead] = venue.views
        const count = venue.views.length
        const isFocused = venue === focused
        const title = count > 1 ? `${count} events here, including ${lead.displayTitle}` : lead.displayTitle
        return (
          <Marker
            // The key includes the title because Leaflet only reads `title` when a marker is created.
            key={`${venue.key}:${title}`}
            position={[venue.lat, venue.lng]}
            icon={venueIcon(lead, count, isFocused, isEndingSoon(lead.spawn, now))}
            // Leaflet makes markers keyboard-focusable buttons; the title gives each one a name.
            title={title}
            eventHandlers={{ click: () => (count > 1 ? onSelectVenue(venue.key) : onSelect(lead.spawn.id)) }}
            zIndexOffset={isFocused ? 1000 : lead.status === 'live' ? 100 : 0}
          />
        )
      })}
    </MapContainer>
  )
}
