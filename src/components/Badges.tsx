import { RARITIES, TYPES, type ExperienceType, type Rarity } from '../data/catalog'

export function TypeBadge({ type }: { type: ExperienceType }) {
  const t = TYPES[type]
  return (
    <span className="badge" style={{ color: t.color, borderColor: `${t.color}55`, background: `${t.color}18` }}>
      {t.icon} {t.label}
    </span>
  )
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const r = RARITIES[rarity]
  return (
    <span className={`badge rarity-${rarity}`} style={{ color: r.color, borderColor: `${r.color}55` }}>
      {r.label}
    </span>
  )
}
