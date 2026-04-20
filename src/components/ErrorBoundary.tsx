import { Component, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Capture les crashes React → Sentry + UI de fallback lisible.
 * Ne protège PAS contre les erreurs async dans les event handlers (TanStack
 * Query les gère via `error` dans les queries/mutations).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-danger-bg)] mb-4">
            <AlertTriangle size={22} className="text-[var(--color-danger)]" />
          </div>
          <h1 className="text-lg font-semibold text-[var(--color-navy)]">
            Oups, quelque chose a planté.
          </h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            L'erreur a été remontée. Tu peux recharger la page ou réessayer.
          </p>
          <pre className="mt-4 text-left text-xs bg-[var(--color-muted)] rounded p-3 overflow-x-auto text-[var(--color-danger)] font-mono">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
              Recharger la page
            </Button>
            <Button variant="outline" size="sm" onClick={this.reset}>
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
