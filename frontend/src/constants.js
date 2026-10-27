// Intervalo entre ticks da simulação (e entre leituras do estado). 500 ms deixa o movimento fluido.
export const TICK_MS = 500
// Mesmo limite que o backend usa para recalcular rotas.
export const CONGESTION_WARN = 1.5

export const VEHICLE_META = {
  carro: { label: 'Carro', emoji: '🚗', color: '#25c4dd' },
  van: { label: 'Van', emoji: '🚐', color: '#4a5fe0' },
  onibus: { label: 'Ônibus', emoji: '🚌', color: '#9645cf' },
  caminhao: { label: 'Caminhão', emoji: '🚚', color: '#e6e3ff' },
}

// Espelha DEFAULT_ALLOWED_KINDS do backend: o que cada modal pode transportar.
export const KIND_META = {
  passageiro: { label: 'Passageiro', emoji: '🧍', modals: ['carro', 'van', 'onibus'] },
  insumo: { label: 'Insumo', emoji: '📦', modals: ['caminhao', 'van'] },
}

export const PHASE_LABEL = {
  buscando: 'Indo até a origem',
  em_transporte: 'Em transporte',
  concluida: 'Concluída',
}

export const trafficColor = (factor) =>
  factor >= CONGESTION_WARN ? '#ff5c7a' : factor >= 1.2 ? '#f4b740' : '#25c4dd'

export function fmtDuration(seconds) {
  const t = Math.max(0, Math.round(seconds))
  const m = Math.floor(t / 60)
  return m ? `${m} min ${String(t % 60).padStart(2, '0')} s` : `${t} s`
}

export function fmtClock(seconds) {
  const t = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
