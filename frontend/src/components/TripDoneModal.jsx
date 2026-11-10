import { useState } from 'react'
import { MdCheckCircle, MdStar, MdStarBorder } from 'react-icons/md'
import { api, errorMessage } from '../api'
import { KIND_META, fmtDistance, fmtDuration } from '../constants'

const SPARK_COLORS = ['text-warn', 'text-wx-cyan', 'text-wx-violet', 'text-wx-cobalt']
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * 2 * Math.PI
  const reach = i % 2 ? 58 : 80
  return { dx: Math.round(Math.cos(angle) * reach), dy: Math.round(Math.sin(angle) * reach), color: SPARK_COLORS[i % 4], delay: (i % 3) * 120 }
})

const comment = 'w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink transition-colors focus:border-primary'

// Viagem concluída: resumo para o motorista; resumo e avaliação opcional para o usuário final.
export default function TripDoneModal({ trip, nodesById, role, onClose }) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const name = (id) => nodesById[id]?.name ?? `Nó ${id}`
  const rateable = role === 'usuario'

  const rows = [
    ['Tipo', KIND_META[trip.request.kind].label],
    ['Trajeto', `${name(trip.request.origin_node)} › ${name(trip.request.destination_node)}`],
    ['Duração', fmtDuration(trip.completed_at_s - trip.created_at_s)],
    ['Distância', fmtDistance(trip.distance_m)],
  ]
  if (rateable) rows.push(['Veículo', trip.vehicle_name])
  if (trip.reroutes > 0) rows.push(['Recálculos de rota', trip.reroutes])

  const send = async () => {
    setSending(true)
    setError(null)
    try {
      await api.reviewTrip(trip.id, { rating, comment: text.trim() || null })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSending(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="done-title" className="absolute inset-0 z-40 flex overflow-y-auto bg-ink/40 p-6">
      <div className="m-auto flex w-full flex-col items-center rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-wx-cyan/15 text-wx-cyan-deep">
          {SPARKS.map((s, i) => (
            <MdStar
              key={i}
              size={16}
              aria-hidden
              className={`burst absolute left-1/2 top-1/2 -ml-2 -mt-2 ${s.color}`}
              style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, animationDelay: `${s.delay}ms` }}
            />
          ))}
          <MdCheckCircle size={44} aria-hidden />
        </span>

        <h2 id="done-title" className="mt-4 font-display text-sm font-bold text-ink">
          Viagem concluída
        </h2>
        <p className="mt-1.5 text-center text-sm text-mist">{rateable ? 'Como foi a viagem? Avaliar é opcional.' : 'Boa corrida! Veja o resumo.'}</p>

        <dl className="mt-4 w-full rounded-xl border border-line bg-page p-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 py-1">
              <dt className="text-mist">{label}</dt>
              <dd className="text-right font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        {rateable ? (
          <>
            <div role="group" aria-label="Nota da viagem" className="mt-4 flex gap-1 text-warn">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} ${n > 1 ? 'estrelas' : 'estrela'}`}
                  aria-pressed={rating >= n}
                  onClick={() => setRating(rating === n ? 0 : n)}
                  className="p-1"
                >
                  {rating >= n ? <MdStar size={32} aria-hidden /> : <MdStarBorder size={32} aria-hidden />}
                </button>
              ))}
            </div>
            <textarea
              aria-label="Comentário sobre a viagem (opcional)"
              placeholder="Comentário (opcional)"
              rows={3}
              maxLength={280}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={`${comment} mt-3`}
            />
            {error && (
              <p role="alert" className="mt-2 w-full text-sm text-alert-deep">
                {error}
              </p>
            )}
            <div className="mt-4 grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="rounded-xl border border-line bg-surface py-3 text-base font-semibold text-mist transition-colors hover:text-ink disabled:opacity-40"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={send}
                disabled={!rating || sending}
                className="rounded-xl bg-primary py-3 text-base font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-xl bg-primary py-3 text-base font-bold text-white transition-colors hover:bg-primary-hover"
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  )
}