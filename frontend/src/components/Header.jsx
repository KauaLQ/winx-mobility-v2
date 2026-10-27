import { fmtClock } from '../constants'

export default function Header({ online, clock }) {
  return (
    <>
      <header className="flex items-center justify-between bg-deck px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <img src="/logo-mark.png" alt="" className="h-9 w-auto" />
          <div className="leading-none">
            <p className="font-display text-base font-bold tracking-wide">WINX</p>
            <p className="mt-1 text-xs text-mist">Mobility</p>
          </div>
          <p className="ml-3 hidden border-l border-rail pl-3 text-sm text-mist md:block">Central de operações da planta</p>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <p className="text-mist">
            <span className="hidden sm:inline">Tempo simulado </span>
            <b className="font-semibold text-white">{fmtClock(clock)}</b>
          </p>
          <p className="flex items-center gap-2" role="status">
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-wx-cyan' : 'bg-alert'}`} />
            <span className={online ? 'text-white' : 'text-alert'}>{online ? 'Conectado' : 'Sem conexão'}</span>
          </p>
        </div>
      </header>
      <div className="h-0.5 shrink-0 bg-wx-gradient" />
    </>
  )
}
