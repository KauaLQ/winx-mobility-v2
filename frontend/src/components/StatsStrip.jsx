import { CONGESTION_WARN } from '../constants'

export default function StatsStrip({ vehicles, trips, edges }) {
  const free = vehicles.filter((v) => v.status === 'disponivel').length
  const jammed = edges.filter((e) => e.congestion_factor >= CONGESTION_WARN).length

  const items = [
    { label: 'disponíveis', value: free, color: '#25c4dd' },
    { label: 'em corrida', value: vehicles.length - free, color: '#9645cf' },
    { label: 'viagens concluídas', value: trips.filter((t) => t.phase === 'concluida').length, color: '#4a5fe0' },
    { label: 'vias congestionadas', value: jammed, color: jammed ? '#ff5c7a' : '#aeaae0' },
  ]

  return (
    <ul className="no-scrollbar flex gap-6 overflow-x-auto border-b border-rail px-4 py-2 text-sm">
      {items.map((item) => (
        <li key={item.label} className="flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <b className="font-display text-base font-bold">{item.value}</b>
          <span className="text-mist">{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
