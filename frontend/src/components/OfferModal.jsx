import { KIND_META, fmtDistance, fmtDuration } from '../constants'

// Pedido de corrida para o motorista, no estilo "nova corrida" dos apps de transporte.
export default function OfferModal({ trip, vehicleId, nodesById, busy, onAccept, onDecline }) {
  const name = (id) => nodesById[id]?.name ?? `Nó ${id}`
  const kind = KIND_META[trip.request.kind]
  const stats = [
    ['até o embarque', fmtDuration(trip.offers[vehicleId])],
    ['duração da corrida', fmtDuration(trip.eta_total_s)],
    ['distância', fmtDistance(trip.distance_m)],
  ]

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="offer-title" className="absolute inset-0 z-30 flex items-end bg-ink/40">
      <div className="w-full rounded-t-2xl border-t border-line bg-surface p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tint text-primary">
            <kind.Icon size={24} aria-hidden />
          </span>
          <div>
            <h2 id="offer-title" className="font-display text-sm font-bold text-ink">
              Nova corrida
            </h2>
            <p className="mt-1 text-sm text-mist">{kind.label}</p>
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-2 text-sm text-ink">
          <li className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-wx-cyan-deep text-xs font-bold text-white">A</span>
            {name(trip.request.origin_node)}
          </li>
          <li className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-wx-violet-deep text-xs font-bold text-white">B</span>
            {name(trip.request.destination_node)}
          </li>
        </ul>

        <ul className="mt-4 grid grid-cols-3 gap-2">
          {stats.map(([label, value]) => (
            <li key={label} className="rounded-xl border border-line bg-page p-2.5">
              <p className="text-sm font-bold text-ink">{value}</p>
              <p className="mt-0.5 text-xs text-mist">{label}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className="rounded-xl border border-line bg-surface py-3 text-base font-semibold text-mist transition-colors hover:text-ink disabled:opacity-40"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            className="rounded-xl bg-primary py-3 text-base font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Aceitando…' : 'Aceitar'}
          </button>
        </div>
      </div>
    </div>
  )
}
