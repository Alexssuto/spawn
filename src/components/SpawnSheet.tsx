import { MapPin, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { RARITIES } from '../data/catalog'
import { formatDistance } from '../lib/geo'
import { CATCH_RADIUS, type SpawnView } from '../lib/spawnView'
import { timeLabel } from '../lib/time'
import { RarityBadge, TypeBadge } from './Badges'

interface Props {
  view: SpawnView
  now: number
  onClose: () => void
  onCatch: () => void
}

function catchHint(v: SpawnView): string {
  if (v.caught) return 'Already in your Dex'
  if (v.status === 'upcoming') return 'Not live yet'
  if (v.status === 'ended') return 'This one got away'
  if (!v.inRange) return `Get within ${CATCH_RADIUS} m to catch · ${formatDistance(v.distance - CATCH_RADIUS)} to go`
  return ''
}

export function SpawnSheet({ view: v, now, onClose, onCatch }: Props) {
  const { spawn } = v
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const hintId = useId()

  // Move focus into the sheet when it opens (or shows another spawn), so keyboard and
  // screen-reader users land on it instead of staying on the map.
  useEffect(() => {
    sheetRef.current?.focus()
  }, [spawn.id])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const hint = v.canCatch ? '' : catchHint(v)

  return (
    <div className="sheet" role="dialog" aria-labelledby={titleId} tabIndex={-1} ref={sheetRef}>
      <button className="sheet-close" onClick={onClose} aria-label="Close">
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <div className="sheet-badges">
        <TypeBadge type={spawn.type} />
        <RarityBadge rarity={spawn.rarity} />
        {spawn.price && <span className="pill">{spawn.price}</span>}
      </div>
      <h2 className="sheet-title" id={titleId}>
        {v.displayTitle}
      </h2>
      <div className="sheet-place">
        <MapPin size={14} strokeWidth={1.75} aria-hidden="true" /> {v.displayPlace} · {formatDistance(v.distance)}
      </div>
      <div className={`sheet-time ${v.status === 'live' ? 'text-live' : ''}`}>
        {v.status === 'live' && <span className="live-dot" aria-hidden="true" />}
        {timeLabel(spawn, now)}
      </div>
      {!v.concealed && <p className="sheet-desc">{spawn.description}</p>}
      {!v.concealed && spawn.url && (
        <a className="sheet-link" href={spawn.url} target="_blank" rel="noreferrer">
          Details at the source ↗
        </a>
      )}
      {v.concealed && <p className="sheet-desc muted">Something's out there. Walk closer to find out what.</p>}

      <button
        className="catch-btn"
        disabled={!v.canCatch}
        aria-describedby={hint ? hintId : undefined}
        onClick={onCatch}
      >
        {v.caught ? 'Already Caught' : `Catch It · +${RARITIES[spawn.rarity].xp} XP`}
      </button>
      {hint && (
        <div className="catch-hint" id={hintId}>
          {hint}
        </div>
      )}
    </div>
  )
}
