import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardBody } from '@/components/ui/Card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useListQuery } from '@/lib/useListQuery'
import { apiFetch, ApiError } from '@/lib/api'
import type { Trade, TradeAction, TradeReason } from '@/lib/types'

const REASON_LABELS: Record<TradeReason, string> = {
  brief: 'Brief',
  intuition: 'Intuition',
  news: 'News',
  other: 'Autre',
}

const REASON_TONES: Record<TradeReason, 'gold' | 'navy' | 'neutral'> = {
  brief: 'gold',
  intuition: 'navy',
  news: 'navy',
  other: 'neutral',
}

function formatFcfa(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'
}

function formatDateFr(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function TradesPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [reasonFilter, setReasonFilter] = useState<TradeReason | ''>('')

  const t = useListQuery<Trade>({
    resource: 'trades',
    path: '/api/trades',
    filters: { reason: reasonFilter || undefined },
    pageSize: 50,
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/trades/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Trade supprimé')
      qc.invalidateQueries({ queryKey: ['trades'] })
    },
    onError: (err) =>
      toast.error('Suppression refusée', {
        description: (err as Error).message,
      }),
  })

  const columns: Column<Trade>[] = [
    {
      key: 'executed_at',
      header: 'Date',
      width: 'w-32',
      cell: (r) => (
        <span className="text-[var(--color-fg-muted)]">{formatDateFr(r.executed_at)}</span>
      ),
    },
    {
      key: 'ticker',
      header: 'Ticker',
      width: 'w-24',
      mono: true,
      cell: (r) => (
        <span className="font-semibold text-[var(--color-navy)]">{r.ticker}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: 'w-24',
      cell: (r) =>
        r.action === 'buy' ? (
          <Badge tone="success">
            <TrendingUp size={10} /> Achat
          </Badge>
        ) : (
          <Badge tone="danger">
            <TrendingDown size={10} /> Vente
          </Badge>
        ),
    },
    {
      key: 'quantity',
      header: 'Qté',
      width: 'w-20',
      align: 'right',
      cell: (r) => <span className="font-mono">{r.quantity}</span>,
    },
    {
      key: 'unit_price',
      header: 'Prix unit.',
      width: 'w-32',
      align: 'right',
      cell: (r) => <span className="font-mono">{formatFcfa(r.unit_price)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      width: 'w-36',
      align: 'right',
      cell: (r) => (
        <span className="font-mono font-semibold">
          {formatFcfa(r.quantity * r.unit_price)}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Raison',
      width: 'w-28',
      cell: (r) => <Badge tone={REASON_TONES[r.reason as TradeReason]}>{REASON_LABELS[r.reason as TradeReason]}</Badge>,
    },
    {
      key: 'brief_id',
      header: 'Brief',
      width: 'w-20',
      hideOnMobile: true,
      cell: (r) =>
        r.brief_id != null ? (
          <span className="font-mono text-xs">#{r.brief_id}</span>
        ) : (
          <span className="text-[var(--color-fg-subtle)]">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: 'w-16',
      align: 'right',
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={remove.isPending}
          onClick={async (e) => {
            e.stopPropagation()
            const ok = await confirm({
              title: 'Supprimer ce trade ?',
              description: (
                <>
                  Saisie du <span className="font-mono">{r.ticker}</span> du{' '}
                  {formatDateFr(r.executed_at)} sera perdue. À n'utiliser qu'en
                  cas d'erreur de saisie (pas pour un trade annulé — garder la trace).
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
          <Trash2 size={14} />
        </Button>
      ),
    },
  ]

  const filters: { value: TradeReason | ''; label: string }[] = [
    { value: '', label: 'Toutes' },
    { value: 'brief', label: 'Brief' },
    { value: 'intuition', label: 'Intuition' },
    { value: 'news', label: 'News' },
    { value: 'other', label: 'Autre' },
  ]

  return (
    <>
      <PageHeader
        title="Trades"
        subtitle="Journal des ordres exécutés sur la BRVM. Log chaque trade pour le backtest des signaux."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => t.refetch()}
            disabled={t.fetching}
          >
            <RefreshCw size={14} className={t.fetching ? 'animate-spin' : ''} />
            Rafraîchir
          </Button>
        }
      />
      <PageContent>
        <AddTradeForm onCreated={() => qc.invalidateQueries({ queryKey: ['trades'] })} />

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[var(--color-fg-muted)] font-medium">Raison :</span>
          <div className="flex gap-1 rounded-md bg-[var(--color-muted)] p-0.5">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setReasonFilter(f.value)}
                className={
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ' +
                  (reasonFilter === f.value
                    ? 'bg-[var(--color-surface)] text-[var(--color-navy)] shadow-sm font-semibold'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
                }
              >
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
          searchPlaceholder="Rechercher par ticker…"
          emptyMessage="Aucun trade. Log ton 1er après ton prochain ordre broker."
          {...t.tableProps}
        />
      </PageContent>
    </>
  )
}

interface AddFormProps {
  onCreated: () => void
}

function AddTradeForm({ onCreated }: AddFormProps) {
  const [ticker, setTicker] = useState('')
  const [action, setAction] = useState<TradeAction>('buy')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [reason, setReason] = useState<TradeReason>('brief')
  const [briefId, setBriefId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Trade>('/api/trades', {
        method: 'POST',
        body: {
          ticker: ticker.trim().toUpperCase(),
          action,
          quantity: parseInt(quantity, 10),
          unit_price: parseFloat(unitPrice),
          reason,
          brief_id: briefId.trim() ? parseInt(briefId, 10) : null,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: (created) => {
      toast.success('Trade enregistré', {
        description: `${created.action === 'buy' ? 'Achat' : 'Vente'} ${created.quantity} ${created.ticker}`,
      })
      setTicker('')
      setQuantity('')
      setUnitPrice('')
      setBriefId('')
      setNotes('')
      setError(null)
      onCreated()
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : String(err)
      setError(msg)
      toast.error('Saisie refusée', { description: msg })
    },
  })

  const qty = parseInt(quantity, 10)
  const px = parseFloat(unitPrice)
  const total = Number.isFinite(qty) && Number.isFinite(px) && qty > 0 && px > 0
    ? qty * px
    : null

  const canSubmit =
    ticker.trim().length >= 2 &&
    Number.isFinite(qty) && qty > 0 &&
    Number.isFinite(px) && px > 0 &&
    !create.isPending

  return (
    <Card>
      <CardBody>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) create.mutate()
          }}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-none w-24">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                Action
              </span>
              <Select value={action} onValueChange={(v) => setAction(v as TradeAction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Achat</SelectItem>
                  <SelectItem value="sell">Vente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex-none w-28">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                Ticker
              </span>
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="SNTS"
                className="font-mono uppercase"
                maxLength={16}
              />
            </label>
            <label className="flex-none w-24">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                Quantité
              </span>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
                className="font-mono"
              />
            </label>
            <label className="flex-none w-32">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                Prix unit. (FCFA)
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="14250"
                className="font-mono"
              />
            </label>
            <div className="flex-none w-52">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                Raison
              </span>
              <Select value={reason} onValueChange={(v) => setReason(v as TradeReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brief">Brief brvm-agent</SelectItem>
                  <SelectItem value="intuition">Intuition</SelectItem>
                  <SelectItem value="news">News externe</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reason === 'brief' && (
              <label className="flex-none w-24">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  Brief #
                </span>
                <Input
                  type="number"
                  min="1"
                  value={briefId}
                  onChange={(e) => setBriefId(e.target.value)}
                  placeholder="42"
                  className="font-mono"
                />
              </label>
            )}
            <Button type="submit" variant="accent" disabled={!canSubmit}>
              <Plus size={14} />
              Ajouter
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-[240px]">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                Notes (optionnel)
              </span>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Suivi signal conviction 4, horizon court terme"
              />
            </label>
            {total !== null && (
              <div className="text-xs text-[var(--color-fg-muted)] pb-2">
                Total :{' '}
                <span className="font-mono font-semibold text-[var(--color-fg)]">
                  {formatFcfa(total)}
                </span>
              </div>
            )}
          </div>
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
