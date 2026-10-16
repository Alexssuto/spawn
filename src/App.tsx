import { useMemo, useState } from 'react'
import { TYPES, type ExperienceType } from './data/catalog'
import { loadSpawns, type Spawn } from './data/spawns'
import { useCollection } from './hooks/useCollection'
import { useLocation } from './hooks/useLocation'
import { useNow } from './hooks/useNow'
import { sortViews, viewSpawn } from './lib/spawnView'
import { MapView } from './components/MapView'
import { SpawnCard } from './components/SpawnCard'
import { SpawnSheet } from './components/SpawnSheet'
import { CatchOverlay } from './components/CatchOverlay'
import { DexView } from './components/DexView'

type Tab = 'map' | 'nearby' | 'dex'

export default function App() {
  const [spawns] = useState(() => loadSpawns())
  const now = useNow()
  const { position, source, gpsAvailable, teleport, followGps } = useLocation()
  const { catches, add, has, reset } = useCollection()
  const [tab, setTab] = useState<Tab>('map')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ExperienceType | null>(null)
  const [justCaught, setJustCaught] = useState<Spawn | null>(null)

  const views = useMemo(
    () => sortViews(spawns.map((s) => viewSpawn(s, position, now, has(s.id)))),
    [spawns, position, now, has],
  )
  const filtered = filter ? views.filter((v) => v.spawn.type === filter) : views
  const selected = views.find((v) => v.spawn.id === selectedId) ?? null
  const liveCount = views.filter((v) => v.status === 'live' && !v.caught).length
  const catchable = views.filter((v) => v.canCatch).length

  const openSpawn = (id: string) => {
    setSelectedId(id)
    setTab('map')
  }

  const catchSpawn = () => {
    if (!selected?.canCatch) return
    add(selected.spawn)
    setJustCaught(selected.spawn)
    setSelectedId(null)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◉</span> Spawn
        </div>
        <div className="topbar-right">
          <span className="chip chip-live">
            <span className="live-dot" />
            {liveCount} live
          </span>
          <button
            className={`chip ${source === 'gps' ? 'chip-gps' : ''}`}
            onClick={followGps}
            disabled={!gpsAvailable || source === 'gps'}
            title={source === 'gps' ? 'Using your location' : 'Demo mode: tap the map to move'}
          >
            {source === 'gps' ? '📍 GPS' : '🧭 Demo'}
          </button>
        </div>
      </header>

      {tab !== 'dex' && (
        <div className="filters">
          <button className={`filter ${filter === null ? 'filter-on' : ''}`} onClick={() => setFilter(null)}>
            All
          </button>
          {(Object.keys(TYPES) as ExperienceType[]).map((type) => (
            <button
              key={type}
              className={`filter ${filter === type ? 'filter-on' : ''}`}
              style={filter === type ? { borderColor: TYPES[type].color, color: TYPES[type].color } : undefined}
              onClick={() => setFilter(filter === type ? null : type)}
            >
              {TYPES[type].icon} {TYPES[type].label}
            </button>
          ))}
        </div>
      )}

      <main className="content">
        {tab === 'map' && (
          <>
            <MapView
              views={filtered}
              me={position}
              now={now}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onTeleport={(p) => {
                setSelectedId(null)
                teleport(p)
              }}
            />
            {!selected && (
              <div className="map-hint">
                {catchable > 0
                  ? `⚡ ${catchable} in range — tap to catch`
                  : source === 'demo'
                    ? 'Demo mode: tap the map to move around'
                    : 'Walk toward a spawn to catch it'}
              </div>
            )}
            {selected && (
              <SpawnSheet view={selected} now={now} onClose={() => setSelectedId(null)} onCatch={catchSpawn} />
            )}
          </>
        )}

        {tab === 'nearby' && (
          <div className="list">
            {filtered.length === 0 && <p className="muted empty">Nothing of this type right now.</p>}
            {filtered.map((v) => (
              <SpawnCard key={v.spawn.id} view={v} now={now} onClick={() => openSpawn(v.spawn.id)} />
            ))}
          </div>
        )}

        {tab === 'dex' && <DexView catches={catches} spawns={spawns} onReset={reset} />}
      </main>

      <nav className="tabbar">
        {(
          [
            ['map', '🗺️', 'Map'],
            ['nearby', '⚡', 'Nearby'],
            ['dex', '📖', 'Dex'],
          ] as const
        ).map(([id, icon, label]) => (
          <button key={id} className={`tab ${tab === id ? 'tab-on' : ''}`} onClick={() => setTab(id)}>
            <span className="tab-icon">{icon}</span>
            {label}
            {id === 'dex' && catches.length > 0 && <span className="tab-count">{catches.length}</span>}
          </button>
        ))}
      </nav>

      {justCaught && (
        <CatchOverlay spawn={justCaught} dexNumber={catches.length} onDone={() => setJustCaught(null)} />
      )}
    </div>
  )
}
