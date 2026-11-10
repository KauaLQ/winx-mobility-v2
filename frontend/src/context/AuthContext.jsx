import { createContext, useEffect, useState } from 'react'
import { MANAGER_TOKEN_KEY, api, errorMessage } from '../api'
import { supabase } from '../lib/supabase'

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null)

// Dois jeitos de entrar: Google (sessão do Supabase) e credenciais do gestor (token próprio no localStorage).
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [restoring, setRestoring] = useState(true) // true até o Supabase restaurar a sessão (ou ler o retorno do OAuth)
  const [managerToken, setManagerToken] = useState(() => localStorage.getItem(MANAGER_TOKEN_KEY))

  // Usuário do backend, guardado junto com a chave de quem ele pertence: se quem logou mudar, o antigo é ignorado.
  const [saved, setSaved] = useState({ key: null, user: null, error: '' })
  const [attempt, setAttempt] = useState(0)

  const authKey = managerToken ?? session?.user?.id ?? null

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setRestoring(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Token recusado pela API (vencido/inválido): encerra a sessão local.
  useEffect(() => {
    const onUnauthorized = () => {
      localStorage.removeItem(MANAGER_TOKEN_KEY)
      setManagerToken(null)
      supabase.auth.signOut()
    }
    window.addEventListener('winx:unauthorized', onUnauthorized)
    return () => window.removeEventListener('winx:unauthorized', onUnauthorized)
  }, [])

  // Busca o usuário no backend (é aqui que a conta Google é criada no primeiro acesso).
  useEffect(() => {
    if (!authKey) return
    let cancelled = false

    async function load() {
      try {
        const user = await api.me()
        if (!cancelled) setSaved({ key: authKey, user, error: '' })
      } catch (err) {
        if (!cancelled) setSaved({ key: authKey, user: null, error: errorMessage(err) })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authKey, attempt])

  async function signInWithGoogle() {
    localStorage.removeItem(MANAGER_TOKEN_KEY) // evita o token do gestor "mascarar" a conta Google
    setManagerToken(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function signInManager(email, password) {
    const { access_token: token } = await api.managerLogin(email, password)
    localStorage.setItem(MANAGER_TOKEN_KEY, token)
    setManagerToken(token)
  }

  async function signOut() {
    localStorage.removeItem(MANAGER_TOKEN_KEY)
    setManagerToken(null)
    await supabase.auth.signOut()
  }

  function reloadUser() {
    setSaved({ key: null, user: null, error: '' })
    setAttempt((n) => n + 1)
  }

  const current = authKey && saved.key === authKey ? saved : null
  const value = {
    user: current?.user ?? null, // { id, name, email, role: 'usuario' | 'gestor', avatar_url, ... }
    authenticated: Boolean(authKey),
    loading: restoring || (Boolean(authKey) && !current),
    error: current?.error ?? '',
    reloadUser,
    signInWithGoogle,
    signInManager,
    signOut,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}