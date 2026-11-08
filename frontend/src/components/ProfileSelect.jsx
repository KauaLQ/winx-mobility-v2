import { MdChevronRight } from 'react-icons/md'
import { PROFILES } from '../constants'

export default function ProfileSelect({ onSelect }) {
  return (
    <div className="scroll-thin flex h-full flex-col overflow-y-auto">
      <header className="flex flex-col items-center bg-linear-to-b from-navy to-navy-deep px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))] text-white">
        <img src="/logo-mark.png" alt="" className="h-14 w-auto" />
        <p className="mt-3 font-display text-lg font-bold tracking-wide">WINX</p>
        <p className="mt-1 text-xs text-navy-soft">Mobility</p>
      </header>
      <div className="h-0.5 shrink-0 bg-wx-gradient" />

      <main className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <h1 className="font-display text-sm font-bold text-ink">Entrar como</h1>
          <p className="mt-1.5 text-sm text-mist">Escolha o seu perfil para abrir a visão correspondente.</p>
        </div>

        <ul className="flex flex-col gap-3">
          {Object.entries(PROFILES).map(([id, profile]) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-wx-cobalt/50"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-tint text-primary">
                  <profile.Icon size={26} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{profile.label}</span>
                  <span className="mt-0.5 block text-sm text-mist">{profile.description}</span>
                </span>
                <MdChevronRight size={22} aria-hidden className="shrink-0 text-mist" />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
