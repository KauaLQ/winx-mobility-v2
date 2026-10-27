import { useMemo, useState } from 'react'
import { MdKeyboardArrowDown, MdSwapVert } from 'react-icons/md'
import { api, errorMessage } from '../api'
import { KIND_META, VEHICLE_META, fmtDuration } from '../constants'

const field =
  'w-full appearance-none rounded-xl border border-line bg-surface px-3 py-3 pr-10 text-base text-ink transition-colors focus:border-primary'

export default function RequestPanel({ nodes, vehicles, draft, setDraft, onDispatched }) {
  const [kind, setKind] = useState('passageiro')
  const [modal, setModal] = useState('carro')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  // Quantos veículos livres existem por modal para este tipo de pedido.
  const freeByModal = useMemo(() => {
    const out = {}
    vehicles.forEach((v) => {
      if (v.status === 'disponivel' && v.allowed_kinds.includes(kind)) out[v.type] = (out[v.type] || 0) + 1
    })
    return out
  }, [vehicles, kind])

  const sameStop = draft.origin != null && draft.origin === draft.destination
  const ready = draft.origin != null && draft.destination != null && !sameStop

  const pickKind = (next) => {
    setKind(next)
    setModal(KIND_META[next].modals[0])
    setResult(null)
  }

  const setStop = (field) => (e) =>
    setDraft((d) => ({ ...d, [field]: e.target.value === '' ? null : Number(e.target.value) }))

  const swap = () => setDraft((d) => ({ origin: d.destination, destination: d.origin }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const trip = await api.dispatch({
        kind,
        modal,
        origin_node: draft.origin,
        destination_node: draft.destination,
      })
      setResult({ ok: true, trip })
      onDispatched(trip)
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err), status: err.response?.status })
    } finally {
      setLoading(false)
    }
  }

  const stopOptions = nodes.map((n) => (
    <option key={n.id} value={n.id}>
      {n.name}
    </option>
  ))

  const ResultIcon = result?.ok ? VEHICLE_META[result.trip.request.modal].Icon : null

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-4">
      <div>
        <h2 className="font-display text-sm font-bold text-ink">Solicitar transporte</h2>
        <p className="mt-1.5 text-sm text-mist">
          Escolha o que será levado, o veículo e o trajeto. Você também pode tocar nos pontos do mapa.
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">O que será transportado</legend>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(KIND_META).map(([id, meta]) => {
            const on = kind === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => pickKind(id)}
                className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-base font-semibold transition-colors ${
                  on ? 'border-primary bg-tint text-primary' : 'border-line bg-surface text-mist hover:text-ink'
                }`}
              >
                <meta.Icon size={20} aria-hidden />
                {meta.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Veículo</legend>
        <div className="flex gap-2">
          {KIND_META[kind].modals.map((id) => {
            const meta = VEHICLE_META[id]
            const free = freeByModal[id] || 0
            const on = modal === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setModal(id)}
                className={`flex flex-1 flex-col items-center rounded-xl border px-2 py-2.5 text-center transition-colors ${
                  on ? 'border-primary bg-tint' : 'border-line bg-surface hover:bg-tint/60'
                }`}
              >
                <meta.Icon size={26} style={{ color: meta.deep }} aria-hidden />
                <span className="mt-1 block text-sm font-semibold text-ink">{meta.label}</span>
                <span className={`block text-xs ${free ? 'text-mist' : 'text-alert-deep'}`}>
                  {free ? `${free} disponível${free > 1 ? 'is' : ''}` : 'nenhum disponível'}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <label className="block text-sm font-semibold text-ink">
          <span className="mb-2 flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-wx-cyan-deep text-xs font-bold text-white">A</span>
            Origem
          </span>
          <span className="relative block">
            <select className={field} value={draft.origin ?? ''} onChange={setStop('origin')}>
              <option value="">Escolha um ponto</option>
              {stopOptions}
            </select>
            <MdKeyboardArrowDown size={22} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mist" />
          </span>
        </label>

        <button
          type="button"
          onClick={swap}
          className="flex items-center gap-1 self-end rounded-lg px-2 py-1.5 text-sm text-mist transition-colors hover:text-ink"
        >
          <MdSwapVert size={18} aria-hidden />
          Inverter origem e destino
        </button>

        <label className="block text-sm font-semibold text-ink">
          <span className="mb-2 flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-wx-violet-deep text-xs font-bold text-white">B</span>
            Destino
          </span>
          <span className="relative block">
            <select className={field} value={draft.destination ?? ''} onChange={setStop('destination')}>
              <option value="">Escolha um ponto</option>
              {stopOptions}
            </select>
            <MdKeyboardArrowDown size={22} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mist" />
          </span>
        </label>

        {sameStop && (
          <p role="alert" className="text-sm text-warn-deep">
            Origem e destino precisam ser pontos diferentes.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!ready || loading}
        className="rounded-xl bg-primary py-3.5 text-base font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Procurando veículo…' : 'Solicitar transporte'}
      </button>

      {result?.ok && (
        <div role="status" className="flex gap-3 rounded-xl border border-line border-l-4 border-l-wx-cyan bg-surface p-3 text-sm">
          <ResultIcon size={24} style={{ color: VEHICLE_META[result.trip.request.modal].deep }} aria-hidden />
          <div>
            <p className="font-semibold text-ink">{result.trip.vehicle_id} está a caminho</p>
            <p className="mt-1 text-mist">
              Chega à origem em {fmtDuration(result.trip.eta_pickup_s)}. Viagem completa em {fmtDuration(result.trip.eta_total_s)}.
            </p>
          </div>
        </div>
      )}

      {result && !result.ok && (
        <div role="alert" className="rounded-xl border border-line border-l-4 border-l-alert bg-surface p-3 text-sm">
          <p className="font-semibold text-ink">Não foi possível despachar</p>
          <p className="mt-1 text-mist">{result.text}</p>
          {result.status === 409 && <p className="mt-1 text-mist">Tente outro tipo de veículo ou aguarde uma corrida terminar.</p>}
        </div>
      )}
    </form>
  )
}