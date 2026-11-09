import { MdChevronRight } from 'react-icons/md'
import { PROFILES } from '../constants'

export default function ProfileSelect({ onSelect }) {
  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="relative shrink-0 overflow-hidden rounded-b-3xl bg-linear-to-br from-navy-deep via-navy to-primary px-4 pb-10 pt-[max(2rem,env(safe-area-inset-top))] text-white shadow-lg shadow-navy-deep/20">
        {/* brilhos suaves nas cores da logo */}
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-wx-violet/30 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-wx-cyan/25 blur-3xl" />
        <div className="relative flex flex-col items-center">
          <img src="/logo-mark.png" alt="" className="h-14 w-auto" />
          <p className="mt-3 font-display text-lg font-bold tracking-wide">WINX</p>
          <p className="mt-1 text-xs text-navy-soft">Mobility</p>
        </div>
      </header>

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

      <footer className="shrink-0 bg-navy-deep">
        <div className="h-0.5 bg-wx-gradient" />
        <div className="flex flex-col items-center gap-1 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center">
          <p className="mt-1 font-display text-xs font-bold tracking-wide text-white">WINX Mobility</p>
          <p className="text-xs text-navy-soft">© 2026</p>
        </div>
      </footer>
    </div>
  )
}