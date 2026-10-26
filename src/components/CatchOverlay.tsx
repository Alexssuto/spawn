import { useEffect, useId, useRef, type CSSProperties } from 'react'
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
  const titleId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  // The celebration is a modal moment: focus its button once when it opens...
  useEffect(() => {
    buttonRef.current?.focus()
  }, [])

  // ...and let Escape dismiss it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDone])

  return (
    <div
      className={`overlay overlay-${spawn.rarity}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      // A click on the backdrop dismisses too; the button is the keyboard and screen-reader path.
      onClick={(e) => {
        if (e.target === e.currentTarget) onDone()
      }}
      style={{ '--c': t.color, '--r': r.color } as CSSProperties}
    >
      <div className="overlay-inner">
        <div className="overlay-kicker">Caught!</div>
        <div className="overlay-orb" aria-hidden="true">
          {t.icon}
        </div>
        <div className="overlay-rarity" style={{ color: r.color }}>
          {r.label} {t.label}
        </div>
        <h2 className="overlay-title" id={titleId}>
          {spawn.title}
        </h2>
        <div className="overlay-sub">
          Experience #{dexNumber} · +{r.xp} XP
        </div>
        <button className="overlay-btn" ref={buttonRef} onClick={onDone}>
          Keep Exploring
        </button>
      </div>
    </div>
  )
}
