import { formatDistance } from '../lib/geo'
import type { SpawnView } from '../lib/spawnView'
import { isEndingSoon, timeLabel } from '../lib/time'
import { RarityBadge } from './Badges'
import { Check } from 'lucide-react'
import { TypeIcon } from './Icons'

interface Props {
  view: SpawnView
  now: number
  onClick: () => void
}

export function SpawnCard({ view: v, now, onClick }: Props) {
  const ending = isEndingSoon(v.spawn, now)
  return (
    <button className={`card card-${v.status} ${v.caught ? 'card-caught' : ''}`} onClick={onClick}>
      <span className="card-icon" aria-hidden="true">
        {v.concealed ? '?' : <TypeIcon type={v.spawn.type} size={18} />}
      </span>
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
          <Check size={16} strokeWidth={2.25} aria-hidden="true" />
          <span className="sr-only">Caught</span>
        </div>
      )}
    </button>
  )
}
