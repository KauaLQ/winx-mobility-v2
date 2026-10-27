import { useState } from 'react'
import { api } from '../api'

const SPEEDS = [1, 5, 10]

export default function SimControls({ running, speed, setSpeed, onChanged, onReset }) {
  const [busy, setBusy] = useState(false)

  const act = async (fn) => {
    setBusy(true)
    try {
      await fn()
    } catch {
      /* a falha de conexão já aparece no cabeçalho */
    } finally {
      setBusy(false)
      onChanged()
    }
  }

  const toggle = () => act(() => (running ? api.stopSim() : api.startSim(speed)))

  const changeSpeed = (next) => {
    setSpeed(next)
    if (running) act(async () => { await api.stopSim(); await api.startSim(next) })
  }

  const reset = () => act(async () => { await api.resetSim(); onReset() })

  return (
    <div className="flex items-center gap-1 rounded-xl border border-rail bg-deck/90 p-1 backdrop-blur">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={running ? 'Pausar simulação' : 'Iniciar simulação'}
        className={`flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold disabled:opacity-60 ${
          running ? 'bg-rail text-white' : 'bg-wx-cyan text-abyss'
        }`}
      >
        <span aria-hidden>{running ? '❚❚' : '▶'}</span>
        <span className="hidden sm:inline">{running ? 'Pausar' : 'Iniciar'}</span>
      </button>

      <div role="group" aria-label="Velocidade da simulação" className="flex">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => changeSpeed(s)}
            className={`h-10 w-9 rounded-lg text-sm font-semibold ${speed === s ? 'bg-rail text-wx-cyan' : 'text-mist hover:text-white'}`}
          >
            {s}×
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={reset}
        disabled={busy}
        aria-label="Reiniciar simulação"
        title="Reiniciar simulação"
        className="h-10 w-10 rounded-lg text-lg text-mist hover:text-white disabled:opacity-60"
      >
        ↺
      </button>
    </div>
  )
}
