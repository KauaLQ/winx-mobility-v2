import { useState } from 'react'
import ProfileSelect from './components/ProfileSelect'
import VehicleSelect from './components/VehicleSelect'
import Workspace from './components/Workspace'

export default function App() {
  // Sem login por enquanto: a seleção define o perfil e, para o motorista, o veículo.
  // Depois, o login real entra entre essas telas e o Workspace.
  const [profileId, setProfileId] = useState(null)
  const [vehicleId, setVehicleId] = useState(null)

  const exit = () => {
    setProfileId(null)
    setVehicleId(null)
  }

  let page
  if (!profileId) page = <ProfileSelect onSelect={setProfileId} />
  else if (profileId === 'motorista' && !vehicleId) page = <VehicleSelect onSelect={setVehicleId} onBack={exit} />
  else page = <Workspace profileId={profileId} vehicleId={vehicleId} onExit={exit} />

  return (
    // O app é sempre mobile: no computador ele aparece como uma coluna de celular centralizada.
    <div className="starfield h-dvh">
      <div className="mx-auto flex h-full w-full max-w-md flex-col border-x border-line bg-page shadow-xl shadow-ink/10">
        {page}
      </div>
    </div>
  )
}
