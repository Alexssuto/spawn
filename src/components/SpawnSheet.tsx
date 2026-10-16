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
  return (
    <div className="sheet" role="dialog" aria-label={v.displayTitle}>
      <button className="sheet-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="sheet-badges">
        <TypeBadge type={spawn.type} />
        <RarityBadge rarity={spawn.rarity} />
        {spawn.price && <span className="badge badge-muted">{spawn.price}</span>}
      </div>
      <h2 className="sheet-title">{v.displayTitle}</h2>
      <div className="sheet-place">
        📍 {v.displayPlace} · {formatDistance(v.distance)}
      </div>
      <div className={`sheet-time ${v.status === 'live' ? 'text-live' : ''}`}>
        {v.status === 'live' && <span className="live-dot" />}
        {timeLabel(spawn, now)}
      </div>
      {!v.concealed && <p className="sheet-desc">{spawn.description}</p>}
      {!v.concealed && spawn.url && (
        <a className="sheet-link" href={spawn.url} target="_blank" rel="noreferrer">
          Details at the source ↗
        </a>
      )}
      {v.concealed && <p className="sheet-desc muted">Something's out there. Walk closer to find out what.</p>}

      <button className={`catch-btn catch-${spawn.rarity}`} disabled={!v.canCatch} onClick={onCatch}>
        {v.caught ? 'Caught ✓' : `Catch it · +${RARITIES[spawn.rarity].xp} XP`}
      </button>
      {!v.canCatch && <div className="catch-hint">{catchHint(v)}</div>}
    </div>
  )
}
