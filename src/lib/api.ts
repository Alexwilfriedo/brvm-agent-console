/**
 * Client HTTP minimal pour l'API BRVM Agent.
 *
 * - Base URL : `VITE_API_URL` en prod, `/` en dev (Vite proxy)
 * - Auth : header `X-Admin-Token` lu depuis localStorage
 * - Erreurs : lève `ApiError` avec status + message exploitable
 */
import { getJwt, getAdminToken, clearSession } from '@/features/auth/token'

const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Si false, n'envoie pas le token (utile pour /health). */
  auth?: boolean
}

export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, auth = true } = opts
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    // Priorité : JWT de session utilisateur. Fallback : token admin (casse-de-verre).
    const jwt = getJwt()
    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`
    } else {
      const admin = getAdminToken()
      if (admin) headers['X-Admin-Token'] = admin
    }
  }

  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  // 401 → session invalide → purge + redirige
  if (resp.status === 401) {
    clearSession()
    throw new ApiError(401, 'Session invalide ou expirée — reconnecte-toi.')
  }

  if (resp.status === 204) return undefined as T

  const text = await resp.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`
    if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
      msg = String((parsed as { detail: unknown }).detail)
    }
    throw new ApiError(resp.status, msg, parsed)
  }

  return parsed as T
}
