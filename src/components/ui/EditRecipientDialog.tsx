import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Mail, MessageSquare, Pencil, X } from 'lucide-react'
import { Button } from './Button'
import { Input } from './Input'
import { apiFetch, ApiError } from '@/lib/api'
import type { Recipient, RecipientFrequency } from '@/lib/types'
import { cn } from '@/lib/cn'

/**
 * Dialog d'édition d'un destinataire existant.
 *
 * Le canal n'est PAS éditable — changer d'email→whatsapp (ou inverse)
 * impliquerait de re-valider le format + réinitialiser la session de livraison
 * associée. Si besoin : supprimer + recréer. Plus sûr, audit trail plus clair.
 */

interface EditRecipientDialogProps {
  recipient: Recipient | null
  onOpenChange: (open: boolean) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+\d{8,15}$/

export function EditRecipientDialog({ recipient, onOpenChange }: EditRecipientDialogProps) {
  const qc = useQueryClient()
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [frequency, setFrequency] = useState<RecipientFrequency>('daily')
  const [formError, setFormError] = useState<string | null>(null)

  // Re-seed quand on ouvre sur un nouveau destinataire
  useEffect(() => {
    if (recipient) {
      setAddress(recipient.address)
      setName(recipient.name ?? '')
      setNotes(recipient.notes ?? '')
      setEnabled(recipient.enabled)
      setFrequency(recipient.frequency ?? 'daily')
      setFormError(null)
    }
  }, [recipient])

  const patch = useMutation({
    mutationFn: (body: Partial<Recipient>) =>
      apiFetch<Recipient>(`/api/recipients/${recipient!.id}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: (updated) => {
      toast.success('Destinataire mis à jour', {
        description: `${updated.channel} · ${updated.address}`,
      })
      qc.invalidateQueries({ queryKey: ['recipients'] })
      onOpenChange(false)
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : (err as Error).message
      setFormError(msg)
      toast.error('Modification refusée', { description: msg })
    },
  })

  function validate(): string | null {
    const addr = address.trim()
    if (!addr) return 'Adresse requise.'
    if (recipient?.channel === 'email' && !EMAIL_RE.test(addr)) {
      return 'Email invalide.'
    }
    if (recipient?.channel === 'whatsapp' && !PHONE_RE.test(addr)) {
      return 'Numéro WhatsApp invalide — format E.164 (+225...).'
    }
    return null
  }

  function submit() {
    if (!recipient) return
    const err = validate()
    if (err) {
      setFormError(err)
      return
    }
    // Envoie uniquement les champs modifiés (PATCH diff)
    const body: Partial<Recipient> = {}
    const addr = address.trim()
    if (addr !== recipient.address) body.address = addr
    const n = name.trim() || null
    if (n !== (recipient.name ?? null)) body.name = n
    const notesVal = notes.trim() || null
    if (notesVal !== (recipient.notes ?? null)) body.notes = notesVal
    if (enabled !== recipient.enabled) body.enabled = enabled
    if (frequency !== (recipient.frequency ?? 'daily')) body.frequency = frequency

    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      return
    }
    setFormError(null)
    patch.mutate(body)
  }

  const open = recipient !== null
  const isEmail = recipient?.channel === 'email'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4',
            'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]',
            'shadow-[var(--shadow-elevated)] focus:outline-none',
          )}
        >
          {recipient && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <div className="p-6 pb-3 flex items-start justify-between gap-3 border-b border-[var(--color-border)]">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex-none w-10 h-10 rounded-full flex items-center justify-center bg-[var(--color-navy-50)] text-[var(--color-navy)]">
                    <Pencil size={18} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <Dialog.Title className="text-base font-semibold text-[var(--color-fg)] leading-snug">
                      Modifier le destinataire
                    </Dialog.Title>
                    <Dialog.Description className="mt-1.5 text-sm text-[var(--color-fg-muted)] leading-relaxed inline-flex items-center gap-1.5">
                      {isEmail ? <Mail size={11} /> : <MessageSquare size={11} />}
                      Canal {recipient.channel} — non modifiable
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="flex-none p-1 rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-muted)]"
                    aria-label="Fermer"
                  >
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <div className="px-6 py-4 space-y-4">
                <Field label="Adresse">
                  <Input
                    type={isEmail ? 'email' : 'tel'}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={isEmail ? 'email@exemple.com' : '+2250700000000'}
                    className="font-mono"
                    autoFocus
                  />
                </Field>

                <Field label="Nom (optionnel)">
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex"
                  />
                </Field>

                {isEmail && (
                  <Field label="Fréquence de réception">
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: 'daily',         label: 'Daily',    hint: 'Chaque brief + audit hebdo' },
                        { value: 'weekly',        label: 'Hebdo',    hint: 'Audit hebdo uniquement' },
                        { value: 'critical_only', label: 'Critique', hint: 'Conviction ≥ 4 + hebdo' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFrequency(opt.value)}
                          className={cn(
                            'px-3 py-2 rounded-md border text-left text-xs transition-colors',
                            frequency === opt.value
                              ? 'border-[var(--color-navy)] bg-[var(--color-navy-50)] text-[var(--color-navy)]'
                              : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-muted)]',
                          )}
                        >
                          <div className="font-semibold">{opt.label}</div>
                          <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">
                            {opt.hint}
                          </div>
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                <Field label="Notes (optionnel)">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Ex : CFO — reçoit aussi les alertes critiques"
                    className={cn(
                      'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]',
                      'px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)]',
                      'focus:border-[var(--color-navy)]/50 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--focus-ring)]',
                      'resize-none',
                    )}
                  />
                </Field>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[var(--color-navy)]"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  <span className="text-sm text-[var(--color-fg)]">
                    Actif — reçoit les briefs
                  </span>
                </label>

                {formError && (
                  <p className="text-xs text-[var(--color-danger)]">{formError}</p>
                )}
              </div>

              <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost" size="sm" disabled={patch.isPending}>
                    Annuler
                  </Button>
                </Dialog.Close>
                <Button type="submit" variant="primary" size="sm" disabled={patch.isPending}>
                  {patch.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
        {label}
      </span>
      {children}
    </label>
  )
}
