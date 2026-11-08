import { KIND_META, PHASE_LABEL, fmtClock, fmtDistance, fmtDuration } from '../constants'

// `trips` já chega filtrado para o perfil. A API devolve em ordem de criação; aqui a mais recente vem primeiro.
export default function HistoryPanel({ trips, nodesById, showVehicle }) {
  const name = (id) => nodesById[id]?.name ?? `Nó ${id}`
  const list = [...trips].reverse()
  const done = trips.filter((t) => t.phase === 'concluida').length

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="font-display text-sm font-bold text-ink">Histórico de viagens</h2>
        <p className="mt-1.5 text-sm text-mist">
          {trips.length} {trips.length === 1 ? 'viagem' : 'viagens'} · {done} {done === 1 ? 'concluída' : 'concluídas'}
        </p>
      </div>

      {list.length === 0 && <p className="text-sm text-mist">Nenhuma viagem por aqui ainda.</p>}

      <ul className="flex flex-col gap-3">
        {list.map((t) => {
          const kind = KIND_META[t.request.kind]
          const finished = t.phase === 'concluida'
          return (
            <li key={t.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <kind.Icon size={18} aria-hidden />
                  {kind.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    finished ? 'bg-wx-cyan/15 text-wx-cyan-deep' : 'bg-wx-violet/15 text-wx-violet-deep'
                  }`}
                >
                  {PHASE_LABEL[t.phase]}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink">
                {name(t.request.origin_node)} › {name(t.request.destination_node)}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-mist">
                <span>Pedida às {fmtClock(t.created_at_s)}</span>
                {showVehicle && <span>{t.vehicle_id}</span>}
                <span>{finished ? `Duração ${fmtDuration(t.completed_at_s - t.created_at_s)}` : `Previsão ${fmtDuration(t.eta_total_s)}`}</span>
                <span>{fmtDistance(t.distance_m)}</span>
                {t.reroutes > 0 && (
                  <span className="font-medium text-warn-deep">
                    {t.reroutes} {t.reroutes > 1 ? 'recálculos' : 'recálculo'} de rota
                  </span>
                )}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
