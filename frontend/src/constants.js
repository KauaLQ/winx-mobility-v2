import { MdAirportShuttle, MdDirectionsBus, MdDirectionsCar, MdInventory2, MdLocalShipping, MdPerson } from 'react-icons/md'

// Intervalo entre ticks da simulação (e entre leituras do estado). 500 ms deixa o movimento fluido.
export const TICK_MS = 500
// Mesmo limite que o backend usa para recalcular rotas.
export const CONGESTION_WARN = 1.5

// Mesmas cores do @theme em index.css, para uso em SVG e estilos inline.
export const PALETTE = {
  page: '#f3f5fb',
  surface: '#ffffff',
  tint: '#edf0f9',
  line: '#e1e6f1',
  casing: '#dde3f3', // faixa larga das vias
  ink: '#1f2a44',
  mist: '#66718d',
  cyan: '#3fb4cc',
  cyanDeep: '#1d8199',
  cobalt: '#6c82e6',
  violet: '#a77be0',
  violetDeep: '#7a4fc2',
  warn: '#e3ad4a',
  alert: '#e27c93',
  node: '#9aa5c8', // nó sem seleção
}

// color = traço/rota no mapa; deep = versão mais escura para ícones e textos sobre fundo claro.
export const VEHICLE_META = {
  carro: { label: 'Carro', Icon: MdDirectionsCar, color: '#3fb4cc', deep: '#1d8199' },
  van: { label: 'Van', Icon: MdAirportShuttle, color: '#6c82e6', deep: '#4059c2' },
  onibus: { label: 'Ônibus', Icon: MdDirectionsBus, color: '#a77be0', deep: '#7a4fc2' },
  caminhao: { label: 'Caminhão', Icon: MdLocalShipping, color: '#7b88a8', deep: '#4f5b7a' },
}

// Espelha DEFAULT_ALLOWED_KINDS do backend: o que cada modal pode transportar.
export const KIND_META = {
  passageiro: { label: 'Passageiro', Icon: MdPerson, modals: ['carro', 'van', 'onibus'] },
  insumo: { label: 'Insumo', Icon: MdInventory2, modals: ['caminhao', 'van'] },
}

export const PHASE_LABEL = {
  buscando: 'Indo até a origem',
  em_transporte: 'Em transporte',
  concluida: 'Concluída',
}

export const trafficColor = (factor) =>
  factor >= CONGESTION_WARN ? PALETTE.alert : factor >= 1.2 ? PALETTE.warn : PALETTE.cyan

export function fmtDuration(seconds) {
  const t = Math.max(0, Math.round(seconds))
  const m = Math.floor(t / 60)
  return m ? `${m} min ${String(t % 60).padStart(2, '0')} s` : `${t} s`
}

export function fmtClock(seconds) {
  const t = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}