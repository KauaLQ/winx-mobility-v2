import { useMemo, useState } from 'react'
import FleetPanel from './components/FleetPanel'
import Header from './components/Header'
import PlantMap from './components/PlantMap'
import RequestPanel from './components/RequestPanel'
import SimControls from './components/SimControls'
import StatsStrip from './components/StatsStrip'
import { useLiveData } from './hooks/useLiveData'

const TABS = [
  ['request', 'Solicitar', '📍'],
  ['map', 'Mapa', '🗺️'],
  ['fleet', 'Frota', '🚐'],
]
const EMPTY_DRAFT = { origin: null, destination: null }

export default function App() {
  const { graph, sim, online, refresh } = useLiveData()
  const [view, setView] = useState('map') // aba ativa no celular; no desktop as três áreas aparecem juntas
  const [speed, setSpeed] = useState(5)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [selectedId, setSelectedId] = useState(null)

  const nodes = useMemo(() => graph?.nodes ?? [], [graph])
  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  const vehicles = sim?.vehicles ?? []
  const trips = sim?.trips ?? []

  // Toque nos nós do mapa: primeiro define a origem, depois o destino; um novo toque recomeça.
  const pickNode = (id) =>
    setDraft(({ origin, destination }) => {
      if (origin == null) return { origin: id, destination }
      if (destination == null && id !== origin) return { origin, destination: id }
      return { origin: id, destination: null }
    })

  const onDispatched = (trip) => {
    setSelectedId(trip.vehicle_id)
    setDraft(EMPTY_DRAFT)
    setView('map')
    refresh()
  }

  const onReset = () => {
    setSelectedId(null)
    setDraft(EMPTY_DRAFT)
  }

  const show = (id) => `${view === id ? 'flex' : 'hidden'} lg:flex`

  return (
    <div className="flex h-dvh flex-col bg-abyss">
      <Header online={online} clock={sim?.clock_s ?? 0} />
      <StatsStrip vehicles={vehicles} trips={trips} edges={graph?.edges ?? []} />

      <main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 lg:grid-cols-[22rem_minmax(0,1fr)_25rem]">
        <aside className={`${show('request')} scroll-thin min-h-0 flex-col overflow-y-auto border-rail bg-deck lg:border-r`}>
          <RequestPanel nodes={nodes} vehicles={vehicles} draft={draft} setDraft={setDraft} onDispatched={onDispatched} />
        </aside>

        <section className={`${show('map')} relative min-h-0`}>
          <PlantMap
            graph={graph}
            vehicles={vehicles}
            draft={draft}
            selectedId={selectedId}
            onSelectVehicle={setSelectedId}
            onPickNode={pickNode}
          />
          <div className="absolute left-3 top-3">
            <SimControls running={sim?.running ?? false} speed={speed} setSpeed={setSpeed} onChanged={refresh} onReset={onReset} />
          </div>
        </section>

        <aside className={`${show('fleet')} scroll-thin min-h-0 flex-col overflow-y-auto border-rail bg-deck lg:border-l`}>
          <FleetPanel vehicles={vehicles} trips={trips} nodesById={nodesById} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
      </main>

      <nav className="grid grid-cols-3 border-t border-rail bg-deck pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Seções">
        {TABS.map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? 'page' : undefined}
            onClick={() => setView(id)}
            className={`relative flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${view === id ? 'text-white' : 'text-mist'}`}
          >
            {view === id && <span className="absolute inset-x-8 top-0 h-0.5 bg-wx-gradient" />}
            <span className="text-lg leading-none" aria-hidden>
              {icon}
            </span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
