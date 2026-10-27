import { useState } from 'react'
import { MdPause, MdPlayArrow, MdRestartAlt } from 'react-icons/md'
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
    <div className="flex items-center gap-1 rounded-xl border border-line bg-surface/95 p-1 shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={running ? 'Pausar simulação' : 'Iniciar simulação'}
        className={`flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition-colors disabled:opacity-60 ${
          running ? 'bg-tint text-ink hover:bg-line' : 'bg-primary text-white hover:bg-primary-hover'
        }`}
      >
        {running ? <MdPause size={20} aria-hidden /> : <MdPlayArrow size={20} aria-hidden />}
        <span className="hidden sm:inline">{running ? 'Pausar' : 'Iniciar'}</span>
      </button>

      <div role="group" aria-label="Velocidade da simulação" className="flex">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => changeSpeed(s)}
            className={`h-10 w-9 rounded-lg text-sm font-semibold transition-colors ${
              speed === s ? 'bg-tint text-primary' : 'text-mist hover:text-ink'
            }`}
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
        className="grid h-10 w-10 place-items-center rounded-lg text-mist transition-colors hover:text-ink disabled:opacity-60"
      >
        <MdRestartAlt size={22} aria-hidden />
      </button>
    </div>
  )
}