import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sparkles, TrendingUp, TrendingDown, CircleSlash2, RefreshCw, History,
  AlertTriangle, CheckCircle2, Info,
} from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/Select'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/cn'
import type {
  InvestmentAnalysis,
  InvestmentHorizon,
  InvestmentRecommendation,
  PaginatedResponse,
  InvestmentAnalysisSummary,
} from '@/lib/types'

// --- Labels & helpers -------------------------------------------------------

const HORIZON_LABELS: Record<InvestmentHorizon, string> = {
  short: 'Court terme (3-15j)',
  medium: 'Moyen terme (16-90j)',
  long: 'Long terme (91-365j)',
}

const RECO_META: Record<InvestmentRecommendation, {
  label: string
  tone: 'success' | 'danger' | 'neutral'
  Icon: typeof TrendingUp
}> = {
  buy: { label: 'Acheter', tone: 'success', Icon: TrendingUp },
  hold: { label: 'Conserver', tone: 'neutral', Icon: CircleSlash2 },
  avoid: { label: 'Éviter', tone: 'danger', Icon: TrendingDown },
}

const DATA_QUALITY_LABELS: Record<string, string> = {
  ok: 'Données complètes',
  sparse_history: 'Historique court (< 20 séances)',
  no_news: 'Aucune actualité récente',
  stale_quotes: 'Cotation périmée (> 7 jours)',
  partial: 'Données partielles',
}

function fmtFcfa(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(v))} FCFA`
}

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}%`
}

function fmtConfidence(c: number): string {
  return `${Math.round(c * 100)}%`
}

function confidenceTone(c: number): 'success' | 'warning' | 'danger' {
  if (c >= 0.65) return 'success'
  if (c >= 0.40) return 'warning'
  return 'danger'
}

function confidenceBarColor(c: number): string {
  if (c >= 0.65) return 'bg-[var(--color-success)]'
  if (c >= 0.40) return 'bg-[var(--color-warning)]'
  return 'bg-[var(--color-danger)]'
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// --- Query keys -------------------------------------------------------------

const analysisKeys = {
  all: ['investment-analyses'] as const,
  list: (params: Record<string, string | number | undefined>) =>
    ['investment-analyses', 'list', params] as const,
  byTicker: (ticker: string) =>
    ['investment-analyses', 'list', { ticker }] as const,
}

// --- Component --------------------------------------------------------------

interface Props {
  ticker: string
}

export function InvestmentAnalysisPanel({ ticker }: Props) {
  const qc = useQueryClient()
  const [horizon, setHorizon] = useState<InvestmentHorizon>('medium')

  // Dernières analyses pour ce ticker (tous horizons — utile pour voir les
  // avis précédents même si on teste plusieurs horizons).
  const history = useQuery({
    queryKey: analysisKeys.byTicker(ticker),
    queryFn: () =>
      apiFetch<PaginatedResponse<InvestmentAnalysisSummary>>(
        `/api/investment-analyses?ticker=${ticker}&limit=5`,
      ),
    enabled: Boolean(ticker),
  })

  const create = useMutation({
    mutationFn: () =>
      apiFetch<InvestmentAnalysis>('/api/investment-analyses', {
        method: 'POST',
        body: { ticker, horizon },
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: analysisKeys.all })
      if (data.from_cache) {
        toast.info('Analyse récente réutilisée', {
          description: 'Une analyse < 15 min existait déjà pour ce ticker et cet horizon.',
        })
      } else {
        toast.success('Analyse générée', {
          description: `${RECO_META[data.recommendation].label} · confiance ${fmtConfidence(data.confidence)}`,
        })
      }
    },
    onError: (err) =>
      toast.error('Analyse impossible', {
        description: (err as Error).message,
      }),
  })

  const latest = create.data ?? history.data?.items?.[0]
  const fullResult = create.data

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={12} className="text-[var(--color-gold)]" />
          Faut-il investir ?
        </CardTitle>
        <span className="text-[10px] text-[var(--color-fg-subtle)]">
          Opus · analyse à la demande
        </span>
      </CardHeader>

      <CardBody className="pt-0 space-y-4">
        {/* Contrôles */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
              Horizon d'investissement
            </label>
            <Select
              value={horizon}
              onValueChange={(v) => setHorizon(v as InvestmentHorizon)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(HORIZON_LABELS) as InvestmentHorizon[]).map((h) => (
                  <SelectItem key={h} value={h}>
                    {HORIZON_LABELS[h]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="whitespace-nowrap"
          >
            {create.isPending ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Analyse en cours…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Lancer l'analyse
              </>
            )}
          </Button>
        </div>

        {create.isPending && (
          <div className="text-xs text-[var(--color-fg-subtle)] italic">
            Opus examine les données (5 à 20 secondes)…
          </div>
        )}

        {/* Résultat principal (mutation réussie OU dernière analyse historique) */}
        {latest && !create.isPending && (
          <AnalysisResult
            summary={latest}
            full={fullResult && fullResult.id === latest.id ? fullResult : undefined}
          />
        )}

        {/* Historique */}
        <HistoryList
          items={history.data?.items ?? []}
          currentId={latest?.id}
          loading={history.isLoading}
        />
      </CardBody>
    </Card>
  )
}

// --- Result block -----------------------------------------------------------

function AnalysisResult({
  summary,
  full,
}: {
  summary: InvestmentAnalysisSummary | InvestmentAnalysis
  full: InvestmentAnalysis | undefined
}) {
  const reco = summary.recommendation
  const meta = RECO_META[reco]
  const { Icon } = meta
  const gainPct =
    summary.price_target && summary.price_at_analysis
      ? ((summary.price_target - summary.price_at_analysis) / summary.price_at_analysis) * 100
      : null

  const payload = full?.payload
  const isError = payload?._error === true

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 space-y-4">
      {/* Reco + confiance + prix */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center justify-center w-12 h-12 rounded-full',
            reco === 'buy' && 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
            reco === 'avoid' && 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
            reco === 'hold' && 'bg-[var(--color-muted)] text-[var(--color-fg-muted)]',
          )}>
            <Icon size={22} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-[var(--color-fg)]">
                {meta.label}
              </span>
              <Badge tone={meta.tone}>
                {HORIZON_LABELS[summary.horizon]}
              </Badge>
              {summary.from_cache && (
                <Badge tone="neutral" title="Analyse récente réutilisée (cache 15 min)">
                  <History size={10} /> cache
                </Badge>
              )}
            </div>
            <div className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
              Générée {formatRelative(summary.requested_at)}
            </div>
          </div>
        </div>

        {/* Gauge de confiance */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Confiance
            </span>
            <span className={cn(
              'text-sm font-semibold font-mono',
              `text-[var(--color-${confidenceTone(summary.confidence)})]`,
            )}>
              {fmtConfidence(summary.confidence)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--color-muted)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', confidenceBarColor(summary.confidence))}
              style={{ width: `${Math.max(5, summary.confidence * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Prix d'entrée / target / gain */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <PriceTile label="Prix d'analyse" value={fmtFcfa(summary.price_at_analysis)} />
        <PriceTile label="Prix cible" value={fmtFcfa(summary.price_target)} />
        <PriceTile
          label="Gain potentiel"
          value={gainPct !== null ? fmtPct(gainPct) : '—'}
          accent={gainPct !== null && gainPct > 0 ? 'up' : gainPct !== null && gainPct < 0 ? 'down' : 'neutral'}
        />
        <PriceTile
          label="Stop-loss"
          value={full?.stop_loss ? fmtFcfa(full.stop_loss) : '—'}
          accent="neutral"
        />
      </div>

      {/* Détails (uniquement quand on a le payload complet = mutation toute fraîche) */}
      {full && !isError && (
        <DetailsBlock full={full} />
      )}

      {/* Cas erreur Opus */}
      {isError && (
        <div className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-[var(--color-danger)] flex-none mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-[var(--color-danger)]">Analyse dégradée</div>
            <div className="text-[var(--color-fg-muted)] mt-0.5">
              {payload?._error_reason ?? 'Le modèle n\'a pas pu produire une analyse exploitable.'}
            </div>
          </div>
        </div>
      )}

      {/* CTA voir détail quand on n'a que le summary */}
      {!full && (
        <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
          <span className="text-[11px] text-[var(--color-fg-subtle)]">
            Lance l'analyse pour voir le raisonnement complet.
          </span>
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---------------------------------------------------------

function PriceTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="px-3 py-2 border border-[var(--color-border)] rounded-md bg-[var(--color-surface)]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className={cn(
        'mt-0.5 font-mono text-sm font-semibold tabular-nums',
        accent === 'up' && 'text-[var(--color-success)]',
        accent === 'down' && 'text-[var(--color-danger)]',
        (!accent || accent === 'neutral') && 'text-[var(--color-fg)]',
      )}>
        {value}
      </div>
    </div>
  )
}

function DetailsBlock({ full }: { full: InvestmentAnalysis }) {
  const p = full.payload
  const hasContent = Boolean(
    (p.rationale && p.rationale.length) ||
    (p.risks && p.risks.length) ||
    (p.catalysts && p.catalysts.length) ||
    p.invalidation,
  )
  if (!hasContent) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {p.rationale && p.rationale.length > 0 && (
        <DetailList
          icon={<CheckCircle2 size={12} className="text-[var(--color-success)]" />}
          title="Raisonnement"
          items={p.rationale}
        />
      )}
      {p.risks && p.risks.length > 0 && (
        <DetailList
          icon={<AlertTriangle size={12} className="text-[var(--color-warning)]" />}
          title="Risques"
          items={p.risks}
        />
      )}
      {p.catalysts && p.catalysts.length > 0 && (
        <DetailList
          icon={<Info size={12} className="text-[var(--color-navy)]" />}
          title="Catalyseurs"
          items={p.catalysts}
        />
      )}
      {p.invalidation && (
        <DetailList
          icon={<CircleSlash2 size={12} className="text-[var(--color-fg-muted)]" />}
          title="Invalidation"
          items={[p.invalidation]}
        />
      )}
      {p.data_quality_note && p.data_quality_note !== 'ok' && (
        <div className="md:col-span-2 rounded-md border border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)]/50 p-2.5 text-xs flex items-center gap-2">
          <Info size={12} className="text-[var(--color-warning)]" />
          <span className="text-[var(--color-fg-muted)]">
            {DATA_QUALITY_LABELS[p.data_quality_note] ?? p.data_quality_note}
          </span>
        </div>
      )}
    </div>
  )
}

function DetailList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode
  title: string
  items: string[]
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
        {icon}
        <span>{title}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-xs text-[var(--color-fg)] leading-relaxed pl-3 relative">
            <span className="absolute left-0 top-1.5 w-1 h-1 rounded-full bg-[var(--color-fg-subtle)]" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}

function HistoryList({
  items,
  currentId,
  loading,
}: {
  items: InvestmentAnalysisSummary[]
  currentId?: number
  loading: boolean
}) {
  const older = items.filter((it) => it.id !== currentId).slice(0, 3)

  if (loading && items.length === 0) {
    return (
      <div className="text-[11px] text-[var(--color-fg-subtle)] italic">
        Chargement de l'historique…
      </div>
    )
  }
  if (older.length === 0) return null

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5 flex items-center gap-1.5">
        <History size={10} />
        Historique récent
      </div>
      <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-md">
        {older.map((it) => (
          <HistoryRow key={it.id} item={it} />
        ))}
      </ul>
    </div>
  )
}

function HistoryRow({ item }: { item: InvestmentAnalysisSummary }) {
  const meta = RECO_META[item.recommendation]
  const { Icon } = meta
  return (
    <li className="px-3 py-2 flex items-center gap-3 text-xs bg-[var(--color-surface)]">
      <Icon
        size={14}
        className={cn(
          meta.tone === 'success' && 'text-[var(--color-success)]',
          meta.tone === 'danger' && 'text-[var(--color-danger)]',
          meta.tone === 'neutral' && 'text-[var(--color-fg-muted)]',
        )}
      />
      <span className="font-medium text-[var(--color-fg)]">{meta.label}</span>
      <Badge tone="neutral" size="sm">
        {HORIZON_LABELS[item.horizon]}
      </Badge>
      <span className="font-mono text-[var(--color-fg-muted)]">
        {fmtConfidence(item.confidence)}
      </span>
      <span className="ml-auto text-[var(--color-fg-subtle)]">
        {formatRelative(item.requested_at)}
      </span>
    </li>
  )
}
