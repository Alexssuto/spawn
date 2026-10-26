import { TYPES } from '../data/catalog'
import { formatDistance } from '../lib/geo'
import type { SpawnView } from '../lib/spawnView'
import { isEndingSoon, timeLabel } from '../lib/time'
import { RarityBadge } from './Badges'

interface Props {
  view: SpawnView
  now: number
  onClick: () => void
}

export function SpawnCard({ view: v, now, onClick }: Props) {
  const t = TYPES[v.spawn.type]
  const ending = isEndingSoon(v.spawn, now)
  return (
    <button className={`card card-${v.status} ${v.caught ? 'card-caught' : ''}`} onClick={onClick}>
      <div
        className="card-icon"
        aria-hidden="true"
        style={{ background: `${t.color}22`, color: t.color, borderColor: `${t.color}66` }}
      >
        {v.concealed ? '?' : t.icon}
      </div>
      <div className="card-body">
        <div className="card-title">{v.displayTitle}</div>
        <div className="card-meta">
          <RarityBadge rarity={v.spawn.rarity} />
          <span>{formatDistance(v.distance)}</span>
          <span className={ending ? 'text-warn' : v.status === 'live' ? 'text-live' : ''}>
            {v.status === 'live' && <span className="live-dot" aria-hidden="true" />}
            {timeLabel(v.spawn, now)}
          </span>
        </div>
      </div>
      {v.caught && (
        <div className="card-check">
          <span aria-hidden="true">✓</span>
          <span className="sr-only">Caught</span>
        </div>
      )}
    </button>
  )
}
