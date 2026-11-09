import axios from 'axios'
import { TICK_MS } from './constants'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 8000,
})

const body = (request) => request.then((res) => res.data)

export const api = {
  graph: () => body(http.get('/map/graph')),
  state: () => body(http.get('/simulation/state')),
  vehicles: () => body(http.get('/vehicles')),
  dispatch: (payload) => body(http.post('/dispatch', payload)),
  acceptTrip: (tripId, vehicleId) =>
    body(http.post(`/trips/${tripId}/accept`, null, { params: { vehicle_id: vehicleId } })),
  cancelTrip: (tripId) => body(http.post(`/trips/${tripId}/cancel`)),
  reviewTrip: (tripId, payload) => body(http.post(`/trips/${tripId}/review`, payload)),
  // speed = segundos simulados por segundo real (1x, 5x, 10x).
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
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join('; ')
  return detail || `Erro ${err.response.status} ao processar o pedido.`
}
