import type { CSSProperties } from 'react'
import { RARITIES, TYPES } from '../data/catalog'
import type { Spawn } from '../data/spawns'

interface Props {
  spawn: Spawn
  dexNumber: number
  onDone: () => void
}

export function CatchOverlay({ spawn, dexNumber, onDone }: Props) {
  const t = TYPES[spawn.type]
  const r = RARITIES[spawn.rarity]
  return (
    <div className={`overlay overlay-${spawn.rarity}`} onClick={onDone} style={{ '--c': t.color, '--r': r.color } as CSSProperties}>
      <div className="overlay-inner">
        <div className="overlay-kicker">Caught!</div>
        <div className="overlay-orb">{t.icon}</div>
        <div className="overlay-rarity" style={{ color: r.color }}>
          {r.label} {t.label}
        </div>
        <h2 className="overlay-title">{spawn.title}</h2>
        <div className="overlay-sub">
          Experience #{dexNumber} · +{r.xp} XP
        </div>
        <button className="overlay-btn">Nice</button>
      </div>
    </div>
  )
}
