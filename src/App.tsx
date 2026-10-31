import { BookOpen, List, LocateFixed, Map as MapIcon, Navigation } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { TYPES, type ExperienceType } from './data/catalog'
import type { Spawn } from './data/spawns'
import { useCollection } from './hooks/useCollection'
import { useLocation } from './hooks/useLocation'
import { useNow } from './hooks/useNow'
import { useSpawns } from './hooks/useSpawns'
import { sortViews, viewSpawn } from './lib/spawnView'
import { parseUrlState, toSearch, type Tab } from './lib/urlState'
import { groupByVenue } from './lib/venues'
import { MapView } from './components/MapView'
import { SpawnCard } from './components/SpawnCard'
import { SpawnSheet } from './components/SpawnSheet'
import { CatchOverlay } from './components/CatchOverlay'
import { DexView } from './components/DexView'
import { VenueSheet } from './components/VenueSheet'
import { BrandMark, TypeIcon } from './components/Icons'

// Required by the CC BY 4.0 license of the city's events data.
const MONTREAL_OPEN_DATA_ATTRIBUTION =
  'Events: <a href="https://donnees.montreal.ca/dataset/evenements-publics">Ville de Montréal</a> (CC BY 4.0)'

const TABS = [
  ['map', MapIcon, 'Map'],
  ['nearby', List, 'Nearby'],
  ['dex', BookOpen, 'Dex'],
] as const satisfies readonly (readonly [Tab, unknown, string])[]

export default function App() {
  const { spawns, source: dataSource } = useSpawns()
  const now = useNow()
  const { position, source, gpsAvailable, teleport, followGps } = useLocation()
  const { catches, add, has, reset } = useCollection()
  // The view is restored from the URL, so a shared link opens on the same tab, filter and spawn.
  const [initial] = useState(() => parseUrlState(window.location.search))
  const [tab, setTab] = useState<Tab>(initial.tab)
  const [selectedId, setSelectedId] = useState<string | null>(initial.spawn)
  // The venue whose list is open. Closing an event opened from it goes back to the list.
  const [venueKey, setVenueKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<ExperienceType | null>(initial.type)
  const [justCaught, setJustCaught] = useState<Spawn | null>(null)

  const views = useMemo(
    () => sortViews(spawns.map((s) => viewSpawn(s, position, now, has(s.id)))),
    [spawns, position, now, has],
  )
  const filtered = useMemo(() => (filter ? views.filter((v) => v.spawn.type === filter) : views), [views, filter])
  const venues = useMemo(() => groupByVenue(filtered), [filtered])
  const venue = venues.find((g) => g.key === venueKey) ?? null
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
    setVenueKey(null)
    setSelectedId(id)
    setTab('map')
  }

  const openVenue = (key: string) => {
    setSelectedId(null)
    setVenueKey(key)
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
          <BrandMark /> Spawn
        </h1>
        <div className="topbar-right">
          <span className="chip chip-live">
            <span className="live-dot" aria-hidden="true" />
            {liveCount} live
          </span>
          <span className="chip" title={dataSource.kind === 'demo' ? dataSource.reason : 'Events from the Spawn API'}>
            {dataSource.kind === 'api' ? 'Real events' : dataSource.kind === 'demo' ? 'Sample data' : 'Loading…'}
          </span>
          <button
            className="chip chip-icon"
            onClick={followGps}
            disabled={!gpsAvailable || source === 'gps'}
            aria-label={source === 'gps' ? 'Using your location' : 'Demo mode: tap the map to move. Use my location'}
            title={source === 'gps' ? 'Using your location' : 'Demo mode: tap the map to move'}
          >
            {source === 'gps' ? (
              <LocateFixed size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Navigation size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
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
              onClick={() => setFilter(filter === type ? null : type)}
            >
              <TypeIcon type={type} size={14} /> {TYPES[type].label}
            </button>
          ))}
        </div>
      )}

      <main className="content">
        {tab === 'map' && (
          <>
            <MapView
              venues={venues}
              me={position}
              now={now}
              selectedId={selectedId}
              selectedVenue={venue?.key ?? null}
              dataAttribution={dataSource.kind === 'api' ? MONTREAL_OPEN_DATA_ATTRIBUTION : undefined}
              onSelect={(id) => {
                setVenueKey(null)
                setSelectedId(id)
              }}
              onSelectVenue={openVenue}
              onTeleport={(p) => {
                setSelectedId(null)
                setVenueKey(null)
                teleport(p)
              }}
            />
            {!selected && !venue && (
              <div className="map-hint" aria-live="polite">
                {catchable > 0
                  ? `${catchable} within reach — tap one to catch it`
                  : source === 'demo'
                    ? 'Demo mode: tap the map to move around'
                    : 'Walk toward a spawn to catch it'}
              </div>
            )}
            {selected ? (
              <SpawnSheet view={selected} now={now} onClose={() => setSelectedId(null)} onCatch={catchSpawn} />
            ) : (
              venue && (
                <VenueSheet venue={venue} now={now} onClose={() => setVenueKey(null)} onSelect={setSelectedId} />
              )
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
        {TABS.map(([id, Icon, label]) => (
          <button
            key={id}
            className={`tab ${tab === id ? 'tab-on' : ''}`}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="tab-icon" />
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
