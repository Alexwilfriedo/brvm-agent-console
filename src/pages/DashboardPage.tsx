import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Play, RefreshCw, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, XCircle, Clock, FileText, Sparkles, ArrowRight,
  DollarSign, Activity, AlertCircle,
} from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sparkline } from '@/components/charts/Sparkline'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { BriefSummary, PaginatedResponse, PipelineRun, ScheduleConfig } from '@/lib/types'

// --- Types ---------------------------------------------------------------

interface PulseResponse {
  trading_date: string | null
  quotes_count?: number
  traded_count?: number
  total_value?: number
  variation_pct_weighted?: number
  top_sector?: { sector: string; avg_var_pct: number; total_value: number }
  bottom_sector?: { sector: string; avg_var_pct: number; total_value: number }
  top_mover?: { ticker: string; name: string; variation_pct: number; close_price: number; volume: number }
}

interface PulsePoint {
  date: string
  variation_pct_weighted: number
  total_value: number
  traded_count: number
}

interface ActivityStats {
  period_days: number
  briefs_count: number
  runs_count: number
  runs_failed_count: number
  news_enriched_count: number
  market_analyses_count: number
  estimated_cost_usd: number
}

interface SignalLite {
  ticker: string
  direction: string
  conviction: number
  thesis: string
  price_at_signal: number | null
}

interface BriefDetail {
  id: number
  brief_date: string
  summary_markdown: string
  payload: {
    opportunities?: Array<{
      ticker: string
      name?: string
      direction: string
      conviction: number
      thesis?: string
      time_horizon?: string
    }>
  }
  signals: SignalLite[]
  delivery_status: string
  revision: number
  revised_at: string | null
}

// --- Formatters ----------------------------------------------------------

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return `il y a ${d} j`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtValue(v: number | undefined | null): string {
  if (v === null || v === undefined) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} Md`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} k`
  return v.toFixed(0)
}

function fmtPct(v: number | undefined | null): string {
  if (v === null || v === undefined) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

// --- Small building blocks ----------------------------------------------

function SignColor({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined || v === 0) return null
  return v > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />
}

function signClass(v: number | null | undefined): string {
  if (v === null || v === undefined || v === 0) return 'text-[var(--color-fg-muted)]'
  return v > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
}

// --- Zone A — Pulse marché ------------------------------------------------

function PulseHero({ pulse, history }: { pulse?: PulseResponse; history?: PulsePoint[] }) {
  if (!pulse || !pulse.trading_date) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Aucune cotation BRVM en base.
          </p>
          <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
            Lance un run pour collecter les données du jour.
          </p>
        </CardBody>
      </Card>
    )
  }

  const sparkPoints = (history ?? []).map((p) => p.variation_pct_weighted)
  const variation = pulse.variation_pct_weighted ?? 0

  return (
    <Card>
      <CardBody className="px-6 py-5 md:px-8 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold tracking-[0.22em] text-[var(--color-gold)] uppercase">
              Séance BRVM
            </div>
            <div className="mt-0.5 text-sm text-[var(--color-fg-muted)] capitalize">
              {fmtDate(pulse.trading_date)}
            </div>

            <div className="mt-4 flex items-baseline gap-4 flex-wrap">
              <div className={cn('flex items-center gap-2', signClass(variation))}>
                <span className="font-mono text-4xl font-semibold tabular-nums">
                  {fmtPct(variation)}
                </span>
                <SignColor v={variation} />
              </div>
              <div className="text-xs text-[var(--color-fg-subtle)] font-medium">
                variation pondérée
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
              <div>
                <span className="text-[var(--color-fg-muted)]">Échangé </span>
                <span className="font-mono font-semibold text-[var(--color-fg)]">
                  {fmtValue(pulse.total_value)} FCFA
                </span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)]">Tickers cotés </span>
                <span className="font-mono font-semibold text-[var(--color-fg)]">
                  {pulse.traded_count}/{pulse.quotes_count}
                </span>
              </div>
            </div>
          </div>

          {sparkPoints.length >= 2 && (
            <div className="flex-none">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5 text-right">
                Variation 7j
              </div>
              <Sparkline points={sparkPoints} width={160} height={44} />
            </div>
          )}
        </div>

        {(pulse.top_sector || pulse.bottom_sector) && (
          <div className="mt-5 pt-4 border-t border-[var(--color-border)] grid grid-cols-1 md:grid-cols-3 gap-4">
            {pulse.top_sector && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Secteur leader</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-semibold text-[var(--color-fg)]">{pulse.top_sector.sector}</span>
                  <span className={cn('font-mono text-sm font-semibold', signClass(pulse.top_sector.avg_var_pct))}>
                    {fmtPct(pulse.top_sector.avg_var_pct)}
                  </span>
                </div>
              </div>
            )}
            {pulse.bottom_sector && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">En recul</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-semibold text-[var(--color-fg)]">{pulse.bottom_sector.sector}</span>
                  <span className={cn('font-mono text-sm font-semibold', signClass(pulse.bottom_sector.avg_var_pct))}>
                    {fmtPct(pulse.bottom_sector.avg_var_pct)}
                  </span>
                </div>
              </div>
            )}
            {pulse.top_mover && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Top hausse</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono font-semibold text-[var(--color-navy)]">{pulse.top_mover.ticker}</span>
                  <span className={cn('font-mono text-sm font-semibold', signClass(pulse.top_mover.variation_pct))}>
                    {fmtPct(pulse.top_mover.variation_pct)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// --- Zone B — Signal du jour ---------------------------------------------

function TopSignalCard({
  brief,
  onRegenerate,
  regenerating,
}: {
  brief: BriefDetail | null
  onRegenerate: () => void
  regenerating: boolean
}) {
  if (!brief) {
    // Pas de brief aujourd'hui → CTA "générer"
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <Sparkles size={24} className="mx-auto mb-3 text-[var(--color-gold)]" />
          <h3 className="text-lg font-semibold text-[var(--color-fg)]">
            Pas encore de brief pour aujourd'hui
          </h3>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Lance le pipeline pour collecter, enrichir et synthétiser le brief du jour.
          </p>
          <Button
            variant="accent"
            size="sm"
            className="mt-4"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            <Play size={14} />
            {regenerating ? 'Démarrage…' : 'Lancer le brief du jour'}
          </Button>
        </CardBody>
      </Card>
    )
  }

  // Trouve l'opportunité de plus haute conviction
  const opps = brief.payload?.opportunities ?? []
  const top = opps.length
    ? [...opps].sort((a, b) => (b.conviction ?? 0) - (a.conviction ?? 0))[0]
    : null

  const dirTone: Record<string, { label: string; bg: string; fg: string }> = {
    buy:    { label: 'BUY',    bg: 'bg-[var(--color-success-bg)]', fg: 'text-[var(--color-success)]' },
    watch:  { label: 'WATCH',  bg: 'bg-[var(--color-gold-50)]',    fg: 'text-[var(--color-gold-600)]' },
    hold:   { label: 'HOLD',   bg: 'bg-[var(--color-muted)]',      fg: 'text-[var(--color-fg-muted)]' },
    reduce: { label: 'REDUCE', bg: 'bg-[var(--color-warning-bg)]', fg: 'text-[var(--color-warning)]' },
    avoid:  { label: 'AVOID',  bg: 'bg-[var(--color-danger-bg)]',  fg: 'text-[var(--color-danger)]' },
  }

  return (
    <Card>
      <CardBody className="px-6 py-5 md:px-8 md:py-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.22em] text-[var(--color-gold)] uppercase">
              Signal du jour · Brief #{brief.id}
              {brief.revision > 1 && (
                <span className="ml-2 text-[var(--color-warning)]">· Rév. {brief.revision}</span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-fg-subtle)]">
              Livré {fmtTime(brief.brief_date)}
              {brief.revised_at && ` · Rév. à ${fmtTime(brief.revised_at)}`}
            </div>
          </div>
          <Link
            to={`/briefs/${brief.id}`}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-[var(--color-border)] text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors"
          >
            Lire le brief <ArrowRight size={14} />
          </Link>
        </div>

        {top ? (
          <>
            <div className="flex items-baseline gap-3 flex-wrap">
              {(() => {
                const tone = dirTone[top.direction] ?? dirTone.watch
                return (
                  <span className={cn('px-2.5 py-1 rounded text-[11px] font-bold tracking-wider', tone.bg, tone.fg)}>
                    {tone.label}
                  </span>
                )
              })()}
              <span className="font-mono text-2xl font-semibold text-[var(--color-navy)]">{top.ticker}</span>
              {top.name && <span className="text-sm text-[var(--color-fg-muted)]">· {top.name}</span>}
              <span className="ml-auto flex items-center gap-1 text-xs text-[var(--color-fg-muted)]">
                Conviction
                <span className="font-mono text-[var(--color-fg)]">
                  {'●'.repeat(top.conviction)}{'○'.repeat(5 - top.conviction)}
                </span>
              </span>
            </div>
            {top.thesis && (
              <p className="mt-3 text-sm text-[var(--color-fg)] leading-relaxed">
                {top.thesis}
              </p>
            )}
            {opps.length > 1 && (
              <div className="mt-3 text-xs text-[var(--color-fg-subtle)]">
                + {opps.length - 1} autre{opps.length > 2 ? 's' : ''} opportunité{opps.length > 2 ? 's' : ''} dans le brief
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--color-fg-muted)]">
            Le brief du jour ne contient aucune opportunité — marché probablement sans signal fort.
          </p>
        )}
      </CardBody>
    </Card>
  )
}

// --- Zone C — Status bar -------------------------------------------------

function StatusBar({
  schedule, stats,
  runsFailed,
}: {
  schedule?: ScheduleConfig
  stats?: ActivityStats
  runsFailed: number
}) {
  // `scheduler_running` vient de /api/schedule (admin-gated). On l'utilise
  // comme source of truth plutôt que /health qui est volontairement minimal
  // (pas d'info-leak public).
  const scheduler = schedule?.scheduler_running ?? false
  const next = schedule?.next_run
  const cost = stats?.estimated_cost_usd ?? 0

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border',
          scheduler
            ? 'border-[var(--color-success)]/30 bg-[var(--color-success-bg)] text-[var(--color-success)]'
            : 'border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
        )}
      >
        {scheduler ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
        <span className="font-medium">{scheduler ? 'Scheduler actif' : 'Scheduler arrêté'}</span>
        {scheduler && next && (
          <span className="text-[var(--color-fg-muted)] ml-1">· prochain {fmtTime(next)}</span>
        )}
      </div>

      {schedule && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-fg-muted)]">
          <Clock size={12} />
          <span className="font-mono">{schedule.cron_expression}</span>
        </div>
      )}

      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-fg-muted)]">
        <DollarSign size={12} />
        <span>
          <span className="font-mono font-semibold text-[var(--color-fg)]">${cost.toFixed(2)}</span>
          <span className="ml-1">/ {stats?.period_days ?? 7}j</span>
        </span>
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-fg-muted)]">
        <Activity size={12} />
        <span>
          <span className="font-mono font-semibold text-[var(--color-fg)]">
            {stats?.news_enriched_count ?? 0}
          </span>
          <span className="ml-1">articles enrichis</span>
        </span>
      </div>

      {runsFailed > 0 && (
        <Link
          to="/runs?status=failed"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]/80 transition-colors"
        >
          <AlertCircle size={12} />
          <span>
            <span className="font-mono font-semibold">{runsFailed}</span>
            <span className="ml-1">runs échoués</span>
          </span>
        </Link>
      )}
    </div>
  )
}

// --- Zone D — Activity timeline -----------------------------------------

interface TimelineItem {
  kind: 'run' | 'brief'
  id: number
  ts: string
  title: string
  status: string
  subtitle?: string
  href: string
}

function buildTimeline(runs: PipelineRun[], briefs: BriefSummary[]): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const r of runs) {
    let title: string
    if (r.status === 'success') title = `Run #${r.id} réussi`
    else if (r.status === 'failed') title = `Run #${r.id} échoué`
    else if (r.status === 'running') title = `Run #${r.id} en cours`
    else if (r.status === 'skipped_locked') title = `Run #${r.id} skippé (lock)`
    else if (r.status === 'already_generated') title = `Run #${r.id} skippé (brief déjà généré)`
    else title = `Run #${r.id} · ${r.status}`
    items.push({
      kind: 'run', id: r.id, ts: r.started_at, title, status: r.status,
      subtitle: r.error ? r.error.slice(0, 80) : r.trigger,
      href: `/runs/${r.id}`,
    })
  }
  for (const b of briefs) {
    const rev = b.revision > 1 ? ` (rév. ${b.revision})` : ''
    items.push({
      kind: 'brief', id: b.id, ts: b.brief_date,
      title: `Brief #${b.id}${rev} ${b.delivery_status === 'delivered' ? 'livré' : 'en attente'}`,
      status: b.delivery_status,
      subtitle: `${b.signals_count} signal${b.signals_count > 1 ? 'aux' : ''}`,
      href: `/briefs/${b.id}`,
    })
  }
  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  return items.slice(0, 10)
}

function TimelineIcon({ item }: { item: TimelineItem }) {
  if (item.kind === 'brief') {
    if (item.status === 'delivered') return <FileText size={14} className="text-[var(--color-success)]" />
    return <FileText size={14} className="text-[var(--color-fg-muted)]" />
  }
  if (item.status === 'success') return <CheckCircle2 size={14} className="text-[var(--color-success)]" />
  if (item.status === 'failed') return <XCircle size={14} className="text-[var(--color-danger)]" />
  if (item.status === 'running') return <Clock size={14} className="text-[var(--color-gold)] animate-pulse" />
  return <AlertTriangle size={14} className="text-[var(--color-warning)]" />
}

function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-[var(--color-fg-subtle)]">
          Aucune activité récente.
        </CardBody>
      </Card>
    )
  }
  return (
    <Card>
      <CardBody className="p-0">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-[var(--color-fg-muted)]">
            Activité récente
          </div>
          <Link to="/runs" className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-navy)]">
            Voir tout →
          </Link>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link
                to={item.href}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <TimelineIcon item={item} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--color-fg)]">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-[11px] text-[var(--color-fg-subtle)] truncate">{item.subtitle}</div>
                  )}
                </div>
                <div className="text-[11px] text-[var(--color-fg-subtle)] whitespace-nowrap">
                  {fmtRelative(item.ts)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}

// --- Main page -----------------------------------------------------------

export function DashboardPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const navigate = useNavigate()

  // /api/schedule porte l'info `scheduler_running` (plus fiable que /health
  // qui est volontairement minimal pour ne pas leak d'info publique).
  const schedule = useQuery({
    queryKey: ['schedule'],
    queryFn: () => apiFetch<ScheduleConfig>('/api/schedule'),
    refetchInterval: 30_000,
  })

  const pulse = useQuery({
    queryKey: ['market', 'pulse'],
    queryFn: () => apiFetch<PulseResponse>('/api/market/pulse'),
    refetchInterval: 60_000,
  })

  const pulseHistory = useQuery({
    queryKey: ['market', 'pulse', 'history'],
    queryFn: () => apiFetch<PulsePoint[]>('/api/market/pulse/history?days=7'),
  })

  const todayBrief = useQuery({
    queryKey: ['briefs', 'today'],
    queryFn: () => apiFetch<BriefDetail | null>('/api/briefs/today'),
    refetchInterval: 60_000,
  })

  const runs = useQuery({
    queryKey: ['runs', 'recent'],
    queryFn: () => apiFetch<PaginatedResponse<PipelineRun>>('/api/runs?limit=10'),
    refetchInterval: 30_000,
  })

  const briefs = useQuery({
    queryKey: ['briefs', 'recent'],
    queryFn: () => apiFetch<PaginatedResponse<BriefSummary>>('/api/briefs?limit=10'),
    refetchInterval: 60_000,
  })

  const stats = useQuery({
    queryKey: ['stats', 'activity', 7],
    queryFn: () => apiFetch<ActivityStats>('/api/stats/activity?days=7'),
  })

  const triggerRun = useMutation({
    mutationFn: (force: boolean) =>
      apiFetch(`/api/schedule/run-now${force ? '?force=true' : ''}`, { method: 'POST' }),
    onSuccess: (_, force) => {
      toast.success(force ? 'Régénération déclenchée' : 'Pipeline déclenché', {
        description: force
          ? "Création d'une nouvelle révision du brief du jour."
          : "Suivi dans l'onglet Exécutions.",
      })
      qc.invalidateQueries()
    },
    onError: (err) => toast.error('Échec du déclenchement', { description: (err as Error).message }),
  })

  const timelineItems = useMemo(
    () => buildTimeline(runs.data?.items ?? [], briefs.data?.items ?? []),
    [runs.data, briefs.data],
  )

  const hasTodayBrief = Boolean(todayBrief.data)
  const todayRevision = todayBrief.data?.revision ?? 0

  async function onLaunch() {
    if (hasTodayBrief) {
      const ok = await confirm({
        title: `Régénérer le brief du jour (révision ${todayRevision + 1}) ?`,
        description:
          `Un brief #${todayBrief.data!.id} (révision ${todayRevision}) existe déjà pour aujourd'hui. ` +
          `La régénération met à jour l'analyse textuelle et renvoie un email marqué "Révision ${todayRevision + 1}". ` +
          `Les signaux et prix de référence restent figés. Coût ≈ 0,80 $ Anthropic.`,
        confirmLabel: `Régénérer (rév. ${todayRevision + 1})`,
        tone: 'primary',
      })
      if (ok) triggerRun.mutate(true)
    } else {
      const ok = await confirm({
        title: 'Lancer le brief du jour ?',
        description: "Déclenche le pipeline complet (collecte, enrichissement, synthèse, envoi). Coût ≈ 0,80 $ Anthropic.",
        confirmLabel: 'Lancer',
        tone: 'primary',
      })
      if (ok) triggerRun.mutate(false)
    }
  }

  function onRestartScheduler() {
    // Le scheduler se relance via PATCH /api/schedule (hot-reload).
    // Ici on invalide + redirige vers la page Planification qui a le switch.
    navigate('/schedule')
  }

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
              onClick={() => qc.invalidateQueries()}
              disabled={runs.isFetching || pulse.isFetching}
            >
              <RefreshCw size={14} className={runs.isFetching ? 'animate-spin' : ''} />
              Rafraîchir
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={onLaunch}
              disabled={triggerRun.isPending}
            >
              <Play size={14} />
              {triggerRun.isPending
                ? 'Démarrage…'
                : hasTodayBrief
                  ? `Régénérer (rév. ${todayRevision + 1})`
                  : 'Lancer le brief du jour'}
            </Button>
          </>
        }
      />

      <PageContent>
        {/* Alerte scheduler si arrêté (source : /api/schedule, pas /health) */}
        {schedule.data && !schedule.data.scheduler_running && (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-2 text-[var(--color-danger)]">
              <AlertTriangle size={16} />
              <span className="font-medium">Scheduler arrêté</span>
              <span className="opacity-80">— aucun brief automatique ne partira.</span>
            </div>
            {/* Bouton contrasté sur fond danger : fond blanc + texte rouge,
                plus lisible que outline qui disparait sur le banner. */}
            <button
              type="button"
              onClick={onRestartScheduler}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold bg-white text-[var(--color-danger)] border border-[var(--color-danger)]/40 hover:bg-[var(--color-danger)] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Configurer <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Zone A — Pulse marché */}
        <PulseHero pulse={pulse.data} history={pulseHistory.data} />

        {/* Zone B — Signal du jour */}
        <TopSignalCard
          brief={todayBrief.data ?? null}
          onRegenerate={onLaunch}
          regenerating={triggerRun.isPending}
        />

        {/* Zone C — Status bar compacte */}
        <StatusBar
          schedule={schedule.data}
          stats={stats.data}
          runsFailed={stats.data?.runs_failed_count ?? 0}
        />

        {/* Zone D — Timeline unifiée */}
        <ActivityTimeline items={timelineItems} />
      </PageContent>
    </>
  )
}
