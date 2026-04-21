import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Power, RefreshCw, AlertTriangle } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useListQuery } from '@/lib/useListQuery'
import { apiFetch } from '@/lib/api'
import type { Source } from '@/lib/types'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TYPE_LABELS: Record<string, string> = {
  brvm_official: 'BRVM officiel',
  sika_finance: 'Sika Finance (RSS)',
  sika_quotes: 'Sika cotations',
  sika_communiques: 'Sika communiqués (PDF)',
  rss: 'RSS',
}

function formatType(t: string): string {
  return TYPE_LABELS[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function SourcesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const t = useListQuery<Source>({
    resource: 'sources',
    path: '/api/sources',
    pageSize: 100,
  })

  const toggle = useMutation({
    mutationFn: (src: Source) =>
      apiFetch<Source>(`/api/sources/${src.id}`, {
        method: 'PATCH',
        body: { enabled: !src.enabled },
      }),
    onSuccess: (updated) => {
      toast.success(
        updated.enabled ? `Source « ${updated.name} » activée` : `Source « ${updated.name} » désactivée`
      )
      qc.invalidateQueries({ queryKey: ['sources'] })
    },
    onError: (err) => toast.error('Échec', { description: (err as Error).message }),
  })

  const columns: Column<Source>[] = [
    {
      key: 'key',
      header: 'Clé',
      width: 'w-40',
      mono: true,
      cell: (s) => s.key,
    },
    {
      key: 'name',
      header: 'Nom',
      cell: (s) => s.name,
    },
    {
      key: 'type',
      header: 'Type',
      width: 'w-44',
      hideOnMobile: true,
      cell: (s) => <Badge tone="neutral">{formatType(s.type)}</Badge>,
    },
    {
      key: 'last',
      header: 'Dernière collecte',
      width: 'w-48',
      hideOnMobile: true,
      cell: (s) => (
        <div>
          <div className="text-xs text-[var(--color-fg)]">{formatDateTime(s.last_collected_at)}</div>
          {s.last_status === 'error' && s.last_error && (
            <Tooltip content={<span className="font-mono">{s.last_error}</span>}>
              <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[var(--color-danger)] max-w-[22ch] cursor-help">
                <AlertTriangle size={10} className="flex-none" />
                <span className="truncate">{s.last_error}</span>
              </div>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      key: 'enabled',
      header: 'État',
      width: 'w-24',
      cell: (s) =>
        s.enabled ? <Badge tone="success">Actif</Badge> : <Badge tone="neutral">Désactivé</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: 'w-36',
      align: 'right',
      cell: (s) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={toggle.isPending}
          onClick={async (e) => {
            e.stopPropagation()
            if (s.enabled) {
              const ok = await confirm({
                title: 'Désactiver cette source ?',
                description: (
                  <>
                    <span className="font-medium text-[var(--color-fg)]">{s.name}</span> ne sera
                    plus collectée lors des prochains runs jusqu'à réactivation.
                  </>
                ),
                confirmLabel: 'Désactiver',
                tone: 'danger',
              })
              if (!ok) return
            }
            toggle.mutate(s)
          }}
          aria-label={s.enabled ? 'Désactiver' : 'Activer'}
          title={s.enabled ? 'Désactiver' : 'Activer'}
        >
          <Power size={14} />
          {s.enabled ? 'Désactiver' : 'Activer'}
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Sources"
        subtitle="Sources de collecte — BRVM officiel, RSS, scrapers."
        actions={
          <Button variant="outline" size="sm" onClick={() => t.refetch()} disabled={t.fetching}>
            <RefreshCw size={14} className={t.fetching ? 'animate-spin' : ''} />
            Rafraîchir
          </Button>
        }
      />
      <PageContent>
        <DataTable
          columns={columns}
          rows={t.data.items}
          rowKey={(s) => s.id}
          loading={t.loading}
          error={t.error as Error | null}
          searchPlaceholder="Rechercher par clé ou nom…"
          emptyMessage="Aucune source configurée."
          onRowClick={(s) => navigate(`/sources/${s.id}`)}
          {...t.tableProps}
        />
      </PageContent>
    </>
  )
}
