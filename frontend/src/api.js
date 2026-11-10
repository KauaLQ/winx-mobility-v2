import axios from 'axios'
import { TICK_MS } from './constants'
import { supabase } from './lib/supabase'

export const MANAGER_TOKEN_KEY = 'winx.manager_token'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 8000,
})

// Anexa o token: o do gestor (login por credenciais) ou o da sessão Google do Supabase.
http.interceptors.request.use(async (config) => {
  let token = localStorage.getItem(MANAGER_TOKEN_KEY)
  if (!token) {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token
  }
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Token vencido ou inválido: o AuthContext escuta e encerra a sessão.
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/manager/login')) {
      window.dispatchEvent(new Event('winx:unauthorized'))
    }
    return Promise.reject(err)
  },
)

const body = (request) => request.then((res) => res.data)

export const api = {
  // auth / perfil
  me: () => body(http.get('/users/me')),
  managerLogin: (email, password) => body(http.post('/auth/manager/login', { email, password })),
  registerDriver: () => body(http.post('/drivers/me')), // idempotente: cria o cadastro de motorista no 1º acesso

  // mapa e frota
  graph: () => body(http.get('/map/graph')),
  state: () => body(http.get('/simulation/state')),
  vehicles: () => body(http.get('/vehicles')),
  createVehicle: (payload) => body(http.post('/vehicles', payload)),
  deleteVehicle: (id) => body(http.delete(`/vehicles/${id}`)),
  claimVehicle: (id) => body(http.post(`/vehicles/${id}/claim`)),
  releaseVehicle: (id) => body(http.post(`/vehicles/${id}/release`)),

  // viagens
  dispatch: (payload) => body(http.post('/dispatch', payload)),
  acceptTrip: (tripId) => body(http.post(`/trips/${tripId}/accept`)),
  cancelTrip: (tripId) => body(http.post(`/trips/${tripId}/cancel`)),
  reviewTrip: (tripId, payload) => body(http.post(`/trips/${tripId}/review`, payload)),

  // simulação (speed = segundos simulados por segundo real: 1x, 5x, 10x)
  startSim: (speed) =>
    body(
      http.post('/simulation/start', null, {
        params: { interval_s: TICK_MS / 1000, dt_s: (speed * TICK_MS) / 1000 },
      }),
    ),
  stopSim: () => body(http.post('/simulation/stop')),
  resetSim: () => body(http.post('/simulation/reset')),
}

export function errorMessage(err) {
  if (!err.response) return 'Não foi possível falar com o servidor. Confira se a API está rodando.'
  const detail = err.response.data?.detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg.replace(/^Value error, /, '')).join('; ')
  return detail || `Erro ${err.response.status} ao processar o pedido.`
}