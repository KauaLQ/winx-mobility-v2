import { CONGESTION_WARN, KIND_META, PHASE_LABEL, VEHICLE_META, fmtDistance, fmtDuration } from '../constants'

// `trips` já chega filtrado: só as viagens deste veículo.
export default function DriverPanel({ vehicle, trips, edges, nodesById }) {
  if (!vehicle) return <p className="p-4 text-sm text-mist">Conectando ao veículo…</p>

  const name = (id) => nodesById[id]?.name ?? `Nó ${id}`
  const meta = VEHICLE_META[vehicle.type]
  const busy = vehicle.status === 'em_corrida'
  const trip = busy ? trips.find((t) => t.id === vehicle.trip_id) : null
  const done = trips.filter((t) => t.phase === 'concluida')

  // Alguma via do restante da rota está congestionada?
  const jammed = busy && vehicle.route.slice(1).some((id, i) => {
    const edge = edges.find((e) => e.source === vehicle.route[i] && e.target === id)
    return edge && edge.congestion_factor >= CONGESTION_WARN
  })

  const avgTrip = done.length ? done.reduce((s, t) => s + t.completed_at_s - t.created_at_s, 0) / done.length : 0
  const stats = [
    ['viagens concluídas', done.length],
    ['tempo médio por viagem', done.length ? fmtDuration(avgTrip) : '—'],
    ['distância percorrida', fmtDistance(done.reduce((s, t) => s + t.distance_m, 0))],
    ['recálculos de rota', trips.reduce((s, t) => s + t.reroutes, 0)],
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: `${meta.color}26`, color: meta.deep }}
        >
          <meta.Icon size={26} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-bold text-ink">{vehicle.id}</h2>
          <p className="mt-1 text-sm text-mist">
            {meta.label} para {vehicle.allowed_kinds.map((k) => KIND_META[k].label.toLowerCase()).join(' e ')}
          </p>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
            busy ? 'bg-wx-violet/15 text-wx-violet-deep' : 'bg-wx-cyan/15 text-wx-cyan-deep'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {busy ? 'Em corrida' : 'Disponível'}
        </span>
      </div>

      {trip ? (
        <section className="rounded-xl border border-line border-l-4 border-l-wx-violet bg-surface p-4">
          <h3 className="text-sm font-semibold text-ink">Corrida atual · {PHASE_LABEL[trip.phase]}</h3>
          <p className="mt-2 text-sm text-ink">
            {KIND_META[trip.request.kind].label} de {name(trip.request.origin_node)} para {name(trip.request.destination_node)}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-mist">Próxima parada</dt>
              <dd className="font-semibold text-ink">{name(vehicle.route[1] ?? vehicle.current_node)}</dd>
            </div>
            <div>
              <dt className="text-xs text-mist">Previsão total</dt>
              <dd className="font-semibold text-ink">{fmtDuration(trip.eta_total_s)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-mist">Rota atual: {vehicle.route.map((id) => name(id)).join(' › ')}</p>
          {jammed && (
            <p role="alert" className="mt-3 text-sm font-medium text-warn-deep">
              Há via congestionada no seu trajeto. A rota pode ser recalculada.
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-xl border border-line border-l-4 border-l-wx-cyan bg-surface p-4">
          <h3 className="text-sm font-semibold text-ink">Aguardando chamado</h3>
          <p className="mt-1 text-sm text-mist">Você está em {name(vehicle.current_node)}. A próxima corrida aparece aqui.</p>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-ink">Seu turno</h3>
        <ul className="mt-2 grid grid-cols-2 gap-3">
          {stats.map(([label, value]) => (
            <li key={label} className="rounded-xl border border-line bg-surface p-3">
              <p className="font-display text-base font-bold text-ink">{value}</p>
              <p className="mt-1 text-xs text-mist">{label}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
