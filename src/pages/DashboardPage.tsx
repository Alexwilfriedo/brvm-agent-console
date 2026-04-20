import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Play, RefreshCw, CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { apiFetch } from '@/lib/api'
import type { BriefSummary, HealthResponse, PaginatedResponse, PipelineRun, ScheduleConfig } from '@/lib/types'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const now = Date.now()
  const t = new Date(iso).getTime()
  const diff = now - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return `il y a ${d} j`
}

function RunStatusBadge({ status }: { status: PipelineRun['status'] }) {
  switch (status) {
    case 'success':
      return <Badge tone="success"><CheckCircle2 size={11} /> Réussi</Badge>
    case 'failed':
      return <Badge tone="danger"><XCircle size={11} /> Échec</Badge>
    case 'running':
      return <Badge tone="gold"><Clock size={11} /> En cours</Badge>
    case 'skipped_locked':
      return <Badge tone="warning"><AlertTriangle size={11} /> Skippé (lock)</Badge>
  }
}

function DeliveryBadge({ status }: { status: BriefSummary['delivery_status'] }) {
  switch (status) {
    case 'delivered': return <Badge tone="success">Livré</Badge>
    case 'partial':   return <Badge tone="warning">Partiel</Badge>
    case 'failed':    return <Badge tone="danger">Échec livraison</Badge>
    case 'pending':   return <Badge tone="neutral">En attente</Badge>
  }
}

export function DashboardPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()

  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthResponse>('/health', { auth: false }),
    refetchInterval: 30_000,
  })

  const schedule = useQuery({
    queryKey: ['schedule'],
    queryFn: () => apiFetch<ScheduleConfig>('/api/schedule'),
    refetchInterval: 60_000,
  })

  const runs = useQuery({
    queryKey: ['runs', 'recent'],
    queryFn: () => apiFetch<PaginatedResponse<PipelineRun>>('/api/runs?limit=5'),
    refetchInterval: 30_000,
  })

  const briefs = useQuery({
    queryKey: ['briefs', 'recent'],
    queryFn: () => apiFetch<PaginatedResponse<BriefSummary>>('/api/briefs?limit=5'),
    refetchInterval: 60_000,
  })

  const recentRuns = runs.data?.items ?? []
  const recentBriefs = briefs.data?.items ?? []

  const triggerRun = useMutation({
    mutationFn: () => apiFetch('/api/schedule/run-now', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Pipeline déclenché', {
        description: "Le brief se génère en arrière-plan. Suivi dans l'onglet Exécutions.",
      })
      qc.invalidateQueries({ queryKey: ['runs'] })
      qc.invalidateQueries({ queryKey: ['briefs'] })
    },
    onError: (err) => {
      toast.error('Échec du déclenchement', { description: (err as Error).message })
    },
  })

  const lastRun = recentRuns[0]
  const failedRuns = recentRuns.filter((r) => r.status === 'failed').length

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble du pipeline BRVM Agent."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                qc.invalidateQueries()
              }}
              disabled={runs.isFetching}
            >
              <RefreshCw size={14} className={runs.isFetching ? 'animate-spin' : ''} />
              Rafraîchir
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Lancer un brief maintenant ?',
                  description:
                    "Cette action déclenche immédiatement le pipeline complet (collecte, enrichissement LLM, synthèse, envoi). Coût ≈ 0,80 $ en crédits Anthropic.",
                  confirmLabel: 'Lancer',
                  tone: 'primary',
                })
                if (ok) triggerRun.mutate()
              }}
              disabled={triggerRun.isPending}
            >
              <Play size={14} />
              {triggerRun.isPending ? 'Démarrage…' : 'Lancer un brief maintenant'}
            </Button>
          </>
        }
      />

      <PageContent>
        {/* Stats quick-glance */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Service"
            value={health.data?.status === 'ok' ? 'En ligne' : 'Indisponible'}
            tone={health.data?.status === 'ok' ? 'success' : 'danger'}
            hint={health.data?.scheduler_running ? 'Scheduler actif' : 'Scheduler arrêté'}
          />
          <StatCard
            label="Prochain brief"
            value={health.data?.next_run ? formatDateTime(health.data.next_run) : '—'}
            hint={schedule.data ? `Cron : ${schedule.data.cron_expression}` : ''}
          />
          <StatCard
            label="Dernier run"
            value={lastRun ? formatRelative(lastRun.started_at) : 'Aucun'}
            hint={lastRun ? `#${lastRun.id} · ${lastRun.trigger}` : ''}
          />
          <StatCard
            label="Runs échoués (5 derniers)"
            value={String(failedRuns)}
            tone={failedRuns > 0 ? 'warning' : 'neutral'}
            hint={failedRuns === 0 ? 'Rien à signaler' : 'À investiguer'}
          />
        </div>

        {/* Last runs + last briefs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Derniers runs</CardTitle>
              <a
                href="/runs"
                className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-navy)]"
              >
                Voir tous →
              </a>
            </CardHeader>
            <CardBody className="p-0">
              {runs.isLoading ? (
                <Placeholder>Chargement…</Placeholder>
              ) : recentRuns.length > 0 ? (
                <ul className="divide-y divide-[var(--color-border)]">
                  {recentRuns.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-[var(--color-fg-muted)]">#{r.id}</span>
                          <RunStatusBadge status={r.status} />
                          <Badge tone="neutral">{r.trigger}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-fg-subtle)]">
                          {formatDateTime(r.started_at)}
                          {r.error && <span className="ml-2 text-[var(--color-danger)]">· erreur</span>}
                        </div>
                      </div>
                      <div className="text-right text-xs text-[var(--color-fg-muted)]">
                        {r.brief_id ? (
                          <a href={`/briefs/${r.brief_id}`} className="hover:underline">Brief #{r.brief_id}</a>
                        ) : '—'}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Placeholder>Aucun run encore.</Placeholder>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Derniers briefs</CardTitle>
              <a
                href="/briefs"
                className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-navy)]"
              >
                Voir tous →
              </a>
            </CardHeader>
            <CardBody className="p-0">
              {briefs.isLoading ? (
                <Placeholder>Chargement…</Placeholder>
              ) : recentBriefs.length > 0 ? (
                <ul className="divide-y divide-[var(--color-border)]">
                  {recentBriefs.slice(0, 5).map((b) => (
                    <li key={b.id} className="flex items-center justify-between px-5 py-3 gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-[var(--color-fg-muted)]">#{b.id}</span>
                          <DeliveryBadge status={b.delivery_status} />
                          <span className="text-[var(--color-fg-subtle)] text-xs">
                            {b.signals_count} signaux
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-fg-subtle)] truncate max-w-[40ch]">
                          {formatDateTime(b.brief_date)} · {b.summary_markdown.slice(0, 80) || '—'}
                        </div>
                      </div>
                      <a
                        href={`/preview/brief/${b.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-navy)] whitespace-nowrap"
                      >
                        Aperçu ↗
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <Placeholder>Aucun brief généré encore.</Placeholder>
              )}
            </CardBody>
          </Card>
        </div>
      </PageContent>
    </>
  )
}

interface StatProps {
  label: string
  value: string
  hint?: string
  tone?: 'success' | 'warning' | 'danger' | 'neutral'
}

function StatCard({ label, value, hint, tone = 'neutral' }: StatProps) {
  const accent =
    tone === 'success' ? 'text-[var(--color-success)]'
    : tone === 'warning' ? 'text-[var(--color-warning)]'
    : tone === 'danger' ? 'text-[var(--color-danger)]'
    : 'text-[var(--color-navy)]'
  return (
    <Card>
      <CardBody>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          {label}
        </div>
        <div className={`mt-2 text-xl font-semibold ${accent}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-[var(--color-fg-subtle)]">{hint}</div>}
      </CardBody>
    </Card>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-8 text-center text-sm text-[var(--color-fg-subtle)]">{children}</div>
}
