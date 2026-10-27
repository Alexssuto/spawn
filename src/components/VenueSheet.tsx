import { MapPin, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { formatDistance } from '../lib/geo'
import { venuePlace, type Venue } from '../lib/venues'
import { SpawnCard } from './SpawnCard'

interface Props {
  venue: Venue
  now: number
  onClose: () => void
  onSelect: (spawnId: string) => void
}

/** Everything happening at one point on the map, best first. Each row opens the usual details sheet. */
export function VenueSheet({ venue, now, onClose, onSelect }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const count = venue.views.length
  const live = venue.views.filter((v) => v.status === 'live').length
  const place = venuePlace(venue)

  // Same focus and Escape behaviour as the details sheet.
  useEffect(() => {
    sheetRef.current?.focus()
  }, [venue.key])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="sheet venue-sheet" role="dialog" aria-labelledby={titleId} tabIndex={-1} ref={sheetRef}>
      <button className="sheet-close" onClick={onClose} aria-label="Close">
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <h2 className="sheet-title venue-title" id={titleId}>
        {count} {count === 1 ? 'event' : 'events'} here
      </h2>
      <div className="sheet-place">
        <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
        {[place, formatDistance(venue.views[0].distance), live > 0 && `${live} live`].filter(Boolean).join(' · ')}
      </div>
      <div className="venue-list">
        {venue.views.map((v) => (
          <SpawnCard key={v.spawn.id} view={v} now={now} onClick={() => onSelect(v.spawn.id)} />
        ))}
      </div>
    </div>
  )
}
