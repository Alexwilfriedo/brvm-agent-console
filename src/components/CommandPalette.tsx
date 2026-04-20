import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  LayoutDashboard, FileText, ListChecks, Radio, Users, Calendar, Eye,
  Play, Sun, LogOut, Search, ShieldCheck, LineChart,
} from 'lucide-react'
import { clearSession } from '@/features/auth/token'
import { apiFetch } from '@/lib/api'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const modKey = isMac ? '⌘' : 'Ctrl'

/**
 * Palette de commandes (⌘K / Ctrl+K).
 *
 * Règle : pas d'action destructive via palette — ça passe par les pages
 * dédiées avec confirmation modale. Ici : navigation + actions idempotentes.
 */
export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  function run(action: () => void | Promise<void>) {
    onOpenChange(false)
    setTimeout(() => { void action() }, 40)
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    const next = cur === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('brvm-admin-theme', next)
    toast.success(next === 'dark' ? 'Mode sombre activé' : 'Mode clair activé')
  }

  async function triggerRun() {
    try {
      await apiFetch('/api/schedule/run-now', { method: 'POST' })
      toast.success('Pipeline déclenché', { description: "Suivi dans l'onglet Exécutions." })
    } catch (err) {
      toast.error('Échec', { description: (err as Error).message })
    }
  }

  function logout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-start justify-center pt-[14vh]"
      onClick={() => onOpenChange(false)}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl mx-4">
        <Command
          shouldFilter={true}
          label="Palette de commandes"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-elevated)] overflow-hidden"
        >
          {/* Champ de recherche */}
          <div className="flex items-center gap-3 px-4 border-b border-[var(--color-border)]">
            <Search size={15} className="text-[var(--color-fg-subtle)]" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Rechercher une page ou une action…"
              className="flex-1 h-12 bg-transparent outline-none text-[15px] placeholder:text-[var(--color-fg-subtle)]"
              autoFocus
            />
            <Kbd>Esc</Kbd>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto py-2">
            <Command.Empty className="px-4 py-10 text-center text-sm text-[var(--color-fg-subtle)]">
              Aucun résultat.
            </Command.Empty>

            <Group heading="Navigation">
              <Item icon={<LayoutDashboard size={15} />} label="Tableau de bord" hint="G D" onSelect={() => run(() => navigate('/'))} />
              <Item icon={<LineChart size={15} />}       label="Marché"           hint="G M" onSelect={() => run(() => navigate('/market'))} />
              <Item icon={<FileText size={15} />}        label="Briefs"           hint="G B" onSelect={() => run(() => navigate('/briefs'))} />
              <Item icon={<ListChecks size={15} />}      label="Exécutions"       hint="G R" onSelect={() => run(() => navigate('/runs'))} />
              <Item icon={<Radio size={15} />}           label="Sources"          hint="G S" onSelect={() => run(() => navigate('/sources'))} />
              <Item icon={<Users size={15} />}           label="Destinataires"    onSelect={() => run(() => navigate('/recipients'))} />
              <Item icon={<Calendar size={15} />}        label="Planification"    onSelect={() => run(() => navigate('/schedule'))} />
              <Item icon={<Eye size={15} />}             label="Aperçu email"     onSelect={() => run(() => navigate('/preview'))} />
              <Item icon={<ShieldCheck size={15} />}    label="Utilisateurs"     onSelect={() => run(() => navigate('/users'))} />
            </Group>

            <Group heading="Actions">
              <Item icon={<Play size={15} />} label="Lancer un brief maintenant"      onSelect={() => run(triggerRun)} />
              <Item icon={<Sun size={15} />}  label="Basculer mode clair / sombre"    onSelect={() => run(toggleTheme)} />
              <Item icon={<LogOut size={15} />} label="Se déconnecter"                 onSelect={() => run(logout)} />
            </Group>
          </Command.List>

          {/* Pied de page */}
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-[var(--color-border)] text-[11px] text-[var(--color-fg-subtle)] bg-[var(--color-surface-2)]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd><Kbd>↓</Kbd>
                <span>naviguer</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd>
                <span>valider</span>
              </span>
              <span className="hidden sm:flex items-center gap-1.5">
                <Kbd>{modKey}</Kbd><Kbd>K</Kbd>
                <span>ouvrir</span>
              </span>
            </div>
            <span className="font-medium text-[var(--color-fg-muted)]">BRVM Agent</span>
          </div>
        </Command>
      </div>
    </div>
  )
}

// --- Sous-composants ---------------------------------------------------------

interface GroupProps {
  heading: string
  children: React.ReactNode
}

function Group({ heading, children }: GroupProps) {
  return (
    <Command.Group>
      <div className="px-4 pt-2 pb-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--color-fg-subtle)]">
        {heading}
      </div>
      <div className="px-2">
        {children}
      </div>
    </Command.Group>
  )
}

interface ItemProps {
  icon: React.ReactNode
  label: string
  hint?: string
  onSelect: () => void
}

function Item({ icon, label, hint, onSelect }: ItemProps) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-[14px] text-[var(--color-fg)] data-[selected=true]:bg-[var(--color-muted)] transition-colors"
    >
      <span className="text-[var(--color-fg-muted)] group-data-[selected=true]:text-[var(--color-gold-600)] transition-colors">
        {icon}
      </span>
      <span className="flex-1 group-data-[selected=true]:text-[var(--color-navy)] group-data-[selected=true]:font-medium">
        {label}
      </span>
      {hint && (
        <span className="flex items-center gap-1 opacity-60 group-data-[selected=true]:opacity-100 transition-opacity">
          {hint.split(' ').map((k, i) => <Kbd key={i}>{k}</Kbd>)}
        </span>
      )}
    </Command.Item>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="font-mono text-[10px] min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
      {children}
    </kbd>
  )
}

// --- Hook global -------------------------------------------------------------

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return { open, setOpen }
}
