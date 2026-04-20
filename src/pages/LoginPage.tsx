import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Mail, Key, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { apiFetch, ApiError } from '@/lib/api'
import { setAdminToken, hasSession } from '@/features/auth/token'
import type { HealthResponse } from '@/lib/types'

type Mode = 'magic' | 'admin'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('magic')
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  // Si déjà authentifié, on redirige directement
  if (hasSession()) {
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-[var(--color-gold)]">
            BRVM · Agent
          </div>
          <div className="mt-1 text-2xl font-semibold text-[var(--color-navy)]">
            Console
          </div>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            {mode === 'magic'
              ? 'Reçois un lien de connexion sécurisé par email.'
              : 'Connexion super-admin via token.'}
          </p>
        </div>

        {mode === 'magic' ? <MagicLinkForm /> : <AdminTokenForm onSuccess={() => navigate(from, { replace: true })} />}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === 'magic' ? 'admin' : 'magic')}
            className="text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)] underline-offset-4 hover:underline"
          >
            {mode === 'magic'
              ? 'Se connecter avec le token admin (casse-de-verre) →'
              : '← Revenir à la connexion par email'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Magic link form --------------------------------------------------------

function MagicLinkForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      await apiFetch('/api/auth/request-link', {
        method: 'POST',
        body: { email: email.trim() },
        auth: false,
      })
      setSent(true)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
      else setError('Erreur inconnue.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] mb-4">
          <CheckCircle2 size={22} />
        </div>
        <h2 className="text-base font-semibold text-[var(--color-fg)]">Lien envoyé</h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Si <span className="font-mono text-[var(--color-fg)]">{email}</span> est autorisé,
          tu recevras un email dans quelques secondes.
        </p>
        <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
          Pense à vérifier les spams. Le lien expire dans 15 minutes.
        </p>
        <button
          type="button"
          onClick={() => { setSent(false); setEmail('') }}
          className="mt-4 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline-offset-4 hover:underline"
        >
          Renvoyer à une autre adresse
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (email.trim()) void submit() }}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 space-y-4"
    >
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
          Email
        </span>
        <div className="mt-1.5 relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="toi@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9"
            disabled={loading}
          />
        </div>
      </label>

      {error && (
        <div className="flex items-start gap-2 text-xs bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded-md px-3 py-2">
          <AlertCircle size={14} className="flex-none mt-px" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" variant="accent" disabled={loading || !email.trim()} className="w-full">
        {loading ? 'Envoi…' : 'Recevoir mon lien de connexion'}
      </Button>

      <p className="text-[11px] text-[var(--color-fg-subtle)] leading-relaxed">
        Seuls les emails autorisés peuvent recevoir un lien. Aucun mot de passe, aucun risque de
        fuite de credentials.
      </p>
    </form>
  )
}

// --- Admin token form (bypass) ---------------------------------------------

interface AdminTokenFormProps { onSuccess: () => void }

function AdminTokenForm({ onSuccess }: AdminTokenFormProps) {
  const [token, setTok] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setLoading(true)
    setAdminToken(token.trim())
    try {
      const health = await apiFetch<HealthResponse>('/health', { auth: false })
      if (health.status !== 'ok') throw new Error("API atteinte mais pas le backend BRVM.")
      await apiFetch('/api/auth/me')  // si 401 → token invalide
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Token refusé.')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Erreur inconnue.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (token.trim()) void submit() }}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 space-y-4"
    >
      <div className="text-xs p-3 bg-[var(--color-warning-bg)] text-[var(--color-warning)] rounded-md">
        Mode "casse-de-verre" — réservé aux cas où le magic link ne fonctionne pas.
      </div>
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
          Token admin
        </span>
        <div className="mt-1.5 relative">
          <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
          <Input
            type="password"
            autoComplete="current-password"
            autoFocus
            placeholder="••••••••••••••••••••••••••••••••"
            value={token}
            onChange={(e) => setTok(e.target.value)}
            className="pl-9 font-mono"
            disabled={loading}
          />
        </div>
      </label>

      {error && (
        <div className="flex items-start gap-2 text-xs bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded-md px-3 py-2">
          <AlertCircle size={14} className="flex-none mt-px" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" variant="primary" disabled={loading || !token.trim()} className="w-full">
        {loading ? 'Vérification…' : 'Se connecter'}
      </Button>
    </form>
  )
}
