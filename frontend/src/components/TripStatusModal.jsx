import { VEHICLE_META, fmtDuration } from '../constants'

// Modal do usuário final: animação enquanto procura um veículo; ao ser aceita, informa quem aceitou.
export default function TripStatusModal({ trip, onCancel, onClose }) {
  const searching = trip.phase === 'aguardando'
  const meta = VEHICLE_META[trip.request.modal]

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="trip-status-title" className="absolute inset-0 z-30 grid place-items-center bg-ink/40 p-6">
      <div className="flex w-full flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center shadow-xl">
        <span className="relative grid h-24 w-24 place-items-center">
          {searching && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full" style={{ backgroundColor: `${meta.color}33` }} />
              <span className="absolute inset-3 animate-pulse rounded-full" style={{ backgroundColor: `${meta.color}26` }} />
            </>
          )}
          <span className="relative grid h-14 w-14 place-items-center rounded-full bg-surface shadow" style={{ color: meta.deep }}>
            <meta.Icon size={30} aria-hidden />
          </span>
        </span>

        {searching ? (
          <>
            <h2 id="trip-status-title" className="mt-4 font-display text-sm font-bold text-ink">
              Buscando {meta.label.toLowerCase()}…
            </h2>
            <p className="mt-2 text-sm text-mist">Estamos avisando os motoristas próximos.</p>
            <button
              type="button"
              onClick={onCancel}
              className="mt-5 w-full rounded-xl border border-line bg-surface py-3 text-base font-semibold text-mist transition-colors hover:text-ink"
            >
              Cancelar solicitação
            </button>
          </>
        ) : (
          <>
            <h2 id="trip-status-title" className="mt-4 font-display text-sm font-bold text-ink">
              {trip.vehicle_name} aceitou sua viagem
            </h2>
            <p className="mt-2 text-sm text-mist">Chega à origem em {fmtDuration(trip.eta_pickup_s)}. Acompanhe o veículo no mapa.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-primary py-3 text-base font-bold text-white transition-colors hover:bg-primary-hover"
            >
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  )
}