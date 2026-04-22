import { LayoutDashboard, FileText, ListChecks, Radio, Calendar, Users, Eye, LogOut, Sun, Moon, Search, ShieldCheck, LineChart, Wallet } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { clearSession } from '@/features/auth/token'
import { Button } from '@/components/ui/Button'
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/market', label: 'Marché', icon: LineChart },
  { to: '/briefs', label: 'Briefs', icon: FileText },
  { to: '/runs', label: 'Runs', icon: ListChecks },
  { to: '/sources', label: 'Sources', icon: Radio },
  { to: '/recipients', label: 'Destinataires', icon: Users },
  { to: '/trades', label: 'Trades', icon: Wallet },
  { to: '/schedule', label: 'Planification', icon: Calendar },
  { to: '/preview', label: 'Aperçu email', icon: Eye },
  { to: '/users', label: 'Utilisateurs', icon: ShieldCheck },
]

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('brvm-admin-theme') as 'light' | 'dark') || 'light'
  )
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('brvm-admin-theme', theme)
  }, [theme])
  return { theme, toggle: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')) }
}

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

export function Layout() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const palette = useCommandPalette()

  function logout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — sticky viewport-height pour que les actions du bas (thème,
          déconnexion) restent visibles même quand le contenu scroll. */}
      <aside className="hidden md:flex w-56 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-[var(--color-border)]">
          <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-[var(--color-gold)]">
            BRVM · Agent
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--color-navy)]">
            Console
          </div>
        </div>

        {/* Bouton palette visible → discoverable par les non-tech */}
        <div className="px-3 pt-3">
          <button
            onClick={() => palette.setOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-gold)]/40 transition-colors"
            aria-label="Ouvrir la palette de commandes"
          >
            <Search size={12} />
            <span className="flex-1 text-left">Rechercher…</span>
            <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-muted)] border border-[var(--color-border)]">
              {isMac ? '⌘' : 'Ctrl'}K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-2 pt-3 pb-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-[var(--color-navy-50)] text-[var(--color-navy)] font-medium'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-muted)]'
                )
              }
            >
              <Icon size={16} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-[var(--color-border)] space-y-1">
          <Button variant="ghost" size="sm" onClick={toggle} className="w-full justify-start">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'light' ? 'Mode sombre' : 'Mode clair'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start">
            <LogOut size={16} />
            <span>Se déconnecter</span>
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>

      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
    </div>
  )
}
