import { useEffect, useMemo, useState } from 'react'
import { TYPES, type ExperienceType } from './data/catalog'
import type { Spawn } from './data/spawns'
import { useCollection } from './hooks/useCollection'
import { useLocation } from './hooks/useLocation'
import { useNow } from './hooks/useNow'
import { useSpawns } from './hooks/useSpawns'
import { sortViews, viewSpawn } from './lib/spawnView'
import { parseUrlState, toSearch, type Tab } from './lib/urlState'
import { MapView } from './components/MapView'
import { SpawnCard } from './components/SpawnCard'
import { SpawnSheet } from './components/SpawnSheet'
import { CatchOverlay } from './components/CatchOverlay'
import { DexView } from './components/DexView'

// Required by the CC BY 4.0 license of the city's events data.
const MONTREAL_OPEN_DATA_ATTRIBUTION =
  'Events: <a href="https://donnees.montreal.ca/dataset/evenements-publics">Ville de Montréal</a> (CC BY 4.0)'

const TABS: readonly (readonly [Tab, string, string])[] = [
  ['map', '🗺️', 'Map'],
  ['nearby', '⚡', 'Nearby'],
  ['dex', '📖', 'Dex'],
]

export default function App() {
  const { spawns, source: dataSource } = useSpawns()
  const now = useNow()
  const { position, source, gpsAvailable, teleport, followGps } = useLocation()
  const { catches, add, has, reset } = useCollection()
  // The view is restored from the URL, so a shared link opens on the same tab, filter and spawn.
  const [initial] = useState(() => parseUrlState(window.location.search))
  const [tab, setTab] = useState<Tab>(initial.tab)
  const [selectedId, setSelectedId] = useState<string | null>(initial.spawn)
  const [filter, setFilter] = useState<ExperienceType | null>(initial.type)
  const [justCaught, setJustCaught] = useState<Spawn | null>(null)

  const views = useMemo(
    () => sortViews(spawns.map((s) => viewSpawn(s, position, now, has(s.id)))),
    [spawns, position, now, has],
  )
  const filtered = filter ? views.filter((v) => v.spawn.type === filter) : views
  const selected = views.find((v) => v.spawn.id === selectedId) ?? null
  const liveCount = views.filter((v) => v.status === 'live' && !v.caught).length
  const catchable = views.filter((v) => v.canCatch).length

  // Once spawns have loaded, a link to a spawn that no longer exists shouldn't keep a dead id in the URL.
  const loaded = dataSource.kind !== 'loading'
  const urlSpawn = selected || !loaded ? selectedId : null

  // The URL is the external system here: mirror the view into it so it can be shared or reloaded.
  useEffect(() => {
    const search = toSearch({ tab, type: filter, spawn: urlSpawn })
    window.history.replaceState(null, '', `${window.location.pathname}${search}`)
  }, [tab, filter, urlSpawn])

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
        <h1 className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◉
          </span>{' '}
          Spawn
        </h1>
        <div className="topbar-right">
          <span
            className={`chip ${dataSource.kind === 'api' ? 'chip-gps' : ''}`}
            title={dataSource.kind === 'demo' ? dataSource.reason : 'Events from the Spawn API'}
          >
            {dataSource.kind === 'api' ? '🛰️ Real' : dataSource.kind === 'demo' ? '🧪 Sample' : '…'}
          </span>
          <span className="chip chip-live">
            <span className="live-dot" aria-hidden="true" />
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
        <div className="filters" role="group" aria-label="Filter by type">
          <button
            className={`filter ${filter === null ? 'filter-on' : ''}`}
            aria-pressed={filter === null}
            onClick={() => setFilter(null)}
          >
            All
          </button>
          {(Object.keys(TYPES) as ExperienceType[]).map((type) => (
            <button
              key={type}
              className={`filter ${filter === type ? 'filter-on' : ''}`}
              aria-pressed={filter === type}
              style={filter === type ? { borderColor: TYPES[type].color, color: TYPES[type].color } : undefined}
              onClick={() => setFilter(filter === type ? null : type)}
            >
              <span aria-hidden="true">{TYPES[type].icon}</span> {TYPES[type].label}
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
              dataAttribution={dataSource.kind === 'api' ? MONTREAL_OPEN_DATA_ATTRIBUTION : undefined}
              onSelect={setSelectedId}
              onTeleport={(p) => {
                setSelectedId(null)
                teleport(p)
              }}
            />
            {!selected && (
              <div className="map-hint" aria-live="polite">
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

      <nav className="tabbar" aria-label="Sections">
        {TABS.map(([id, icon, label]) => (
          <button
            key={id}
            className={`tab ${tab === id ? 'tab-on' : ''}`}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <span className="tab-icon" aria-hidden="true">
              {icon}
            </span>
            {label}
            {id === 'dex' && catches.length > 0 && (
              <span className="tab-count" aria-label={`${catches.length} caught`}>
                {catches.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {justCaught && (
        <CatchOverlay spawn={justCaught} dexNumber={catches.length} onDone={() => setJustCaught(null)} />
      )}
    </div>
  )
}
