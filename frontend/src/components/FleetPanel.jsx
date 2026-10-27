import { useMemo, useState } from 'react'
import { KIND_META, PHASE_LABEL, VEHICLE_META, fmtDuration } from '../constants'

const FILTERS = [
  ['todos', 'Todos'],
  ['disponivel', 'Disponíveis'],
  ['em_corrida', 'Em corrida'],
]

export default function FleetPanel({ vehicles, trips, nodesById, selectedId, onSelect }) {
  const [filter, setFilter] = useState('todos')
  const tripsById = useMemo(() => Object.fromEntries(trips.map((t) => [t.id, t])), [trips])
  const name = (id) => nodesById[id]?.name ?? `Nó ${id}`

  const list = vehicles
    .filter((v) => filter === 'todos' || v.status === filter)
    .sort((a, b) => (a.status === b.status ? a.id.localeCompare(b.id) : a.status === 'em_corrida' ? -1 : 1))

  const recent = trips.filter((t) => t.phase === 'concluida').slice(-5).reverse()

  return (
    <div className="flex flex-col">
      <div className="border-b border-rail px-4 pb-0 pt-4">
        <h2 className="font-display text-sm font-bold">Frota</h2>
        <div role="group" aria-label="Filtrar veículos" className="mt-3 flex gap-5">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`border-b-2 pb-2.5 text-sm font-semibold ${
                filter === id ? 'border-wx-cyan text-white' : 'border-transparent text-mist hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 && <p className="p-4 text-sm text-mist">Nenhum veículo neste filtro.</p>}

      <ul>
        {list.map((v) => {
          const meta = VEHICLE_META[v.type]
          const trip = v.status === 'em_corrida' ? tripsById[v.trip_id] : null
          const selected = v.id === selectedId
          const busy = v.status === 'em_corrida'
          return (
            <li key={v.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : v.id)}
                className={`relative flex w-full gap-3 border-b border-rail py-3 pl-5 pr-4 text-left ${
                  selected ? 'bg-rail/70' : 'hover:bg-rail/30'
                }`}
              >
                <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: meta.color }} />
                <span className="text-2xl leading-none" aria-hidden>
                  {meta.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{v.id}</span>
                    <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: busy ? '#c58bf0' : '#25c4dd' }}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {busy ? 'Em corrida' : 'Disponível'}
                    </span>
                  </span>

                  {trip ? (
                    <>
                      <span className="mt-1 block text-sm">{PHASE_LABEL[trip.phase]}</span>
                      <span className="block text-sm text-mist">
                        {KIND_META[trip.request.kind].label} de {name(trip.request.origin_node)} para{' '}
                        {name(trip.request.destination_node)}
                      </span>
                      <span className="mt-1 block text-xs text-mist">Rota atual: {v.route.map((id) => name(id)).join(' › ')}</span>
                      <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-mist">
                        <span>Previsão total {fmtDuration(trip.eta_total_s)}</span>
                        {trip.reroutes > 0 && (
                          <span className="text-warn">
                            {trip.reroutes} {trip.reroutes > 1 ? 'recálculos' : 'recálculo'} de rota
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="mt-0.5 block text-sm text-mist">
                      {meta.label} aguardando em {name(v.current_node)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {recent.length > 0 && (
        <section className="p-4">
          <h3 className="text-sm font-semibold">Últimas viagens concluídas</h3>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-mist">
            {recent.map((t) => (
              <li key={t.id}>
                <b className="font-semibold text-white">{t.vehicle_id}</b> levou {KIND_META[t.request.kind].label.toLowerCase()} de{' '}
                {name(t.request.origin_node)} para {name(t.request.destination_node)} em{' '}
                {fmtDuration(t.completed_at_s - t.created_at_s)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
