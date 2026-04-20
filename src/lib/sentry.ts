import * as Sentry from '@sentry/react'

/**
 * Init Sentry si `VITE_SENTRY_DSN` est défini. Silencieux sinon (dev).
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || 'brvm-admin@dev',
    tracesSampleRate: 0.1,
    // Filtre les erreurs bruyantes qui n'apportent rien
    beforeSend(event, hint) {
      const err = hint.originalException
      if (err instanceof Error && /401|403/.test(err.message)) return null
      return event
    },
  })
}
