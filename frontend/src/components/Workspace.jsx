import { useMemo, useState } from 'react'
import { MdFlag, MdPersonPinCircle } from 'react-icons/md'
import { api } from '../api'
import { KIND_META, PALETTE, PROFILES } from '../constants'
import { useLiveData } from '../hooks/useLiveData'
import DashboardPanel from './DashboardPanel'
import DriverPanel from './DriverPanel'
import FleetPanel from './FleetPanel'
import Header from './Header'
import HistoryPanel from './HistoryPanel'
import OfferModal from './OfferModal'
import PlantMap from './PlantMap'
import RequestPanel from './RequestPanel'
import SimControls from './SimControls'
import StatsStrip from './StatsStrip'
import TripDoneModal from './TripDoneModal'
import TripStatusModal from './TripStatusModal'
import VehicleFormModal from './VehicleFormModal'

const TAB_IDS = ['home', 'map', 'list']
const EMPTY_DRAFT = { origin: null, destination: null }
const ACTIVE_PHASES = ['aguardando', 'buscando', 'em_transporte']
const doneKey = (trip) => `${trip.id}:${trip.completed_at_s}` // o tempo evita confundir ids reaproveitados após um reset

// vehicleId: veículo escolhido no "login" do motorista (undefined nos outros perfis).
export default function Workspace({ profileId, vehicleId, who, onExit }) {
  const profile = PROFILES[profileId]
  const tabs = profile.tabs.map(([label, Icon], i) => [TAB_IDS[i], label, Icon])

  const { graph, sim, online, refresh } = useLiveData()
  const [view, setView] = useState('map') // aba ativa
  const [speed, setSpeed] = useState(5)
  const [destination, setDestination] = useState(null) // usuário: destino do próximo pedido
  const [startSeed] = useState(() => Math.random()) // usuário: sorteia o ponto inicial (no lugar do GPS)
  const [selectedId, setSelectedId] = useState(vehicleId ?? null) // o motorista já abre com o seu veículo
  const [tripModalOpen, setTripModalOpen] = useState(false) // usuário: modal de busca/aceite da viagem
  const [dismissed, setDismissed] = useState([]) // motorista: ofertas recusadas
  const [accepting, setAccepting] = useState(false)
  const [seenDone, setSeenDone] = useState(null) // viagens concluídas que já eram conhecidas ou já foram comemoradas
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false) // gestão: modal de cadastro de veículo

  const nodes = useMemo(() => graph?.nodes ?? [], [graph])
  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  const edges = graph?.edges ?? []
  const vehicles = sim?.vehicles ?? []
  const trips = sim?.trips ?? []
  const myTrips = trips.filter((t) => profile.ownsTrip(t, who))
  const myVehicle = vehicles.find((v) => v.id === vehicleId)

  // Na primeira leitura, as concluídas existentes não geram modal: só as que terminarem a partir daqui.
  if (sim && seenDone === null) setSeenDone(trips.filter((t) => t.phase === 'concluida').map(doneKey))
  const finishedTrip =
    profileId !== 'gestor' && seenDone
      ? myTrips.find((t) => t.phase === 'concluida' && !seenDone.includes(doneKey(t)))
      : null

  // Usuário: localização atual. Começa num ponto sorteado e, depois de cada viagem, passa a ser o destino dela.
  const lastDone = [...myTrips].reverse().find((t) => t.phase === 'concluida')
  const startNode = nodes[Math.floor(startSeed * nodes.length)]
  const userNodeId = profileId !== 'usuario' ? null : (lastDone?.request.destination_node ?? startNode?.id ?? null)
  const draft = profileId === 'usuario' ? { origin: userNodeId, destination } : EMPTY_DRAFT

  // Usuário: a viagem em andamento mais recente. Motorista: a viagem do veículo escolhido.
  const activeTrip = profileId === 'usuario' ? [...myTrips].reverse().find((t) => ACTIVE_PHASES.includes(t.phase)) : null
  const focusTrip = profileId === 'motorista' ? trips.find((t) => t.id === myVehicle?.trip_id) : activeTrip

  // Motorista: primeira oferta que chegou para o seu veículo, enquanto ele estiver livre.
  const offer =
    profileId === 'motorista' && myVehicle?.status === 'disponivel'
      ? trips.find((t) => t.phase === 'aguardando' && vehicleId in t.offers && !dismissed.includes(t.id))
      : null

  // Motorista vê só o próprio veículo; o usuário, só o veículo que aceitou a sua viagem.
  let mapVehicles = vehicles
  if (profileId === 'motorista') mapVehicles = vehicles.filter((v) => v.id === vehicleId)
  if (profileId === 'usuario') mapVehicles = vehicles.filter((v) => v.id === activeTrip?.vehicle_id)

  // Marcador do ponto da fase atual: a origem enquanto o veículo busca, o destino depois.
  // O usuário, sem viagem em andamento, aparece na sua localização atual.
  const markers = []
  const toDestination = focusTrip?.phase === 'em_transporte'
  const stop = focusTrip && nodesById[toDestination ? focusTrip.request.destination_node : focusTrip.request.origin_node]
  if (stop) {
    const mark =
      profileId === 'usuario'
        ? { Icon: toDestination ? MdFlag : MdPersonPinCircle, label: toDestination ? 'Destino' : 'Você' }
        : {
            Icon: KIND_META[focusTrip.request.kind].Icon,
            label: toDestination ? 'Destino' : focusTrip.request.kind === 'passageiro' ? 'Embarque' : 'Coleta',
          }
    markers.push({ key: focusTrip.id, x: stop.x, y: stop.y, color: PALETTE.violetDeep, ...mark })
  } else if (nodesById[userNodeId]) {
    const here = nodesById[userNodeId]
    markers.push({ key: 'me', x: here.x, y: here.y, color: PALETTE.violetDeep, Icon: MdPersonPinCircle, label: 'Você' })
  }

  // Toque nos pontos do mapa escolhe o destino (a origem é sempre a localização atual).
  const pickNode = (id) => {
    if (id !== userNodeId) setDestination(id)
  }

  const onDispatched = () => {
    setTripModalOpen(true)
    setDestination(null)
    setView('map')
    refresh()
  }

  const onReset = () => setSelectedId(vehicleId ?? null)

  const acceptOffer = async (trip) => {
    setAccepting(true)
    try {
      await api.acceptTrip(trip.id)
      setView('map')
    } catch {
      // Outro veículo foi mais rápido (ou a corrida foi cancelada): a oferta some.
      setDismissed((d) => [...d, trip.id])
    } finally {
      setAccepting(false)
      refresh()
    }
  }

  const cancelTrip = async (trip) => {
    try {
      await api.cancelTrip(trip.id)
    } catch {
      /* já foi aceita: o modal passa a mostrar o veículo */
    } finally {
      refresh()
    }
  }

  const closeDone = () => {
    setSeenDone((seen) => [...seen, doneKey(finishedTrip)])
    refresh() // traz a avaliação enviada para o histórico
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
              origin={userNodeId}
              destination={destination}
              setDestination={setDestination}
              onDispatched={onDispatched}
            />
          )}
          {profileId === 'motorista' && <DriverPanel vehicle={myVehicle} trips={myTrips} edges={edges} nodesById={nodesById} />}
          {profileId === 'gestor' && <DashboardPanel vehicles={vehicles} trips={trips} edges={edges} />}
        </aside>

        <section inert={view !== 'map'} className={panel('map')}>
          <PlantMap
            graph={graph}
            vehicles={mapVehicles}
            markers={markers}
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
          {profileId === 'usuario' && tripModalOpen && activeTrip && (
            <TripStatusModal trip={activeTrip} onCancel={() => cancelTrip(activeTrip)} onClose={() => setTripModalOpen(false)} />
          )}
        </section>

        <aside inert={view !== 'list'} className={`${panel('list')} scroll-thin overflow-y-auto`}>
          {profileId === 'gestor' ? (
            <FleetPanel
              vehicles={vehicles}
              trips={trips}
              nodesById={nodesById}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAdd={() => setVehicleFormOpen(true)}
              onChanged={refresh}
            />
          ) : (
            <HistoryPanel trips={myTrips} nodesById={nodesById} showVehicle={profileId === 'usuario'} />
          )}
        </aside>

        {/* A oferta de corrida aparece por cima de qualquer aba do motorista */}
        {offer && (
          <OfferModal
            trip={offer}
            vehicleId={vehicleId}
            nodesById={nodesById}
            busy={accepting}
            onAccept={() => acceptOffer(offer)}
            onDecline={() => setDismissed((d) => [...d, offer.id])}
          />
        )}

        {/* Conclusão da viagem: motorista e usuário, em qualquer aba */}
        {finishedTrip && (
          <TripDoneModal key={doneKey(finishedTrip)} trip={finishedTrip} nodesById={nodesById} role={profileId} onClose={closeDone} />
        )}

        {vehicleFormOpen && (
          <VehicleFormModal
            onClose={() => setVehicleFormOpen(false)}
            onCreated={() => {
              setVehicleFormOpen(false)
              refresh()
            }}
          />
        )}
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