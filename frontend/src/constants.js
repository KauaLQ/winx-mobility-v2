import {
  MdAddLocationAlt,
  MdAirportShuttle,
  MdDirectionsBus,
  MdDirectionsCar,
  MdDriveEta,
  MdHistory,
  MdInsights,
  MdInventory2,
  MdLocalShipping,
  MdMap,
  MdPerson,
  MdSpaceDashboard,
  MdSpeed,
} from 'react-icons/md'

// Intervalo entre ticks da simulação (e entre leituras do estado). 500 ms deixa o movimento fluido.
export const TICK_MS = 500
// Mesmo limite que o backend usa para recalcular rotas.
export const CONGESTION_WARN = 1.5

// Mesmas cores do @theme em index.css, para uso em SVG e estilos inline.
// As que mudam com o perfil (page, line, casing, ink, mist) apontam para as variáveis CSS.
export const PALETTE = {
  page: 'var(--color-page)',
  surface: '#ffffff',
  tint: '#edf0f9',
  line: 'var(--color-line)',
  casing: 'var(--map-casing)', // faixa larga das vias
  ink: 'var(--color-ink)',
  mist: 'var(--color-mist)',
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
  aguardando: 'Aguardando motorista',
  buscando: 'Indo até a origem',
  em_transporte: 'Em transporte',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

// ---------- Perfis de acesso ----------
// Sem login por enquanto: o perfil é escolhido na tela inicial e, para o motorista, o veículo na tela
// seguinte. Quando houver autenticação, USER_ID e o veículo do motorista passam a vir da sessão.
export const USER_ID = 'usuario-1'

// tabs = [rótulo, ícone] da 1ª, 2ª e 3ª aba, nessa ordem.
// map = o que o mapa mostra e permite para o perfil (os veículos exibidos são definidos no Workspace).
// ownsTrip(trip, who) = quais viagens aparecem no histórico; who = veículo do motorista ou USER_ID.
export const PROFILES = {
  usuario: {
    label: 'Usuário final',
    description: 'Solicite transporte de pessoas ou insumos e acompanhe suas viagens.',
    Icon: MdPerson,
    tabs: [
      ['Solicitar', MdAddLocationAlt],
      ['Mapa', MdMap],
      ['Histórico', MdHistory],
    ],
    map: { restrictions: false, simControls: false },
    ownsTrip: (trip, who) => trip.request.requested_by === who,
  },
  motorista: {
    label: 'Motorista',
    description: 'Escolha o veículo, receba corridas e siga o trajeto no mapa.',
    Icon: MdDriveEta,
    tabs: [
      ['Turno', MdSpeed],
      ['Mapa', MdMap],
      ['Histórico', MdHistory],
    ],
    map: { restrictions: true, simControls: false },
    ownsTrip: (trip, who) => trip.vehicle_id === who,
  },
  gestor: {
    label: 'Gestão',
    description: 'Acompanhe indicadores, a frota e as viagens de toda a planta.',
    Icon: MdSpaceDashboard,
    tabs: [
      ['Painel', MdInsights],
      ['Mapa', MdMap],
      ['Frota', MdDirectionsBus],
    ],
    map: { restrictions: true, simControls: true },
    ownsTrip: () => true,
  },
}

// ---------- Premissas das estimativas de ESG (painel da gestão) ----------
// São estimativas, não medições: waste e o consumo devem ser calibrados com a linha de base do piloto.
export const ESG = {
  // Fração da operação sem otimização (km vazios, esperas) que o despacho e o recálculo de rotas evitam.
  waste: 0.15,
  // Consumo (L/km) e emissão (kg de CO₂ por litro) de cada modal.
  fuel: {
    carro: { lPerKm: 0.1, co2PerL: 2.3 },
    van: { lPerKm: 0.13, co2PerL: 2.7 },
    onibus: { lPerKm: 0.35, co2PerL: 2.7 },
    caminhao: { lPerKm: 0.4, co2PerL: 2.7 },
  },
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

const num = (value, digits) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits })

export const fmtDistance = (m) => (m >= 1000 ? `${num(m / 1000, 2)} km` : `${Math.round(m)} m`)
export const fmtLiters = (l) => `${num(l, 2)} L`
export const fmtMass = (kg) => (kg >= 1 ? `${num(kg, 2)} kg` : `${Math.round(kg * 1000)} g`)
export const fmtPercent = (ratio) => `${Math.round(ratio * 100)}%`