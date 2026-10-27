import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { TICK_MS } from '../constants'

// Chama fn, espera terminar e só então agenda a próxima rodada (sem requisições sobrepostas).
function usePolling(fn, ms) {
  const latest = useRef(fn)
  latest.current = fn

  useEffect(() => {
    let stopped = false
    let timer
    const loop = async () => {
      await latest.current()
      if (!stopped) timer = setTimeout(loop, ms)
    }
    loop()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [ms])
}

export function useLiveData() {
  const [graph, setGraph] = useState(null) // nós, vias e congestionamento
  const [sim, setSim] = useState(null) // relógio, veículos e viagens
  const [online, setOnline] = useState(true)

  const loadSim = useCallback(async () => {
    try {
      setSim(await api.state())
      setOnline(true)
    } catch {
      setOnline(false)
    }
  }, [])

  const loadGraph = useCallback(async () => {
    try {
      setGraph(await api.graph())
    } catch {
      /* tenta de novo no próximo ciclo */
    }
  }, [])

  usePolling(loadSim, TICK_MS)
  usePolling(loadGraph, 2000)

  const refresh = useCallback(() => Promise.all([loadSim(), loadGraph()]), [loadSim, loadGraph])
  return { graph, sim, online, refresh }
}
