import { MdEco, MdLocalGasStation, MdTimer } from 'react-icons/md'
import {
  CONGESTION_WARN,
  ESG,
  KIND_META,
  PALETTE,
  VEHICLE_META,
  fmtDistance,
  fmtDuration,
  fmtLiters,
  fmtMass,
  fmtPercent,
} from '../constants'

function Kpi({ label, value }) {
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <p className="font-display text-base font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-mist">{label}</p>
    </li>
  )
}

function Bars({ title, rows, total }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {rows.map(([label, count, color]) => (
          <li key={label} className="text-sm">
            <div className="flex justify-between text-mist">
              <span>{label}</span>
              <b className="font-semibold text-ink">{count}</b>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-tint">
              <div className="h-full rounded-full" style={{ width: `${total ? (count / total) * 100 : 0}%`, backgroundColor: color }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function DashboardPanel({ vehicles, trips, edges }) {
  const done = trips.filter((t) => t.phase === 'concluida')
  const accepted = trips.filter((t) => t.vehicle_id != null) // só estas têm estimativa de espera até a origem
  const sum = (list, fn) => list.reduce((s, t) => s + fn(t), 0)
  const duration = (t) => t.completed_at_s - t.created_at_s

  // Estimativa de ESG sobre as viagens concluídas: consumo real da simulação x fração evitada (ESG.waste).
  const avoided = ESG.waste / (1 - ESG.waste)
  const liters = (t) => (t.distance_m / 1000) * ESG.fuel[t.request.modal].lPerKm
  const fuelSaved = sum(done, liters) * avoided
  const co2Saved = sum(done, (t) => liters(t) * ESG.fuel[t.request.modal].co2PerL) * avoided
  const timeSaved = sum(done, duration) * avoided

  const busy = vehicles.filter((v) => v.status === 'em_corrida').length
  const impact = [
    ['CO₂ evitado', fmtMass(co2Saved), MdEco],
    ['combustível poupado', fmtLiters(fuelSaved), MdLocalGasStation],
    ['tempo ganho', fmtDuration(timeSaved), MdTimer],
  ]
  const kpis = [
    ['solicitações', trips.length],
    ['taxa de conclusão', trips.length ? fmtPercent(done.length / trips.length) : '—'],
    ['tempo médio de viagem', done.length ? fmtDuration(sum(done, duration) / done.length) : '—'],
    ['espera média até a origem', accepted.length ? fmtDuration(sum(accepted, (t) => t.eta_pickup_s) / accepted.length) : '—'],
    ['distância percorrida', fmtDistance(sum(done, (t) => t.distance_m))],
    ['utilização da frota', vehicles.length ? fmtPercent(busy / vehicles.length) : '—'],
    ['recálculos de rota', sum(trips, (t) => t.reroutes)],
    ['vias congestionadas', edges.filter((e) => e.congestion_factor >= CONGESTION_WARN).length],
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="font-display text-sm font-bold text-ink">Indicadores</h2>
        <p className="mt-1.5 text-sm text-mist">
          {trips.length ? 'Resultados da operação desde o início da simulação.' : 'Os indicadores aparecem conforme as viagens são solicitadas e concluídas.'}
        </p>
      </div>

      <section className="rounded-xl border border-line border-l-4 border-l-wx-cyan bg-surface p-4">
        <h3 className="text-sm font-semibold text-ink">Impacto estimado (ESG)</h3>
        <ul className="mt-3 grid grid-cols-3 gap-3">
          {impact.map(([label, value, Icon]) => (
            <li key={label}>
              <Icon size={20} aria-hidden className="text-wx-cyan-deep" />
              <p className="mt-1 text-base font-bold text-ink">{value}</p>
              <p className="text-xs text-mist">{label}</p>
            </li>
          ))}
        </ul>
      </section>

      <ul className="grid grid-cols-2 gap-3">
        {kpis.map(([label, value]) => (
          <Kpi key={label} label={label} value={value} />
        ))}
      </ul>

      <Bars
        title="Viagens por tipo de pedido"
        total={trips.length}
        rows={Object.entries(KIND_META).map(([id, m]) => [m.label, trips.filter((t) => t.request.kind === id).length, PALETTE.cobalt])}
      />
      <Bars
        title="Viagens por veículo"
        total={trips.length}
        rows={Object.entries(VEHICLE_META).map(([id, m]) => [m.label, trips.filter((t) => t.request.modal === id).length, m.color])}
      />

      <p className="text-xs text-mist">
        Estimativas sobre as viagens concluídas, assumindo {fmtPercent(ESG.waste)} de desperdício evitado (km vazios e esperas) frente a uma operação sem
        otimização. Premissa a calibrar com a linha de base do piloto.
      </p>
    </div>
  )
}
