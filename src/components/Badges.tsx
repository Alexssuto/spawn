import { RARITIES, TYPES, type ExperienceType, type Rarity } from '../data/catalog'
import { TypeIcon } from './Icons'

export function TypeBadge({ type }: { type: ExperienceType }) {
  return (
    <span className="pill">
      <TypeIcon type={type} size={13} /> {TYPES[type].label}
    </span>
  )
}

/** Neutral pills; only Legendary takes the accent, because it's the one rarity worth crossing town for. */
export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return <span className={`pill ${rarity === 'legendary' ? 'pill-accent' : ''}`}>{RARITIES[rarity].label}</span>
}
