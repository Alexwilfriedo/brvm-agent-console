import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { AlertTriangle, Info } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

/**
 * Modale de confirmation premium — basée sur Radix AlertDialog
 * (accessibilité + focus trap + escape + restitution du focus au trigger).
 *
 * Usage :
 *   const confirm = useConfirm()
 *   async function onDelete() {
 *     const ok = await confirm({
 *       title: 'Supprimer ce destinataire ?',
 *       description: `${r.channel} · ${r.address}`,
 *       confirmLabel: 'Supprimer',
 *       tone: 'danger',
 *     })
 *     if (ok) mutate(r.id)
 *   }
 */

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

interface PendingState {
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve })
    })
  }, [])

  function handle(value: boolean) {
    pending?.resolve(value)
    setPending(null)
  }

  const open = pending !== null
  const opts = pending?.options
  const tone = opts?.tone ?? 'primary'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={open} onOpenChange={(o) => { if (!o) handle(false) }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0"
          />
          <AlertDialog.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4',
              'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]',
              'shadow-[var(--shadow-elevated)]',
              'focus:outline-none'
            )}
          >
            {opts && (
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex-none w-10 h-10 rounded-full flex items-center justify-center',
                      tone === 'danger'
                        ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                        : 'bg-[var(--color-navy-50)] text-[var(--color-navy)]'
                    )}
                  >
                    {tone === 'danger' ? <AlertTriangle size={18} /> : <Info size={18} />}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <AlertDialog.Title className="text-base font-semibold text-[var(--color-fg)] leading-snug">
                      {opts.title}
                    </AlertDialog.Title>
                    {opts.description && (
                      <AlertDialog.Description className="mt-1.5 text-sm text-[var(--color-fg-muted)] leading-relaxed">
                        {opts.description}
                      </AlertDialog.Description>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <AlertDialog.Cancel asChild>
                    <Button variant="ghost" size="sm" onClick={() => handle(false)}>
                      {opts.cancelLabel ?? 'Annuler'}
                    </Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <Button
                      variant={tone === 'danger' ? 'danger' : 'primary'}
                      size="sm"
                      onClick={() => handle(true)}
                    >
                      {opts.confirmLabel ?? 'Confirmer'}
                    </Button>
                  </AlertDialog.Action>
                </div>
              </div>
            )}
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm() doit être utilisé à l\'intérieur de <ConfirmProvider>')
  }
  return ctx
}
