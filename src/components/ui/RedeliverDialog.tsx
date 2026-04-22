import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Mail, Plus, Search, Users, X } from 'lucide-react'
import { Button } from './Button'
import { Input } from './Input'
import { Badge } from './Badge'
import { cn } from '@/lib/cn'
import { apiFetch } from '@/lib/api'
import type { Recipient, RedeliverTarget } from '@/lib/types'

/**
 * Dialog pour rejouer la livraison d'un brief avec choix du mode :
 * - "Tous les destinataires actifs" → renvoie au pipeline normal (WhatsApp inclus si activé)
 * - "Destinataires spécifiques" → sélection multi dans les recipients DB + saisie ad-hoc
 *
 * Le dialog résout :
 *   - undefined  → annulation
 *   - null       → livraison standard (tous les actifs)
 *   - Target[]   → livraison ciblée à cette liste
 */

type Mode = 'standard' | 'targeted'
type Resolution = null | RedeliverTarget[]

interface RedeliverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (targets: Resolution) => void
  loading?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RedeliverDialog({ open, onOpenChange, onConfirm, loading }: RedeliverDialogProps) {
  const [mode, setMode] = useState<Mode>('standard')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [adHocEmail, setAdHocEmail] = useState('')
  const [adHocName, setAdHocName] = useState('')
  const [adHocList, setAdHocList] = useState<RedeliverTarget[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Reset quand on ouvre/ferme
  useEffect(() => {
    if (!open) {
      setMode('standard')
      setSelectedIds(new Set())
      setAdHocEmail('')
      setAdHocName('')
      setAdHocList([])
      setFormError(null)
      setSearch('')
    }
  }, [open])

  // Charge les recipients email en DB uniquement quand on bascule en mode ciblé
  const recipientsQ = useQuery({
    queryKey: ['recipients', 'email', 'all'],
    queryFn: () =>
      apiFetch<{ items: Recipient[] }>('/api/recipients?channel=email&limit=200'),
    enabled: open && mode === 'targeted',
  })

  const dbRecipients = (recipientsQ.data?.items ?? []).filter((r) => r.enabled)

  const filteredRecipients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return dbRecipients
    return dbRecipients.filter(
      (r) =>
        r.address.toLowerCase().includes(q) ||
        (r.name?.toLowerCase().includes(q) ?? false),
    )
  }, [dbRecipients, search])

  const filteredIds = useMemo(
    () => filteredRecipients.map((r) => r.id),
    [filteredRecipients],
  )
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id))

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id)
      } else {
        for (const id of filteredIds) next.add(id)
      }
      return next
    })
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addAdHoc() {
    const email = adHocEmail.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) {
      setFormError('Email invalide.')
      return
    }
    if (adHocList.some((r) => r.email.toLowerCase() === email)) {
      setFormError('Email déjà ajouté.')
      return
    }
    setAdHocList((prev) => [...prev, { email, name: adHocName.trim() || null }])
    setAdHocEmail('')
    setAdHocName('')
    setFormError(null)
  }

  function removeAdHoc(email: string) {
    setAdHocList((prev) => prev.filter((r) => r.email !== email))
  }

  // Calcule la liste finale à envoyer
  function buildTargets(): RedeliverTarget[] {
    const fromDb: RedeliverTarget[] = dbRecipients
      .filter((r) => selectedIds.has(r.id))
      .map((r) => ({ email: r.address, name: r.name }))
    // Dédup case-insensitive en préservant l'ordre (DB d'abord, ad-hoc ensuite)
    const seen = new Set<string>()
    const merged: RedeliverTarget[] = []
    for (const t of [...fromDb, ...adHocList]) {
      const key = t.email.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(t)
    }
    return merged
  }

  function onSubmit() {
    if (mode === 'standard') {
      onConfirm(null)
      return
    }
    const targets = buildTargets()
    if (targets.length === 0) {
      setFormError('Sélectionne au moins un destinataire ou ajoute un email.')
      return
    }
    if (targets.length > 50) {
      setFormError('Max 50 destinataires par envoi.')
      return
    }
    setFormError(null)
    onConfirm(targets)
  }

  const targetCount = mode === 'targeted' ? buildTargets().length : 0

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg mx-4',
            'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]',
            'shadow-[var(--shadow-elevated)] focus:outline-none',
            'max-h-[85vh] flex flex-col',
          )}
        >
          <div className="p-6 pb-3 flex items-start justify-between gap-3 border-b border-[var(--color-border)]">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex-none w-10 h-10 rounded-full flex items-center justify-center bg-[var(--color-navy-50)] text-[var(--color-navy)]">
                <Mail size={18} />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <Dialog.Title className="text-base font-semibold text-[var(--color-fg)] leading-snug">
                  Rejouer la livraison
                </Dialog.Title>
                <Dialog.Description className="mt-1.5 text-sm text-[var(--color-fg-muted)] leading-relaxed">
                  Choisis à qui renvoyer ce brief. Le payload reste inchangé — seule la livraison est retentée.
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

          <div className="px-6 py-4 overflow-y-auto flex-1">
            {/* Tabs mode */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-[var(--color-muted)]">
              <ModeTab
                active={mode === 'standard'}
                onClick={() => setMode('standard')}
                icon={<Users size={14} />}
                label="Tous les actifs"
                hint="Email + WhatsApp"
              />
              <ModeTab
                active={mode === 'targeted'}
                onClick={() => setMode('targeted')}
                icon={<Mail size={14} />}
                label="Destinataires spécifiques"
                hint="Email uniquement"
              />
            </div>

            {mode === 'standard' ? (
              <div className="mt-4 text-sm text-[var(--color-fg-muted)] leading-relaxed">
                Envoie le brief à <strong className="text-[var(--color-fg)]">tous les destinataires email actifs</strong> en base,
                plus WhatsApp si activé. Met à jour le statut officiel du brief.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Sélection DB */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                      Destinataires enregistrés
                      {dbRecipients.length > 0 && (
                        <span className="ml-1.5 normal-case tracking-normal font-normal">
                          ({selectedIds.size}/{dbRecipients.length})
                        </span>
                      )}
                    </div>
                    {filteredRecipients.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleAllFiltered}
                        className="text-[11px] text-[var(--color-navy)] hover:underline"
                      >
                        {allFilteredSelected
                          ? 'Tout désélectionner'
                          : search
                            ? `Sélectionner ces ${filteredRecipients.length}`
                            : 'Tout sélectionner'}
                      </button>
                    )}
                  </div>

                  {recipientsQ.isLoading ? (
                    <p className="text-xs text-[var(--color-fg-subtle)]">Chargement…</p>
                  ) : dbRecipients.length === 0 ? (
                    <p className="text-xs text-[var(--color-fg-subtle)]">
                      Aucun destinataire email actif en DB.
                    </p>
                  ) : (
                    <>
                      {dbRecipients.length > 5 && (
                        <div className="relative mb-2">
                          <Search
                            size={13}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)] pointer-events-none"
                          />
                          <Input
                            type="text"
                            placeholder="Filtrer par email ou nom…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                          />
                          {search && (
                            <button
                              type="button"
                              onClick={() => setSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                              aria-label="Effacer la recherche"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="max-h-40 overflow-y-auto rounded-md border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                        {filteredRecipients.length === 0 ? (
                          <p className="px-3 py-4 text-xs text-[var(--color-fg-subtle)] text-center">
                            Aucun résultat pour « {search} ».
                          </p>
                        ) : (
                          filteredRecipients.map((r) => (
                            <label
                              key={r.id}
                              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--color-muted)]"
                            >
                              <input
                                type="checkbox"
                                className="accent-[var(--color-navy)]"
                                checked={selectedIds.has(r.id)}
                                onChange={() => toggleSelect(r.id)}
                              />
                              <span className="text-sm text-[var(--color-fg)] font-mono flex-1 truncate">
                                {r.address}
                              </span>
                              {r.name && (
                                <span className="text-xs text-[var(--color-fg-muted)] truncate">
                                  {r.name}
                                </span>
                              )}
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Ad-hoc */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                    Ajouter un email ad-hoc
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="email@exemple.com"
                      value={adHocEmail}
                      onChange={(e) => setAdHocEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addAdHoc()
                        }
                      }}
                      className="flex-1"
                    />
                    <Input
                      type="text"
                      placeholder="Nom (optionnel)"
                      value={adHocName}
                      onChange={(e) => setAdHocName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAdHoc}
                      disabled={!adHocEmail.trim()}
                    >
                      <Plus size={14} />
                      Ajouter
                    </Button>
                  </div>
                  {adHocList.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {adHocList.map((r) => (
                        <span
                          key={r.email}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-muted)] rounded-md text-xs"
                        >
                          <span className="font-mono text-[var(--color-fg)]">{r.email}</span>
                          {r.name && <span className="text-[var(--color-fg-muted)]">· {r.name}</span>}
                          <button
                            type="button"
                            onClick={() => removeAdHoc(r.email)}
                            className="text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"
                            aria-label={`Retirer ${r.email}`}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {formError && (
                  <p className="text-xs text-[var(--color-danger)]">{formError}</p>
                )}

                <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
                  <span className="text-xs text-[var(--color-fg-muted)]">
                    Envoi ad-hoc — le statut officiel du brief n'est pas modifié.
                  </span>
                  {targetCount > 0 && (
                    <Badge tone="neutral" size="sm">
                      {targetCount} destinataire{targetCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" disabled={loading}>Annuler</Button>
            </Dialog.Close>
            <Button
              variant="primary"
              size="sm"
              onClick={onSubmit}
              disabled={loading || (mode === 'targeted' && targetCount === 0)}
            >
              {loading ? 'Envoi…' : 'Envoyer'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ModeTab({
  active, onClick, icon, label, hint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-0.5 px-3 py-2 rounded-md text-left transition-colors',
        active
          ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-fg)] ring-1 ring-[var(--color-border)]'
          : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
      </span>
      <span className="text-[11px] text-[var(--color-fg-muted)] pl-5">{hint}</span>
    </button>
  )
}
