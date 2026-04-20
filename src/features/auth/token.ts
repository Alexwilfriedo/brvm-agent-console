/**
 * Stockage de la session utilisateur — JWT émis par /api/auth/verify.
 *
 * On conserve aussi un **fallback super-admin** optionnel : si l'utilisateur
 * connaît le `ADMIN_API_TOKEN` server-side, il peut se connecter en mode
 * "casse-de-verre" (le token est envoyé via header X-Admin-Token).
 *
 * Sécu : localStorage est accessible en JS (XSS possible). On accepte pour un
 * admin perso. Pour durcir : migrer vers cookie httpOnly + CSRF.
 */
const JWT_KEY = 'brvm-admin-jwt'
const USER_KEY = 'brvm-admin-user'
const ADMIN_TOKEN_KEY = 'brvm-admin-master-token'

export interface SessionUser {
  id: number
  email: string
  name: string | null
  enabled: boolean
}

// --- JWT session -----------------------------------------------------------

export function getJwt(): string | null {
  try { return localStorage.getItem(JWT_KEY) } catch { return null }
}

export function setJwt(jwt: string): void {
  localStorage.setItem(JWT_KEY, jwt)
}

export function getUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

export function setUser(user: SessionUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

// --- Super-admin bypass (token master) -------------------------------------

export function getAdminToken(): string | null {
  try { return localStorage.getItem(ADMIN_TOKEN_KEY) } catch { return null }
}

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

// --- Helpers communs -------------------------------------------------------

export function hasSession(): boolean {
  return Boolean(getJwt() || getAdminToken())
}

export function clearSession(): void {
  try {
    localStorage.removeItem(JWT_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}
