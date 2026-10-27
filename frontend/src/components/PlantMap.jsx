import { useEffect, useMemo, useRef, useState } from 'react'
import { TICK_MS, VEHICLE_META, trafficColor } from '../constants'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// ---------- Zoom e pan: o viewBox do SVG é o "plano" da planta (unidades = coordenadas do backend) ----------

// Unidades da planta por pixel (preserveAspectRatio "meet" usa o maior dos dois eixos).
const scaleOf = (view, rect) => Math.max(view.w / rect.width, view.h / rect.height)

function zoomView(cur, factor, px, py, rect, home) {
  const s = scaleOf(cur, rect)
  const ox = (rect.width - cur.w / s) / 2
  const oy = (rect.height - cur.h / s) / 2
  const ux = cur.x + (px - rect.left - ox) * s // ponto da planta sob o cursor/dedos
  const uy = cur.y + (py - rect.top - oy) * s
  const w = clamp(cur.w * factor, home.w * 0.15, home.w * 2.5)
  const k = w / cur.w
  return { x: ux - (ux - cur.x) * k, y: uy - (uy - cur.y) * k, w, h: cur.h * k }
}

function panView(cur, dx, dy, rect) {
  const s = scaleOf(cur, rect)
  return { ...cur, x: cur.x - dx * s, y: cur.y - dy * s }
}

function useViewBox(home) {
  const svgRef = useRef(null)
  const pointers = useRef(new Map())
  const travel = useRef(0)
  const moved = useRef(false) // true se o gesto foi arrasto/pinça (suprime o clique em nós e veículos)
  const [vb, setVb] = useState(null) // null = enquadramento inicial
  const homeKey = home ? `${home.x}|${home.y}|${home.w}|${home.h}` : ''
  const view = vb ?? home

  useEffect(() => {
    setVb(null)
  }, [homeKey])

  // Roda do mouse: precisa de listener não passivo para impedir o scroll da página.
  useEffect(() => {
    const el = svgRef.current
    if (!el || !home) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15
      setVb((cur) => zoomView(cur ?? home, factor, e.clientX, e.clientY, el.getBoundingClientRect(), home))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeKey])

  const onPointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    travel.current = 0
    moved.current = false
  }

  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev || !home) return
    const rect = svgRef.current.getBoundingClientRect()
    const cur = { x: e.clientX, y: e.clientY }

    if (pointers.current.size === 1) {
      travel.current += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y)
      if (travel.current > 6) moved.current = true
      if (moved.current) setVb((v) => panView(v ?? home, cur.x - prev.x, cur.y - prev.y, rect))
    } else if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)[1]
      const before = Math.hypot(prev.x - other.x, prev.y - other.y)
      const after = Math.hypot(cur.x - other.x, cur.y - other.y)
      moved.current = true
      if (after > 0) {
        setVb((v) => zoomView(v ?? home, before / after, (cur.x + other.x) / 2, (cur.y + other.y) / 2, rect, home))
      }
    }
    pointers.current.set(e.pointerId, cur)
  }

  const onPointerEnd = (e) => pointers.current.delete(e.pointerId)

  const zoomBy = (factor) => {
    const el = svgRef.current
    if (!el || !home) return
    const r = el.getBoundingClientRect()
    setVb((v) => zoomView(v ?? home, factor, r.left + r.width / 2, r.top + r.height / 2, r, home))
  }

  return {
    svgRef,
    view,
    moved,
    zoomBy,
    reset: () => setVb(null),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onPointerLeave: onPointerEnd,
    },
  }
}

// ---------- Mapa ----------

export default function PlantMap({ graph, vehicles, draft, selectedId, onSelectVehicle, onPickNode }) {
  const [showRestrictions, setShowRestrictions] = useState(true)

  const nodes = useMemo(() => graph?.nodes ?? [], [graph])
  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])

  const home = useMemo(() => {
    if (!nodes.length) return null
    const xs = nodes.map((n) => n.x)
    const ys = nodes.map((n) => n.y)
    const x = Math.min(...xs) - 90
    const y = Math.min(...ys) - 80
    return { x, y, w: Math.max(...xs) + 90 - x, h: Math.max(...ys) + 100 - y }
  }, [nodes])

  const { svgRef, view, moved, zoomBy, reset, handlers } = useViewBox(home)

  // Ruas de mão dupla chegam como duas arestas direcionadas: desenha uma só, com o pior congestionamento.
  const streets = useMemo(() => {
    const byPair = new Map()
    for (const e of graph?.edges ?? []) {
      const key = e.source < e.target ? `${e.source}-${e.target}` : `${e.target}-${e.source}`
      const known = byPair.get(key)
      if (!known) byPair.set(key, { ...e, factor: e.congestion_factor })
      else known.factor = Math.max(known.factor, e.congestion_factor)
    }
    return [...byPair.values()]
  }, [graph])

  // Veículos parados ficam em arco acima do nó, para não esconder o ponto nem se sobrepor.
  const placed = useMemo(() => {
    const parked = {}
    vehicles.forEach((v) => {
      if (v.status === 'disponivel') (parked[v.current_node] = parked[v.current_node] || []).push(v)
    })
    return vehicles.map((v) => {
      if (v.status !== 'disponivel') return { v, x: v.x, y: v.y }
      const group = parked[v.current_node]
      const deg = group.length === 1 ? -90 : -150 + (120 / (group.length - 1)) * group.indexOf(v)
      const rad = (deg * Math.PI) / 180
      return { v, x: v.x + 30 * Math.cos(rad), y: v.y + 30 * Math.sin(rad) }
    })
  }, [vehicles])

  if (!home) {
    return <div className="absolute inset-0 grid place-items-center text-sm text-mist">Conectando à planta…</div>
  }

  const activeRoutes = vehicles.filter((v) => v.status === 'em_corrida' && v.route.length >= 2)
  const selected = vehicles.find((v) => v.id === selectedId)
  const target =
    selected && selected.status === 'em_corrida' ? nodesById[selected.route[selected.route.length - 1]] : null

  const onKey = (action) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  return (
    <div className="absolute inset-0 bg-abyss">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="h-full w-full touch-none select-none"
        role="group"
        aria-label="Mapa sintético da planta"
        {...handlers}
      >
        <defs>
          <pattern id="plant-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" fill="none" stroke="#2b2765" strokeOpacity="0.45" />
          </pattern>
        </defs>
        <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#plant-grid)" />

        {/* Vias */}
        {streets.map((s) => {
          const a = nodesById[s.source]
          const b = nodesById[s.target]
          if (!a || !b) return null
          const color = trafficColor(s.factor)
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
          const forbidden = s.forbidden_vehicles.map((f) => VEHICLE_META[f]?.label ?? f).join(', ')
          const tags = [
            s.max_height_m != null && `↕ ${s.max_height_m} m`,
            s.max_weight_t != null && `≤ ${s.max_weight_t} t`,
            forbidden && `sem ${forbidden}`,
          ].filter(Boolean)
          return (
            <g key={`${s.source}-${s.target}`} className="pointer-events-none">
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2b2765" strokeWidth="18" strokeLinecap="round" />
              {s.factor >= 1.2 && (
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeOpacity="0.3" strokeWidth="18" strokeLinecap="round" />
              )}
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={s.oneway ? '9 7' : undefined}
              />
              {s.oneway && <path d="M-6 -6 L7 0 L-6 6 Z" fill="#fff" transform={`translate(${mx} ${my}) rotate(${angle})`} />}
              {showRestrictions && tags.length > 0 && (
                <text
                  x={mx}
                  y={my - 16}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#aeaae0"
                  stroke="#0d0b2e"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {tags.join('   ')}
                </text>
              )}
            </g>
          )
        })}

        {/* Rotas dos veículos em corrida (a do selecionado se destaca) */}
        {activeRoutes.map((v) => {
          const pts = [`${v.x},${v.y}`, ...v.route.slice(1).filter((id) => nodesById[id]).map((id) => `${nodesById[id].x},${nodesById[id].y}`)]
          const isSel = v.id === selectedId
          return (
            <polyline
              key={v.id}
              points={pts.join(' ')}
              fill="none"
              stroke={VEHICLE_META[v.type].color}
              strokeWidth={isSel ? 4 : 2}
              strokeOpacity={isSel ? 0.95 : 0.4}
              strokeLinecap="round"
              strokeDasharray="3 8"
              className="route-flow pointer-events-none"
            />
          )
        })}
        {target && (
          <circle cx={target.x} cy={target.y} r="17" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 4" className="pointer-events-none" />
        )}

        {/* Nós: clique para escolher origem (A) e destino (B) */}
        {nodes.map((n) => {
          const isA = draft.origin === n.id
          const isB = draft.destination === n.id
          const color = isA ? '#25c4dd' : isB ? '#9645cf' : '#7d79c9'
          const pick = () => !moved.current && onPickNode(n.id)
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-label={`Escolher ${n.name}`}
              className="cursor-pointer"
              onClick={pick}
              onKeyDown={onKey(() => onPickNode(n.id))}
            >
              <circle cx={n.x} cy={n.y} r="24" fill="transparent" />
              {(isA || isB) && <circle cx={n.x} cy={n.y} r="19" fill={color} opacity="0.25" className="animate-pulse" />}
              <circle cx={n.x} cy={n.y} r="10" fill="#151247" stroke={color} strokeWidth="3" />
              {(isA || isB) && (
                <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill={color}>
                  {isA ? 'A' : 'B'}
                </text>
              )}
              <text
                x={n.x}
                y={n.y + 32}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="#fff"
                stroke="#0d0b2e"
                strokeWidth="4"
                paintOrder="stroke"
                className="pointer-events-none"
              >
                {n.name}
              </text>
            </g>
          )
        })}

        {/* Veículos: o CSS transition entre leituras do backend deixa o movimento contínuo */}
        {placed.map(({ v, x, y }) => {
          const meta = VEHICLE_META[v.type]
          const isSel = v.id === selectedId
          const active = v.status === 'em_corrida'
          const select = () => onSelectVehicle(isSel ? null : v.id)
          return (
            <g
              key={v.id}
              role="button"
              tabIndex={0}
              aria-label={`Veículo ${v.id}`}
              className="cursor-pointer"
              style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform ${TICK_MS}ms linear` }}
              onClick={() => !moved.current && select()}
              onKeyDown={onKey(select)}
            >
              {active && (
                <circle r="17" fill={meta.color} opacity="0.3" className="animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
              )}
              <circle r="13" fill="#151247" stroke={meta.color} strokeWidth={isSel ? 4 : 2.5} />
              {isSel && <circle r="19" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="3 3" />}
              <text textAnchor="middle" dominantBaseline="central" fontSize="14" className="pointer-events-none">
                {meta.emoji}
              </text>
              {isSel && (
                <text y="-24" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" stroke="#0d0b2e" strokeWidth="4" paintOrder="stroke">
                  {v.id}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Controles sobre o mapa */}
      <button
        type="button"
        aria-pressed={showRestrictions}
        onClick={() => setShowRestrictions((s) => !s)}
        className={`absolute right-3 top-3 h-12 rounded-xl border px-3 text-sm font-semibold backdrop-blur ${
          showRestrictions ? 'border-wx-cyan bg-deck/90 text-wx-cyan' : 'border-rail bg-deck/90 text-mist'
        }`}
      >
        Restrições
      </button>

      <ul className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg bg-deck/90 px-3 py-2 text-xs text-mist backdrop-blur">
        {[
          ['Via livre', '#25c4dd'],
          ['Via cheia', '#f4b740'],
          ['Congestionada', '#ff5c7a'],
        ].map(([label, c]) => (
          <li key={label} className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded" style={{ backgroundColor: c }} />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="w-4 text-center text-white">▸</span>
          Mão única
        </li>
      </ul>

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-rail bg-deck/90 backdrop-blur">
        {[
          ['Aproximar', '+', () => zoomBy(1 / 1.4)],
          ['Afastar', '−', () => zoomBy(1.4)],
          ['Enquadrar a planta', '⌖', reset],
        ].map(([label, glyph, action]) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            onClick={action}
            className="h-11 w-11 text-lg text-mist hover:text-white [&:not(:last-child)]:border-b [&:not(:last-child)]:border-rail"
          >
            {glyph}
          </button>
        ))}
      </div>
    </div>
  )
}
