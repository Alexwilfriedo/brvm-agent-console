import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Mail, MessageSquare, Plus, Power, Trash2, RefreshCw } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardBody } from '@/components/ui/Card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useListQuery } from '@/lib/useListQuery'
import { apiFetch, ApiError } from '@/lib/api'
import type { Channel, Recipient } from '@/lib/types'

export function RecipientsPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [channelFilter, setChannelFilter] = useState<Channel | ''>('')

  const t = useListQuery<Recipient>({
    resource: 'recipients',
    path: '/api/recipients',
    filters: { channel: channelFilter || undefined },
    pageSize: 100,
  })

  const toggle = useMutation({
    mutationFn: (r: Recipient) =>
      apiFetch<Recipient>(`/api/recipients/${r.id}`, {
        method: 'PATCH',
        body: { enabled: !r.enabled },
      }),
    onSuccess: (updated) => {
      toast.success(updated.enabled ? `${updated.address} activé` : `${updated.address} désactivé`)
      qc.invalidateQueries({ queryKey: ['recipients'] })
    },
    onError: (err) => toast.error('Échec', { description: (err as Error).message }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/recipients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Destinataire supprimé')
      qc.invalidateQueries({ queryKey: ['recipients'] })
    },
    onError: (err) => toast.error('Suppression refusée', { description: (err as Error).message }),
  })

  const columns: Column<Recipient>[] = [
    {
      key: 'channel',
      header: 'Canal',
      width: 'w-36',
      cell: (r) =>
        r.channel === 'email' ? (
          <Badge tone="navy"><Mail size={10} /> Email</Badge>
        ) : (
          <Badge tone="gold"><MessageSquare size={10} /> WhatsApp</Badge>
        ),
    },
    {
      key: 'address',
      header: 'Adresse',
      mono: true,
      cell: (r) => <span className="text-[var(--color-fg)]">{r.address}</span>,
    },
    {
      key: 'name',
      header: 'Nom',
      width: 'w-48',
      hideOnMobile: true,
      cell: (r) =>
        r.name ? (
          <span>{r.name}</span>
        ) : (
          <span className="text-[var(--color-fg-subtle)]">—</span>
        ),
    },
    {
      key: 'enabled',
      header: 'État',
      width: 'w-28',
      cell: (r) =>
        r.enabled ? <Badge tone="success">Actif</Badge> : <Badge tone="neutral">Désactivé</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: 'w-28',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={toggle.isPending}
            onClick={async (e) => {
              e.stopPropagation()
              if (r.enabled) {
                // Désactivation = action sensible → confirm
                const ok = await confirm({
                  title: 'Désactiver ce destinataire ?',
                  description: (
                    <>
                      <span className="font-mono">{r.address}</span> ne recevra plus les briefs
                      jusqu'à réactivation.
                    </>
                  ),
                  confirmLabel: 'Désactiver',
                  tone: 'danger',
                })
                if (!ok) return
              }
              toggle.mutate(r)
            }}
            title={r.enabled ? 'Désactiver' : 'Activer'}
            aria-label={r.enabled ? 'Désactiver' : 'Activer'}
          >
            <Power size={13} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            onClick={async (e) => {
              e.stopPropagation()
              const ok = await confirm({
                title: 'Supprimer ce destinataire ?',
                description: (
                  <>
                    Le canal <span className="font-medium text-[var(--color-fg)]">{r.channel}</span>
                    {' · '}
                    <span className="font-mono">{r.address}</span> ne recevra plus les briefs.
                  </>
                ),
                confirmLabel: 'Supprimer',
                tone: 'danger',
              })
              if (ok) remove.mutate(r.id)
            }}
            title="Supprimer"
            aria-label="Supprimer"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ),
    },
  ]

  const filters: { value: Channel | ''; label: string; icon?: React.ReactNode }[] = [
    { value: '',         label: 'Tous' },
    { value: 'email',    label: 'Email',    icon: <Mail size={10} /> },
    { value: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare size={10} /> },
  ]

  return (
    <>
      <PageHeader
        title="Destinataires"
        subtitle="Email et WhatsApp recevant les briefs quotidiens."
        actions={
          <Button variant="outline" size="sm" onClick={() => t.refetch()} disabled={t.fetching}>
            <RefreshCw size={14} className={t.fetching ? 'animate-spin' : ''} />
            Rafraîchir
          </Button>
        }
      />
      <PageContent>
        <AddRecipientForm onCreated={() => qc.invalidateQueries({ queryKey: ['recipients'] })} />

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[var(--color-fg-muted)] font-medium">Canal :</span>
          <div className="flex gap-1 rounded-md bg-[var(--color-muted)] p-0.5">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setChannelFilter(f.value)}
                className={
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ' +
                  (channelFilter === f.value
                    ? 'bg-[var(--color-surface)] text-[var(--color-navy)] shadow-sm font-semibold'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
                }
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={t.data.items}
          rowKey={(r) => r.id}
          loading={t.loading}
          error={t.error as Error | null}
          searchPlaceholder="Rechercher par adresse ou nom…"
          emptyMessage="Aucun destinataire. Ajoute-en un pour commencer."
          {...t.tableProps}
        />
      </PageContent>
    </>
  )
}

interface AddFormProps {
  onCreated: () => void
}

function AddRecipientForm({ onCreated }: AddFormProps) {
  const [channel, setChannel] = useState<Channel>('email')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Recipient>('/api/recipients', {
        method: 'POST',
        body: { channel, address: address.trim(), name: name.trim() || null, enabled: true },
      }),
    onSuccess: (created) => {
      toast.success('Destinataire ajouté', { description: `${created.channel} · ${created.address}` })
      setAddress('')
      setName('')
      setError(null)
      onCreated()
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : String(err)
      setError(msg)
      toast.error("Ajout refusé", { description: msg })
    },
  })

  return (
    <Card>
      <CardBody>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (address.trim()) create.mutate()
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-none w-40">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              Canal
            </span>
            <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email" icon={<Mail size={13} />}>Email</SelectItem>
                <SelectItem value="whatsapp" icon={<MessageSquare size={13} />}>WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex-1 min-w-[220px]">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              Adresse
            </span>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={channel === 'email' ? 'brief@exemple.ci' : '+2250700000000'}
              className="font-mono"
            />
          </label>
          <label className="flex-1 min-w-[180px]">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              Nom (optionnel)
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex"
            />
          </label>
          <Button
            type="submit"
            variant="accent"
            disabled={!address.trim() || create.isPending}
          >
            <Plus size={14} />
            Ajouter
          </Button>
        </form>
        {error && (
          <div className="mt-3 text-xs bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded px-3 py-2">
            {error}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
