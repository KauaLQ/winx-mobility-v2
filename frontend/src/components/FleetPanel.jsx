import { useMemo, useState } from 'react'
import { MdAdd, MdDeleteOutline } from 'react-icons/md'
import { api, errorMessage } from '../api'
import { KIND_META, PHASE_LABEL, VEHICLE_META, fmtDuration } from '../constants'

const FILTERS = [
  ['todos', 'Todos'],
  ['disponivel', 'Disponíveis'],
  ['em_corrida', 'Em corrida'],
]

export default function FleetPanel({ vehicles, trips, nodesById, selectedId, onSelect, onAdd, onChanged }) {
  const [filter, setFilter] = useState('todos')
  const [error, setError] = useState(null)
  const tripsById = useMemo(() => Object.fromEntries(trips.map((t) => [t.id, t])), [trips])
  const name = (id) => nodesById[id]?.name ?? `Nó ${id}`

  const list = vehicles
    .filter((v) => filter === 'todos' || v.status === filter)
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'em_corrida' ? -1 : 1))

  const recent = trips.filter((t) => t.phase === 'concluida').slice(-5).reverse()

  const remove = async (v) => {
    if (!window.confirm(`Excluir ${v.name} (${v.plate})?`)) return
    setError(null)
    try {
      await api.deleteVehicle(v.id)
      if (v.id === selectedId) onSelect(null)
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-bold text-ink">Frota</h2>
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
          >
            <MdAdd size={18} aria-hidden />
            Novo veículo
          </button>
        </div>
        <div role="group" aria-label="Filtrar veículos" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-tint p-1">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                filter === id ? 'bg-surface text-ink shadow-sm' : 'text-mist hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-line border-l-4 border-l-alert bg-surface p-3 text-sm text-mist">
          {error}
        </p>
      )}
      {list.length === 0 && <p className="text-sm text-mist">Nenhum veículo neste filtro.</p>}

      <ul className="flex flex-col gap-3">
        {list.map((v) => {
          const meta = VEHICLE_META[v.type]
          const trip = v.status === 'em_corrida' ? tripsById[v.trip_id] : null
          const selected = v.id === selectedId
          const busy = v.status === 'em_corrida'
          return (
            <li key={v.id} className="relative">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : v.id)}
                className={`flex w-full gap-3 rounded-xl border bg-surface p-3 text-left transition-colors ${
                  selected ? 'border-primary ring-1 ring-primary/30' : 'border-line hover:border-wx-cobalt/50'
                }`}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                  style={{ backgroundColor: `${meta.color}26`, color: meta.deep }}
                >
                  <meta.Icon size={24} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{v.name}</span>
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        busy ? 'bg-wx-violet/15 text-wx-violet-deep' : 'bg-wx-cyan/15 text-wx-cyan-deep'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {busy ? 'Em corrida' : 'Disponível'}
                    </span>
                  </span>
                  <span className="block text-xs text-mist">
                    {meta.label} · {v.plate} · {v.driver_name ? `Motorista: ${v.driver_name}` : 'Sem motorista'}
                  </span>

                  {trip ? (
                    <>
                      <span className="mt-1 block text-sm text-ink">{PHASE_LABEL[trip.phase]}</span>
                      <span className="block text-sm text-mist">
                        {KIND_META[trip.request.kind].label} de {name(trip.request.origin_node)} para{' '}
                        {name(trip.request.destination_node)}
                      </span>
                      <span className="mt-1 block text-xs text-mist">Rota atual: {v.route.map((id) => name(id)).join(' › ')}</span>
                      <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-mist">
                        <span>Previsão total {fmtDuration(trip.eta_total_s)}</span>
                        {trip.reroutes > 0 && (
                          <span className="font-medium text-warn-deep">
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
              {!busy && (
                <button
                  type="button"
                  onClick={() => remove(v)}
                  aria-label={`Excluir ${v.name}`}
                  title="Excluir veículo"
                  className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg text-mist transition-colors hover:text-alert-deep"
                >
                  <MdDeleteOutline size={20} aria-hidden />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {recent.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h3 className="text-sm font-semibold text-ink">Últimas viagens concluídas</h3>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-mist">
            {recent.map((t) => (
              <li key={t.id}>
                <b className="font-semibold text-ink">{t.vehicle_name}</b> levou {KIND_META[t.request.kind].label.toLowerCase()} de{' '}
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