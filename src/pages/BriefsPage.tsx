import { ExternalLink, RefreshCw } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useListQuery } from '@/lib/useListQuery'
import type { BriefSummary, DeliveryStatus } from '@/lib/types'

function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  const map: Record<DeliveryStatus, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
    delivered: { tone: 'success', label: 'Livré' },
    partial:   { tone: 'warning', label: 'Partiel' },
    failed:    { tone: 'danger',  label: 'Échec' },
    pending:   { tone: 'neutral', label: 'En attente' },
  }
  const { tone, label } = map[status]
  return <Badge tone={tone}>{label}</Badge>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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
    key: 'date',
    header: 'Date',
    width: 'w-32',
    cell: (b) => formatDate(b.brief_date),
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
    cell: (b) => b.signals_count,
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
        href={`/preview/brief/${b.id}`}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--color-muted)] text-[var(--color-fg-muted)]"
        aria-label="Aperçu email"
        title="Aperçu email"
      >
        <ExternalLink size={14} />
      </a>
    ),
  },
]

export function BriefsPage() {
  const t = useListQuery<BriefSummary>({
    resource: 'briefs',
    path: '/api/briefs',
  })

  return (
    <>
      <PageHeader
        title="Briefs"
        subtitle="Historique des briefs quotidiens générés et leur état de livraison."
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
        <DataTable
          columns={columns}
          rows={t.data.items}
          rowKey={(b) => b.id}
          loading={t.loading}
          error={t.error as Error | null}
          searchPlaceholder="Rechercher dans le résumé…"
          emptyMessage="Aucun brief généré pour l'instant."
          {...t.tableProps}
        />
      </PageContent>
    </>
  )
}
