import { useState } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { MdArrowBack } from 'react-icons/md'
import { errorMessage } from '../api'
import { PROFILES } from '../constants'
import { useAuth } from '../context/useAuth'

const field =
  'w-full rounded-xl border border-line bg-surface px-3 py-3 text-base text-ink transition-colors focus:border-primary'

// Login do perfil escolhido: Google para Usuário final e Motorista (o cadastro é criado no primeiro acesso)
// e e-mail/senha para o Gestor.
export default function AuthScreen({ profileId, onBack }) {
  const { signInWithGoogle, signInManager } = useAuth()
  const profile = PROFILES[profileId]
  const isManager = profileId === 'gestor'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const google = async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle() // em caso de sucesso o navegador sai daqui para o Google
    } catch (err) {
      setError(err.message || 'Não foi possível iniciar o login com Google.')
      setLoading(false)
    }
  }

  const manager = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signInManager(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
      setLoading(false)
    }
  }

  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-center gap-3 bg-linear-to-b from-navy to-navy-deep px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          title="Voltar"
          className="grid h-9 w-9 place-items-center rounded-lg text-navy-soft transition-colors hover:text-white"
        >
          <MdArrowBack size={22} aria-hidden />
        </button>
        <div className="leading-none">
          <p className="font-display text-base font-bold tracking-wide">WINX</p>
          <p className="mt-1 text-xs text-navy-soft">Mobility · {profile.label}</p>
        </div>
      </header>
      <div className="h-0.5 shrink-0 bg-wx-gradient" />

      {/* justify-center: o conteúdo fica centralizado verticalmente entre o cabeçalho e o rodapé */}
      <main className="flex flex-1 flex-col justify-center gap-5 p-4">
        <div>
          <h1 className="font-display text-sm font-bold text-ink">{isManager ? 'Acesso da gestão' : 'Entrar na sua conta'}</h1>
          <p className="mt-1.5 text-sm text-mist">
            {isManager
              ? 'Use as credenciais fornecidas para a sua planta.'
              : 'Entre com o Google. No primeiro acesso, a sua conta é criada automaticamente.'}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-line border-l-4 border-l-alert bg-surface p-3 text-sm text-mist">
            {error}
          </p>
        )}

        {isManager ? (
          <form onSubmit={manager} className="flex flex-col gap-3">
            <label className="block text-sm font-semibold text-ink">
              E-mail
              <input type="email" className={`${field} mt-2 font-normal`} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </label>
            <label className="block text-sm font-semibold text-ink">
              Senha
              <input type="password" className={`${field} mt-2 font-normal`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </label>
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mt-1 rounded-xl bg-primary py-3.5 text-base font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={google}
            disabled={loading}
            className="flex items-center justify-center gap-3 rounded-xl border border-line bg-surface py-3.5 text-base font-semibold text-ink transition-colors hover:border-wx-cobalt/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FcGoogle size={22} aria-hidden />
            {loading ? 'Redirecionando…' : 'Entrar com Google'}
          </button>
        )}
      </main>

      {/* Mesmo degradê do cabeçalho: as cores vêm das variáveis do perfil (data-profile) */}
      <footer className="shrink-0 bg-linear-to-b from-navy to-navy-deep">
        <div className="h-0.5 bg-wx-gradient" />
        <div className="flex flex-col items-center gap-1 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center">
          <p className="mt-1 font-display text-xs font-bold tracking-wide text-white">WINX Mobility</p>
          <p className="text-xs text-navy-soft">© 2026</p>
        </div>
      </footer>
    </div>
  )
}