import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useListQuery } from '@/lib/useListQuery'
import type { BriefSummary, BriefType, DeliveryStatus } from '@/lib/types'

function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  const map: Record<DeliveryStatus, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    delivered:    { tone: 'success', label: 'Livré' },
    partial:      { tone: 'warning', label: 'Partiel' },
    failed:       { tone: 'danger',  label: 'Échec' },
    pending:      { tone: 'neutral', label: 'En attente' },
    failed_synth: { tone: 'danger',  label: 'Synthèse KO' },
  }
  const { tone, label } = map[status]
  return <Badge tone={tone}>{label}</Badge>
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  const time = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  })
  return `${date} · ${time}`
}

const columns: Column<BriefSummary>[] = [
  {
    key: 'id',
    header: '#',
    width: 'w-16',
    mono: true,
    cell: (b) => b.id,
  },
  {
    key: 'type',
    header: 'Type',
    width: 'w-28',
    cell: (b) =>
      b.brief_type === 'weekly' ? (
        <Badge tone="navy" size="sm">Hebdo</Badge>
      ) : (
        <Badge tone="neutral" size="sm">Daily</Badge>
      ),
  },
  {
    key: 'date',
    header: 'Date',
    width: 'w-56',
    cell: (b) => (
      <span className="flex items-center gap-2">
        <span>{formatDateTime(b.brief_date)}</span>
        {b.revision > 1 && (
          <Badge tone="warning" size="sm">Rév. {b.revision}</Badge>
        )}
      </span>
    ),
  },
  {
    key: 'summary',
    header: 'Résumé',
    cell: (b) => (
      <span className="block truncate max-w-[60ch] text-[var(--color-fg)]">
        {b.summary_markdown || '—'}
      </span>
    ),
  },
  {
    key: 'signals',
    header: 'Signaux',
    width: 'w-20',
    align: 'right',
    mono: true,
    hideOnMobile: true,
    cell: (b) => (b.brief_type === 'weekly' ? '—' : b.signals_count),
  },
  {
    key: 'delivery',
    header: 'Livraison',
    width: 'w-28',
    cell: (b) => <DeliveryBadge status={b.delivery_status} />,
  },
  {
    key: 'actions',
    header: '',
    width: 'w-12',
    align: 'right',
    cell: (b) => (
      <a
        href={`/briefs/${b.id}`}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--color-muted)] text-[var(--color-fg-muted)]"
        aria-label="Ouvrir dans un nouvel onglet"
        title="Ouvrir dans un nouvel onglet"
      >
        <ExternalLink size={14} />
      </a>
    ),
  },
]

export function BriefsPage() {
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState<BriefType | ''>('')
  const t = useListQuery<BriefSummary>({
    resource: 'briefs',
    path: '/api/briefs',
    filters: { brief_type: typeFilter || undefined },
  })

  const typeButtons: { value: BriefType | ''; label: string }[] = [
    { value: '',       label: 'Tous' },
    { value: 'daily',  label: 'Daily' },
    { value: 'weekly', label: 'Hebdo' },
  ]

  return (
    <>
      <PageHeader
        title="Briefs"
        subtitle="Historique des briefs (daily + hebdo) et leur état de livraison."
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
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[var(--color-fg-muted)] font-medium">Type :</span>
          <div className="flex gap-1 rounded-md bg-[var(--color-muted)] p-0.5">
            {typeButtons.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ' +
                  (typeFilter === f.value
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
          rowKey={(b) => b.id}
          loading={t.loading}
          error={t.error as Error | null}
          onRowClick={(b) => navigate(`/briefs/${b.id}`)}
          searchPlaceholder="Rechercher dans le résumé…"
          emptyMessage="Aucun brief généré pour l'instant."
          {...t.tableProps}
        />
      </PageContent>
    </>
  )
}
