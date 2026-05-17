import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, TrendingUp, TrendingDown, CircleSlash2, History } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { useListQuery } from '@/lib/useListQuery'
import { cn } from '@/lib/cn'
import type {
  InvestmentAnalysisSummary,
  InvestmentHorizon,
  InvestmentRecommendation,
} from '@/lib/types'

const HORIZON_LABELS: Record<InvestmentHorizon, string> = {
  short: 'Court',
  medium: 'Moyen',
  long: 'Long',
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

function fmtFcfa(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(Math.round(v))
}

function fmtConfidence(c: number): string {
  return `${Math.round(c * 100)}%`
}

function confidenceColor(c: number): string {
  if (c >= 0.65) return 'text-[var(--color-success)]'
  if (c >= 0.40) return 'text-[var(--color-warning)]'
  return 'text-[var(--color-danger)]'
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `il y a ${diffD} j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AnalysesPage() {
  const navigate = useNavigate()
  const [ticker, setTicker] = useState('')
  const [horizon, setHorizon] = useState<InvestmentHorizon | ''>('')
  const [reco, setReco] = useState<InvestmentRecommendation | ''>('')

  const t = useListQuery<InvestmentAnalysisSummary>({
    resource: 'investment-analyses',
    path: '/api/investment-analyses',
    filters: {
      ticker: ticker.trim().toUpperCase() || undefined,
      horizon: horizon || undefined,
      recommendation: reco || undefined,
    },
    pageSize: 50,
  })

  const columns: Column<InvestmentAnalysisSummary>[] = [
    {
      key: 'requested_at',
      header: 'Date',
      width: 'w-40',
      cell: (r) => (
        <span className="text-[var(--color-fg-muted)]">{formatRelative(r.requested_at)}</span>
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
      key: 'horizon',
      header: 'Horizon',
      width: 'w-28',
      cell: (r) => <Badge tone="neutral">{HORIZON_LABELS[r.horizon]}</Badge>,
    },
    {
      key: 'recommendation',
      header: 'Recommandation',
      width: 'w-36',
      cell: (r) => {
        const meta = RECO_META[r.recommendation]
        const { Icon } = meta
        return (
          <Badge tone={meta.tone}>
            <Icon size={10} /> {meta.label}
          </Badge>
        )
      },
    },
    {
      key: 'confidence',
      header: 'Confiance',
      width: 'w-24',
      align: 'right',
      mono: true,
      cell: (r) => (
        <span className={cn('font-semibold', confidenceColor(r.confidence))}>
          {fmtConfidence(r.confidence)}
        </span>
      ),
    },
    {
      key: 'price_at_analysis',
      header: 'Prix',
      width: 'w-28',
      align: 'right',
      mono: true,
      cell: (r) => <span>{fmtFcfa(r.price_at_analysis)}</span>,
    },
    {
      key: 'price_target',
      header: 'Cible',
      width: 'w-28',
      align: 'right',
      mono: true,
      cell: (r) => {
        if (r.price_target === null) return <span className="text-[var(--color-fg-subtle)]">—</span>
        const gainPct = ((r.price_target - r.price_at_analysis) / r.price_at_analysis) * 100
        return (
          <div className="flex flex-col items-end leading-tight">
            <span>{fmtFcfa(r.price_target)}</span>
            <span className={cn(
              'text-[10px]',
              gainPct > 0 && 'text-[var(--color-success)]',
              gainPct < 0 && 'text-[var(--color-danger)]',
              gainPct === 0 && 'text-[var(--color-fg-subtle)]',
            )}>
              {gainPct > 0 ? '+' : ''}{gainPct.toFixed(1)}%
            </span>
          </div>
        )
      },
    },
    {
      key: 'from_cache',
      header: '',
      width: 'w-12',
      cell: (r) =>
        r.from_cache ? (
          <History size={12} className="text-[var(--color-fg-subtle)]" aria-label="Servie depuis le cache" />
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--color-gold)]" />
            Analyses d'investissement
          </span>
        }
        subtitle="Recommandations à la demande produites par Opus (une ligne par appel)."
      />

      <PageContent>
        <Card>
          <CardBody className="space-y-4">
            {/* Filtres */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  Ticker
                </label>
                <Input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="ex: SNTS"
                  className="uppercase"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  Horizon
                </label>
                <Select
                  value={horizon || 'all'}
                  onValueChange={(v) => setHorizon(v === 'all' ? '' : (v as InvestmentHorizon))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="short">Court (3-15j)</SelectItem>
                    <SelectItem value="medium">Moyen (16-90j)</SelectItem>
                    <SelectItem value="long">Long (91-365j)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  Recommandation
                </label>
                <Select
                  value={reco || 'all'}
                  onValueChange={(v) => setReco(v === 'all' ? '' : (v as InvestmentRecommendation))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="buy">Acheter</SelectItem>
                    <SelectItem value="hold">Conserver</SelectItem>
                    <SelectItem value="avoid">Éviter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="text-[11px] text-[var(--color-fg-subtle)]">
                  {t.data.total} résultat{t.data.total > 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <DataTable
              columns={columns}
              rows={t.data.items}
              rowKey={(r) => r.id}
              loading={t.loading}
              error={t.error as Error | null}
              emptyMessage="Aucune analyse pour l'instant. Lance une analyse depuis la fiche d'un ticker."
              onRowClick={(r) => navigate(`/market/${r.ticker}`)}
              {...t.tableProps}
            />
          </CardBody>
        </Card>
      </PageContent>
    </>
  )
}
