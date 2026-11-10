import { useState } from 'react'
import { api, errorMessage } from '../api'
import { VEHICLE_META } from '../constants'

const field =
  'w-full rounded-xl border border-line bg-surface px-3 py-3 text-base text-ink transition-colors focus:border-primary'
const PLATE_RE = /^[A-Za-z]{3}-?[0-9][A-Za-z0-9][0-9]{2}$/ // ABC-1234 ou ABC1D23 (o backend valida de novo)

// Cadastro de veículo (gestão). Renderizado pelo Workspace, por cima das abas.
export default function VehicleFormModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [plate, setPlate] = useState('')
  const [type, setType] = useState('carro')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const ready = name.trim().length >= 2 && PLATE_RE.test(plate.trim())

  const submit = async (e) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      await api.createVehicle({ name: name.trim(), plate: plate.trim(), type })
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
      setSending(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title" className="absolute inset-0 z-40 flex overflow-y-auto bg-ink/40 p-6">
      <form onSubmit={submit} className="m-auto flex w-full flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <h2 id="vehicle-form-title" className="font-display text-sm font-bold text-ink">
          Novo veículo
        </h2>

        <label className="block text-sm font-semibold text-ink">
          Nome / modelo
          <input className={`${field} mt-2 font-normal`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Van Sprinter" required />
        </label>

        <label className="block text-sm font-semibold text-ink">
          Placa
          <input
            className={`${field} mt-2 font-normal uppercase`}
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            maxLength={8}
            placeholder="ABC1D23"
            autoCapitalize="characters"
            required
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Tipo</legend>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(VEHICLE_META).map(([id, meta]) => (
              <button
                key={id}
                type="button"
                aria-pressed={type === id}
                onClick={() => setType(id)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                  type === id ? 'border-primary bg-tint text-ink' : 'border-line bg-surface text-mist hover:text-ink'
                }`}
              >
                <meta.Icon size={22} style={{ color: meta.deep }} aria-hidden />
                {meta.label}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-alert-deep">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-xl border border-line bg-surface py-3 text-base font-semibold text-mist transition-colors hover:text-ink disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!ready || sending}
            className="rounded-xl bg-primary py-3 text-base font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? 'Salvando…' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  )
}