import { CONGESTION_WARN, PALETTE } from '../constants'

export default function StatsStrip({ vehicles, trips, edges }) {
  const free = vehicles.filter((v) => v.status === 'disponivel').length
  const jammed = edges.filter((e) => e.congestion_factor >= CONGESTION_WARN).length

  const items = [
    { label: 'disponíveis', value: free, color: PALETTE.cyan },
    { label: 'em corrida', value: vehicles.length - free, color: PALETTE.violet },
    { label: 'viagens concluídas', value: trips.filter((t) => t.phase === 'concluida').length, color: PALETTE.cobalt },
    { label: 'vias congestionadas', value: jammed, color: jammed ? PALETTE.alert : PALETTE.node },
  ]

  return (
    <ul className="no-scrollbar flex gap-6 overflow-x-auto border-b border-line bg-surface px-4 py-2 text-sm">
      {items.map((item) => (
        <li key={item.label} className="flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <b className="font-display text-base font-bold text-ink">{item.value}</b>
          <span className="text-mist">{item.label}</span>
        </li>
      ))}
    </ul>
  )
}