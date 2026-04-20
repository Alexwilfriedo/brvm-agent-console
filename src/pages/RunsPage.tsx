import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useListQuery } from '@/lib/useListQuery'
import type { PipelineRun, RunStatus, RunTrigger } from '@/lib/types'

function StatusBadge({ status }: { status: RunStatus }) {
  switch (status) {
    case 'success':        return <Badge tone="success"><CheckCircle2 size={10} /> Réussi</Badge>
    case 'failed':         return <Badge tone="danger"><XCircle size={10} /> Échec</Badge>
    case 'running':        return <Badge tone="gold"><Clock size={10} /> En cours</Badge>
    case 'skipped_locked': return <Badge tone="warning"><AlertTriangle size={10} /> Skippé</Badge>
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return '<1s'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const min = Math.floor(ms / 60_000)
  const sec = Math.round((ms % 60_000) / 1000)
  return `${min}m${sec.toString().padStart(2, '0')}`
}

const STATUS_FILTERS: { value: RunStatus | ''; label: string }[] = [
  { value: '',                label: 'Tous' },
  { value: 'success',         label: 'Réussis' },
  { value: 'failed',          label: 'Échecs' },
  { value: 'running',         label: 'En cours' },
  { value: 'skipped_locked',  label: 'Skippés' },
]

const TRIGGER_FILTERS: { value: RunTrigger | ''; label: string }[] = [
  { value: '',       label: 'Tous' },
  { value: 'cron',   label: 'Cron' },
  { value: 'manual', label: 'Manuel' },
]

const columns: Column<PipelineRun>[] = [
  {
    key: 'id',
    header: '#',
    width: 'w-16',
    mono: true,
    cell: (r) => r.id,
  },
  {
    key: 'status',
    header: 'Statut',
    width: 'w-32',
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: 'trigger',
    header: 'Trigger',
    width: 'w-24',
    hideOnMobile: true,
    cell: (r) => (
      <Badge tone="neutral">
        {r.trigger === 'cron' ? 'Cron' : 'Manuel'}
      </Badge>
    ),
  },
  {
    key: 'started',
    header: 'Démarré',
    width: 'w-32',
    hideOnMobile: true,
    cell: (r) => formatDateTime(r.started_at),
  },
  {
    key: 'duration',
    header: 'Durée',
    width: 'w-20',
    mono: true,
    align: 'right',
    hideOnMobile: true,
    cell: (r) => formatDuration(r.started_at, r.ended_at),
  },
  {
    key: 'brief',
    header: 'Brief',
    width: 'w-20',
    align: 'right',
    cell: (r) =>
      r.brief_id ? (
        <a
          href={`/briefs/${r.brief_id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-navy)] hover:underline"
        >
          #{r.brief_id}
        </a>
      ) : (
        <span className="text-[var(--color-fg-subtle)]">—</span>
      ),
  },
  {
    key: 'error',
    header: 'Erreur',
    cell: (r) =>
      r.error ? (
        <span
          className="block truncate max-w-[40ch] text-[var(--color-danger)] text-xs font-mono"
          title={r.error}
        >
          {r.error.split('\n')[0]}
        </span>
      ) : (
        <span className="text-[var(--color-fg-subtle)]">—</span>
      ),
  },
]

export function RunsPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<RunStatus | ''>('')
  const [trigger, setTrigger] = useState<RunTrigger | ''>('')

  const t = useListQuery<PipelineRun>({
    resource: 'runs',
    path: '/api/runs',
    filters: {
      status: status || undefined,
      trigger: trigger || undefined,
    },
    // Auto-refresh 30s tant qu'il y a un run "running"
    refetchInterval: 30_000,
  })

  return (
    <>
      <PageHeader
        title="Exécutions"
        subtitle="Historique complet du pipeline (cron + déclenchements manuels)."
        actions={
          <Button variant="outline" size="sm" onClick={() => t.refetch()} disabled={t.fetching}>
            <RefreshCw size={14} className={t.fetching ? 'animate-spin' : ''} />
            Rafraîchir
          </Button>
        }
      />
      <PageContent>
        <div className="flex flex-wrap items-center gap-3">
          <FilterPill label="Statut" value={status} onChange={setStatus} options={STATUS_FILTERS} />
          <FilterPill label="Trigger" value={trigger} onChange={setTrigger} options={TRIGGER_FILTERS} />
        </div>

        <DataTable
          columns={columns}
          rows={t.data.items}
          rowKey={(r) => r.id}
          loading={t.loading}
          error={t.error as Error | null}
          searchPlaceholder="Rechercher statut/trigger/erreur…"
          emptyMessage="Aucun run pour ces filtres."
          onRowClick={(r) => navigate(`/runs/${r.id}`)}
          {...t.tableProps}
        />
      </PageContent>
    </>
  )
}

interface FilterPillProps<V extends string> {
  label: string
  value: V | ''
  onChange: (v: V | '') => void
  options: { value: V | ''; label: string }[]
}

function FilterPill<V extends string>({ label, value, onChange, options }: FilterPillProps<V>) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-[var(--color-fg-muted)] font-medium">{label} :</span>
      <div className="flex gap-1 rounded-md bg-[var(--color-muted)] p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={
              'px-2.5 py-1 rounded text-xs transition-colors ' +
              (value === o.value
                ? 'bg-[var(--color-surface)] text-[var(--color-navy)] shadow-sm font-semibold'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
