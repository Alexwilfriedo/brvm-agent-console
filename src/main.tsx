import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import { App } from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initSentry } from './lib/sentry'

initSentry()

// Thème initial avant React monte (évite un flash)
const initialTheme = localStorage.getItem('brvm-admin-theme') || 'light'
document.documentElement.setAttribute('data-theme', initialTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'Lexend, system-ui, sans-serif',
          },
        }}
        richColors
        closeButton
      />
    </ErrorBoundary>
  </StrictMode>,
)
