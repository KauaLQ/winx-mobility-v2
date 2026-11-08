import { useMemo, useState } from 'react'
import { PROFILES, USER_ID } from '../constants'
import { useLiveData } from '../hooks/useLiveData'
import DashboardPanel from './DashboardPanel'
import DriverPanel from './DriverPanel'
import FleetPanel from './FleetPanel'
import Header from './Header'
import HistoryPanel from './HistoryPanel'
import PlantMap from './PlantMap'
import RequestPanel from './RequestPanel'
import SimControls from './SimControls'
import StatsStrip from './StatsStrip'

const TAB_IDS = ['home', 'map', 'list']
const EMPTY_DRAFT = { origin: null, destination: null }

export default function Workspace({ profileId, onExit }) {
  const profile = PROFILES[profileId]
  const tabs = profile.tabs.map(([label, Icon], i) => [TAB_IDS[i], label, Icon])

  const { graph, sim, online, refresh } = useLiveData()
  const [view, setView] = useState('map') // aba ativa
  const [speed, setSpeed] = useState(5)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [selectedId, setSelectedId] = useState(profile.vehicleId ?? null) // o motorista já abre com o seu veículo

  const nodes = useMemo(() => graph?.nodes ?? [], [graph])
  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  const edges = graph?.edges ?? []
  const vehicles = sim?.vehicles ?? []
  const trips = sim?.trips ?? []
  const myTrips = trips.filter(profile.ownsTrip)

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
    setSelectedId(profile.vehicleId ?? null)
    setDraft(EMPTY_DRAFT)
  }

  // As três abas ficam montadas e empilhadas: a ativa aparece com fade e um leve deslizar,
  // as outras somem para o lado de onde "vieram". Assim o mapa mantém zoom e posição ao trocar de aba.
  const activeIndex = tabs.findIndex(([id]) => id === view)
  const panel = (id) => {
    const active = view === id
    const before = tabs.findIndex(([tabId]) => tabId === id) < activeIndex
    const state = active
      ? 'visible translate-x-0 opacity-100'
      : `invisible opacity-0 ${before ? '-translate-x-4' : 'translate-x-4'}`
    return `absolute inset-0 transition-[opacity,transform,visibility] duration-300 ease-out ${state}`
  }

  return (
    <>
      <Header online={online} clock={sim?.clock_s ?? 0} profile={profile} onExit={onExit} />
      {profileId === 'gestor' && <StatsStrip vehicles={vehicles} trips={trips} edges={edges} />}

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <aside inert={view !== 'home'} className={`${panel('home')} scroll-thin overflow-y-auto`}>
          {profileId === 'usuario' && (
            <RequestPanel
              nodes={nodes}
              vehicles={vehicles}
              draft={draft}
              setDraft={setDraft}
              requesterId={USER_ID}
              onDispatched={onDispatched}
            />
          )}
          {profileId === 'motorista' && (
            <DriverPanel
              vehicle={vehicles.find((v) => v.id === profile.vehicleId)}
              trips={myTrips}
              edges={edges}
              nodesById={nodesById}
            />
          )}
          {profileId === 'gestor' && <DashboardPanel vehicles={vehicles} trips={trips} edges={edges} />}
        </aside>

        <section inert={view !== 'map'} className={panel('map')}>
          <PlantMap
            graph={graph}
            vehicles={vehicles}
            showVehicles={profile.map.vehicles}
            canSeeRestrictions={profile.map.restrictions}
            draft={draft}
            selectedId={selectedId}
            onSelectVehicle={setSelectedId}
            onPickNode={profileId === 'usuario' ? pickNode : undefined}
          />
          {profile.map.simControls && (
            <div className="absolute left-3 top-3">
              <SimControls running={sim?.running ?? false} speed={speed} setSpeed={setSpeed} onChanged={refresh} onReset={onReset} />
            </div>
          )}
        </section>

        <aside inert={view !== 'list'} className={`${panel('list')} scroll-thin overflow-y-auto`}>
          {profileId === 'gestor' ? (
            <FleetPanel vehicles={vehicles} trips={trips} nodesById={nodesById} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <HistoryPanel trips={myTrips} nodesById={nodesById} showVehicle={profileId === 'usuario'} />
          )}
        </aside>
      </main>

      <nav className="relative grid grid-cols-3 border-t border-white/10 bg-navy-deep pb-[env(safe-area-inset-bottom)]" aria-label="Seções">
        {/* indicador que desliza até a aba ativa */}
        <span
          aria-hidden
          className="absolute left-0 top-0 w-1/3 px-8 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        >
          <span className="block h-0.5 rounded-full bg-wx-gradient" />
        </span>
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? 'page' : undefined}
            onClick={() => setView(id)}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition-colors ${
              view === id ? 'text-white' : 'text-navy-soft hover:text-white'
            }`}
          >
            <Icon size={22} aria-hidden />
            {label}
          </button>
        ))}
      </nav>
    </>
  )
}
