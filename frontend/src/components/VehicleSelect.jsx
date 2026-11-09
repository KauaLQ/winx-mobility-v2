import { useCallback, useEffect, useState } from 'react'
import { MdArrowBack } from 'react-icons/md'
import { api, errorMessage } from '../api'
import { KIND_META, VEHICLE_META } from '../constants'

// "Login" do motorista: escolhe o veículo da frota. No futuro, a leitura do QR Code do veículo substitui esta lista.
export default function VehicleSelect({ onSelect, onBack }) {
  const [vehicles, setVehicles] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setVehicles(await api.vehicles())
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const list = [...(vehicles ?? [])].sort((a, b) => a.id.localeCompare(b.id))

  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-center gap-3 bg-linear-to-b from-navy to-navy-deep px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          title="Voltar"
          className="grid h-9 w-9 place-items-center rounded-lg text-navy-soft transition-colors hover:text-white"
        >
          <MdArrowBack size={22} aria-hidden />
        </button>
        <div className="leading-none">
          <p className="font-display text-base font-bold tracking-wide">WINX</p>
          <p className="mt-1 text-xs text-navy-soft">Mobility · Motorista</p>
        </div>
      </header>
      <div className="h-0.5 shrink-0 bg-wx-gradient" />

      <main className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <h1 className="font-display text-sm font-bold text-ink">Escolha o seu veículo</h1>
          <p className="mt-1.5 text-sm text-mist">Você receberá as corridas destinadas a ele. Em breve, a entrada será pelo QR Code do veículo.</p>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-line border-l-4 border-l-alert bg-surface p-3 text-sm">
            <p className="text-mist">{error}</p>
            <button type="button" onClick={load} className="mt-2 font-semibold text-primary hover:text-primary-hover">
              Tentar novamente
            </button>
          </div>
        )}
        {!error && !vehicles && <p className="text-sm text-mist">Carregando veículos…</p>}

        <ul className="flex flex-col gap-3">
          {list.map((v) => {
            const meta = VEHICLE_META[v.type]
            const busy = v.status === 'em_corrida'
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onSelect(v.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-wx-cobalt/50"
                >
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                    style={{ backgroundColor: `${meta.color}26`, color: meta.deep }}
                  >
                    <meta.Icon size={24} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{v.id}</span>
                    <span className="block text-sm text-mist">
                      {meta.label} para {v.allowed_kinds.map((k) => KIND_META[k].label.toLowerCase()).join(' e ')}
                    </span>
                  </span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      busy ? 'bg-wx-violet/15 text-wx-violet-deep' : 'bg-wx-cyan/15 text-wx-cyan-deep'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {busy ? 'Em corrida' : 'Disponível'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}