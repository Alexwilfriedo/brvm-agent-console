import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { apiFetch, ApiError } from '@/lib/api'
import { setJwt, setUser, type SessionUser } from '@/features/auth/token'

interface VerifyResponse {
  jwt: string
  expires_days: number
  user: SessionUser
}

/**
 * Page atterrissage du magic link : /auth/verify?token=xxx
 *
 * Consomme le token auprès du backend, persiste le JWT + user,
 * puis redirige vers le dashboard.
 */
export function VerifyPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const consumed = useRef(false)  // évite double-fetch en dev StrictMode

  useEffect(() => {
    if (consumed.current) return
    consumed.current = true

    if (!token) {
      setState('error')
      setMessage("Lien invalide : aucun jeton trouvé dans l'URL.")
      return
    }

    void apiFetch<VerifyResponse>('/api/auth/verify', {
      method: 'POST',
      body: { token },
      auth: false,
    })
      .then((resp) => {
        setJwt(resp.jwt)
        setUser(resp.user)
        setState('success')
        // Petite pause visuelle avant redirect
        setTimeout(() => navigate('/', { replace: true }), 600)
      })
      .catch((err) => {
        setState('error')
        if (err instanceof ApiError) setMessage(err.message)
        else if (err instanceof Error) setMessage(err.message)
        else setMessage('Erreur inconnue.')
      })
  }, [token, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 text-[10px] font-semibold tracking-[0.22em] uppercase text-[var(--color-gold)]">
          BRVM · Agent
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-8">
          {state === 'loading' && (
            <>
              <Loader2 size={24} className="mx-auto animate-spin text-[var(--color-navy)]" />
              <h2 className="mt-4 text-base font-semibold text-[var(--color-fg)]">
                Vérification du lien…
              </h2>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
                Ouverture de ta session en cours.
              </p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
                <CheckCircle2 size={22} />
              </div>
              <h2 className="mt-4 text-base font-semibold text-[var(--color-fg)]">
                Connexion réussie
              </h2>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
                Redirection vers le tableau de bord…
              </p>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
                <AlertCircle size={22} />
              </div>
              <h2 className="mt-4 text-base font-semibold text-[var(--color-fg)]">
                Lien invalide
              </h2>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
                {message}
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-5"
                onClick={() => navigate('/login', { replace: true })}
              >
                Demander un nouveau lien
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
