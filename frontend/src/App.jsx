import { useMemo, useState } from 'react'
import { MdAddLocationAlt, MdDirectionsBus, MdMap } from 'react-icons/md'
import FleetPanel from './components/FleetPanel'
import Header from './components/Header'
import PlantMap from './components/PlantMap'
import RequestPanel from './components/RequestPanel'
import SimControls from './components/SimControls'
import StatsStrip from './components/StatsStrip'
import { useLiveData } from './hooks/useLiveData'

const TABS = [
  ['request', 'Solicitar', MdAddLocationAlt],
  ['map', 'Mapa', MdMap],
  ['fleet', 'Frota', MdDirectionsBus],
]
const EMPTY_DRAFT = { origin: null, destination: null }

export default function App() {
  const { graph, sim, online, refresh } = useLiveData()
  const [view, setView] = useState('map') // aba ativa
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

  // As três abas ficam montadas e empilhadas: a ativa aparece com fade e um leve deslizar,
  // as outras somem para o lado de onde "vieram". Assim o mapa mantém zoom e posição ao trocar de aba.
  const activeIndex = TABS.findIndex(([id]) => id === view)
  const panel = (id) => {
    const active = view === id
    const before = TABS.findIndex(([tabId]) => tabId === id) < activeIndex
    const state = active
      ? 'visible translate-x-0 opacity-100'
      : `invisible opacity-0 ${before ? '-translate-x-4' : 'translate-x-4'}`
    return `absolute inset-0 transition-[opacity,transform,visibility] duration-300 ease-out ${state}`
  }

  return (
    // O app é sempre mobile: no computador ele aparece como uma coluna de celular centralizada.
    <div className="h-dvh bg-line">
      <div className="mx-auto flex h-full w-full max-w-md flex-col border-x border-line bg-page shadow-xl shadow-ink/10">
        <Header online={online} clock={sim?.clock_s ?? 0} />
        <StatsStrip vehicles={vehicles} trips={trips} edges={graph?.edges ?? []} />

        <main className="relative min-h-0 flex-1 overflow-hidden">
          <aside inert={view !== 'request'} className={`${panel('request')} scroll-thin overflow-y-auto`}>
            <RequestPanel nodes={nodes} vehicles={vehicles} draft={draft} setDraft={setDraft} onDispatched={onDispatched} />
          </aside>

          <section inert={view !== 'map'} className={panel('map')}>
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

          <aside inert={view !== 'fleet'} className={`${panel('fleet')} scroll-thin overflow-y-auto`}>
            <FleetPanel vehicles={vehicles} trips={trips} nodesById={nodesById} selectedId={selectedId} onSelect={setSelectedId} />
          </aside>
        </main>

        <nav className="relative grid grid-cols-3 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]" aria-label="Seções">
          {/* indicador que desliza até a aba ativa */}
          <span
            aria-hidden
            className="absolute left-0 top-0 w-1/3 px-8 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          >
            <span className="block h-0.5 rounded-full bg-wx-gradient" />
          </span>
          {TABS.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-current={view === id ? 'page' : undefined}
              onClick={() => setView(id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition-colors ${
                view === id ? 'text-primary' : 'text-mist hover:text-ink'
              }`}
            >
              <Icon size={22} aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}