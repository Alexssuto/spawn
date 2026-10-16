import { RARITIES, RARITY_ORDER, TYPES, type ExperienceType } from '../data/catalog'
import type { Spawn } from '../data/spawns'
import type { Catch } from '../hooks/useCollection'

interface Props {
  catches: Catch[]
  spawns: Spawn[]
  onReset: () => void
}

export function levelFromXp(xp: number) {
  // Each level costs 250 XP more than the last: 250, 500, 750...
  let level = 1
  let need = 250
  let rest = xp
  while (rest >= need) {
    rest -= need
    level++
    need += 250
  }
  return { level, progress: rest / need, toNext: need - rest }
}

export function DexView({ catches, spawns, onReset }: Props) {
  const xp = catches.reduce((sum, c) => sum + RARITIES[c.rarity].xp, 0)
  const { level, progress, toNext } = levelFromXp(xp)
  const total = spawns.length
  const pct = total ? Math.round((catches.length / total) * 100) : 0
  const types = Object.keys(TYPES) as ExperienceType[]

  return (
    <div className="dex">
      <div className="dex-card">
        <div className="dex-region">MONTRÉAL</div>
        <div className="dex-count">
          {catches.length}
          <span>/{total}</span>
        </div>
        <div className="dex-pct">{pct}% explored</div>
        <div className="dex-level">
          <span>Lv. {level}</span>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="muted">{toNext} XP to next</span>
        </div>
        <div className="dex-rarities">
          {RARITY_ORDER.map((r) => (
            <div key={r} style={{ color: RARITIES[r].color }}>
              <b>{catches.filter((c) => c.rarity === r).length}</b>
              <span>{RARITIES[r].label}</span>
            </div>
          ))}
        </div>
      </div>

      <h3 className="section-title">By type</h3>
      <div className="dex-types">
        {types.map((type) => {
          const t = TYPES[type]
          const have = catches.filter((c) => c.type === type).length
          const of = spawns.filter((s) => s.type === type).length
          return (
            <div key={type} className="dex-type" style={{ borderColor: `${t.color}44` }}>
              <span className="dex-type-icon">{t.icon}</span>
              <span>{t.label}</span>
              <b style={{ color: t.color }}>
                {have}/{of}
              </b>
            </div>
          )
        })}
      </div>

      <h3 className="section-title">Caught</h3>
      {catches.length === 0 ? (
        <p className="muted empty">Nothing yet. Head to the map and catch your first experience.</p>
      ) : (
        <ul className="dex-list">
          {[...catches].reverse().map((c, i) => {
            const t = TYPES[c.type]
            return (
              <li key={c.spawnId}>
                <span className="dex-num">#{catches.length - i}</span>
                <span className="dex-list-icon" style={{ color: t.color }}>
                  {t.icon}
                </span>
                <span className="dex-list-body">
                  <b>{c.title}</b>
                  <span className="muted">
                    {c.place} · {new Date(c.caughtAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </span>
                <span style={{ color: RARITIES[c.rarity].color }} className="dex-list-rarity">
                  {RARITIES[c.rarity].label}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {catches.length > 0 && (
        <button className="link-btn" onClick={onReset}>
          Reset collection
        </button>
      )}
    </div>
  )
}
