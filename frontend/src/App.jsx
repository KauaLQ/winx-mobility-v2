import { useState } from 'react'
import ProfileSelect from './components/ProfileSelect'
import VehicleSelect from './components/VehicleSelect'
import Workspace from './components/Workspace'

export default function App() {
  // Sem login por enquanto: a seleção define o perfil e, para o motorista, o veículo.
  // Depois, o login real entra entre essas telas e o Workspace.
  const [profileId, setProfileId] = useState(null)
  const [vehicleId, setVehicleId] = useState(null)
  const [direction, setDirection] = useState('forward') // sentido da última troca de tela (define de que lado a nova tela entra)

  const choose = (id) => {
    setDirection('forward')
    setProfileId(id)
  }
  const login = (id) => {
    setDirection('forward')
    setVehicleId(id)
  }
  const exit = () => {
    setDirection('back')
    setProfileId(null)
    setVehicleId(null)
  }

  let pageKey = 'workspace'
  let page = <Workspace profileId={profileId} vehicleId={vehicleId} onExit={exit} />
  if (!profileId) {
    pageKey = 'home'
    page = <ProfileSelect onSelect={choose} />
  } else if (profileId === 'motorista' && !vehicleId) {
    pageKey = 'vehicle'
    page = <VehicleSelect onSelect={login} onBack={exit} />
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