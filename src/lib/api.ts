/**
 * Client HTTP minimal pour l'API BRVM Agent.
 *
 * - Base URL : `VITE_API_URL` en prod, `/` en dev (Vite proxy)
 * - Auth : header `X-Admin-Token` lu depuis localStorage
 * - Erreurs : lève `ApiError` avec status + message exploitable
 */
import { getJwt, getAdminToken, clearSession } from '@/features/auth/token'

/**
 * Normalise `VITE_API_URL` pour éviter les URLs cassées au moindre typo dans
 * les variables Railway/Vercel :
 *   - `""` / `undefined` → `""` (résolu en relatif vers l'origine courante via le proxy Vite en dev)
 *   - `"https://api.foo.com"` → inchangé
 *   - `"https://api.foo.com/"` → strip du slash final
 *   - `"api.foo.com"` → ajout automatique de `https://`
 *   - `"https:/api.foo.com"` ou autre garbage → warning console + fallback ''
 */
function normalizeBase(raw: string | undefined): string {
  if (!raw) return ''
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  // Cas valide : http:// ou https:// suivi d'un hostname
  if (/^https?:\/\/[a-z0-9.-]+/i.test(trimmed)) return trimmed
  // Cas sans protocole : on force https
  if (/^[a-z0-9.-]+(\.[a-z]{2,})/i.test(trimmed)) return `https://${trimmed}`
  // Autrement la valeur est cassée — warning + fallback origine
  // eslint-disable-next-line no-console
  console.warn(
    `[api] VITE_API_URL="${raw}" invalide. Attendu : "https://api.monprojet.up.railway.app". ` +
    `Fallback sur l'origine courante (même domaine que l'admin).`,
  )
  return ''
}

const BASE = normalizeBase(import.meta.env.VITE_API_URL)

/**
 * Base URL de l'API, exposée pour les cas rares où un composant doit
 * construire lui-même une URL (ex: `<iframe src={...}>` pour /preview/brief,
 * où on ne peut pas passer par `fetch`).
 * En dev : `""` → URL relative → le proxy Vite prend le relais.
 * En prod : `https://api.monprojet.up.railway.app` (sans slash final).
 */
export const API_BASE = BASE

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
