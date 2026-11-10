import { useState } from 'react'
import { api } from './api'
import AuthScreen from './components/AuthScreen'
import ProfileSelect from './components/ProfileSelect'
import VehicleSelect from './components/VehicleSelect'
import Workspace from './components/Workspace'
import { PROFILES } from './constants'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'

const PROFILE_KEY = 'winx.profile' // o login com Google sai do app e volta: guardamos o perfil escolhido

function Message({ children }) {
  return <p className="m-auto p-4 text-sm text-mist">{children}</p>
}

function Screens() {
  const { user, authenticated, loading, error, reloadUser, signOut } = useAuth()
  const [profileId, setProfileId] = useState(() => {
    const stored = localStorage.getItem(PROFILE_KEY)
    return PROFILES[stored] ? stored : null
  })
  const [driver, setDriver] = useState(null) // motorista: { vehicleId, driverId } depois de escolher o veículo
  const [direction, setDirection] = useState('forward') // sentido da última troca de tela (de que lado a nova entra)

  const choose = (id) => {
    setDirection('forward')
    localStorage.setItem(PROFILE_KEY, id)
    setProfileId(id)
  }
  const pickVehicle = (vehicleId, driverId) => {
    setDirection('forward')
    setDriver({ vehicleId, driverId })
  }
  const exit = async () => {
    setDirection('back')
    if (driver) await api.releaseVehicle(driver.vehicleId).catch(() => {}) // libera o veículo para outro motorista
    localStorage.removeItem(PROFILE_KEY)
    setProfileId(null)
    setDriver(null)
    await signOut()
  }

  // O gestor entra por credenciais; usuário e motorista, pelo Google (papel "usuario").
  const roleOk = user && (profileId === 'gestor' ? user.role === 'gestor' : user.role === 'usuario')

  let pageKey = 'workspace'
  let page = null
  if (loading) {
    pageKey = 'loading'
    page = <Message>Carregando…</Message>
  } else if (!profileId) {
    pageKey = 'home'
    page = <ProfileSelect onSelect={choose} />
  } else if (authenticated && error) {
    pageKey = 'error'
    page = (
      <div className="m-auto flex w-full max-w-xs flex-col gap-3 p-4 text-center">
        <p role="alert" className="text-sm text-mist">{error}</p>
        <button type="button" onClick={reloadUser} className="rounded-xl bg-primary py-3 text-base font-bold text-white transition-colors hover:bg-primary-hover">
          Tentar novamente
        </button>
        <button type="button" onClick={exit} className="rounded-xl border border-line bg-surface py-3 text-base font-semibold text-mist transition-colors hover:text-ink">
          Sair
        </button>
      </div>
    )
  } else if (!roleOk) {
    pageKey = 'auth'
    page = <AuthScreen profileId={profileId} onBack={exit} />
  } else if (profileId === 'motorista' && !driver) {
    pageKey = 'vehicle'
    page = <VehicleSelect onSelect={pickVehicle} onBack={exit} />
  } else {
    // who = quem "é dono" das viagens do histórico: o usuário (quem pediu) ou o motorista (quem conduziu)
    const who = profileId === 'motorista' ? driver.driverId : user.id
    page = <Workspace profileId={profileId} vehicleId={driver?.vehicleId} who={who} onExit={exit} />
  }

  return (
    // data-profile troca a paleta (ver index.css); sem perfil (página inicial), vale o tema padrão.
    // O app é sempre mobile: no computador ele aparece como uma coluna de celular centralizada.
    <div data-profile={profileId ?? undefined} className="starfield h-dvh">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden border-x border-line bg-page shadow-xl shadow-ink/10">
        {/* A key faz cada tela nova entrar com a animação de transição */}
        <div key={pageKey} className={`flex min-h-0 flex-1 flex-col ${direction === 'back' ? 'page-back' : 'page-forward'}`}>
          {page}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Screens />
    </AuthProvider>
  )
}