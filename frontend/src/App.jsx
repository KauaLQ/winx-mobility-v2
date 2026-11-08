import { useState } from 'react'
import ProfileSelect from './components/ProfileSelect'
import Workspace from './components/Workspace'

export default function App() {
  // Sem login por enquanto: a tela de seleção define o perfil. Depois, o login entra entre as duas telas.
  const [profileId, setProfileId] = useState(null)

  return (
    // O app é sempre mobile: no computador ele aparece como uma coluna de celular centralizada.
    <div className="starfield h-dvh">
      <div className="mx-auto flex h-full w-full max-w-md flex-col border-x border-line bg-page shadow-xl shadow-ink/10">
        {profileId ? (
          <Workspace profileId={profileId} onExit={() => setProfileId(null)} />
        ) : (
          <ProfileSelect onSelect={setProfileId} />
        )}
      </div>
    </div>
  )
}
