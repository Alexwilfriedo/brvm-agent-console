import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { hasSession } from './token'

/**
 * Redirige vers /login si pas de session.
 * Conserve l'URL cible dans state pour redirection post-login.
 */
export function AuthGuard({ children }: PropsWithChildren) {
  const location = useLocation()
  if (!hasSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
