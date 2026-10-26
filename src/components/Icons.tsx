import type { LucideIcon, LucideProps } from 'lucide-react'
import { Drama, Moon, Music, PartyPopper, Trees, UtensilsCrossed, Volleyball } from 'lucide-react'
import type { ExperienceType } from '../data/catalog'

// One outline icon set (Lucide, ISC license) at a 1.75 stroke, in place of emoji: emoji render
// differently on every phone and read as a template.
const TYPE_ICONS: Record<ExperienceType, LucideIcon> = {
  music: Music,
  food: UtensilsCrossed,
  night: Moon,
  culture: Drama,
  sport: Volleyball,
  nature: Trees,
  social: PartyPopper,
}

export function TypeIcon({ type, size = 16, ...props }: { type: ExperienceType } & LucideProps) {
  const Icon = TYPE_ICONS[type]
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" {...props} />
}

/** Spawn's mark: a pin's reach seen from above, the 150 m catch ring around a point. */
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="brand-mark">
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2.2" />
      <circle cx="10" cy="10" r="3.25" fill="currentColor" />
    </svg>
  )
}
