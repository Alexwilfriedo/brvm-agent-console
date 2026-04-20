import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PriceChart } from '@/components/charts/PriceChart'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/cn'

// --- Types -----------------------------------------------------------------

interface SeriesPoint {
  date: string
  close: number
  volume: number
  variation_pct: number
  open: number | null
  high: number | null
  low: number | null
  previous_close: number | null
}

interface NewsItem {
  id: number
  title: string
  url: string
  source_key: string
  published_at: string | null
  summary: string | null
  sentiment: string | null
  materiality: number | null
  themes: string[]
}

interface TickerDetail {
  ticker: string
  name: string
  sector: string
  country: string
  latest: {
    quote_date: string
    close_price: number
    variation_pct: number
    volume: number
    value_traded: number
    extras: Record<string, number | string>
  } | null
  series: SeriesPoint[]
  stats: {
    series_days: number
    high_52w: number | null
    low_52w: number | null
    avg_volume_30d: number | null
    perf_1d: number | null
    perf_7d: number | null
    perf_30d: number | null
    perf_90d: number | null
  }
  news: NewsItem[]
}

// --- Formatters ------------------------------------------------------------

function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtValue(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} Md`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} k`
  return v.toFixed(0)
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

function signColor(v: number | null | undefined): string {
  if (v === null || v === undefined || v === 0) return 'text-[var(--color-fg-muted)]'
  return v > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
}

function SignIcon({ v, size = 14 }: { v: number | null | undefined; size?: number }) {
  if (v === null || v === undefined || v === 0) return <Minus size={size} />
  return v > 0 ? <TrendingUp size={size} /> : <TrendingDown size={size} />
}

// --- KPI tile --------------------------------------------------------------

function Kpi({ label, value, sub, accent }: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="px-4 py-3 border border-[var(--color-border)] rounded-md bg-[var(--color-surface)]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className={cn(
        'mt-1 font-mono text-base font-semibold',
        accent === 'up' && 'text-[var(--color-success)]',
        accent === 'down' && 'text-[var(--color-danger)]',
        (!accent || accent === 'neutral') && 'text-[var(--color-fg)]',
      )}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-[var(--color-fg-subtle)]">{sub}</div>}
    </div>
  )
}

// --- Page -----------------------------------------------------------------

const RANGE_OPTIONS: { label: string; days: number }[] = [
  { label: '7j', days: 7 },
  { label: '30j', days: 30 },
  { label: '90j', days: 90 },
  { label: '1 an', days: 365 },
]

export function TickerDetailPage() {
  const navigate = useNavigate()
  const { ticker: rawTicker } = useParams<{ ticker: string }>()
  const ticker = (rawTicker ?? '').toUpperCase()
  const [days, setDays] = useState(90)

  const q = useQuery({
    queryKey: ['market', 'ticker', ticker, days],
    queryFn: () => apiFetch<TickerDetail>(`/api/market/tickers/${ticker}?days=${days}`),
    enabled: Boolean(ticker),
  })

  const chartPoints = useMemo(() => q.data?.series.map((p) => ({
    date: p.date, close: p.close, volume: p.volume,
  })) ?? [], [q.data])

  if (q.isLoading) {
    return (
      <>
        <PageHeader title={ticker} subtitle="Chargement…" />
        <PageContent>
          <Card><CardBody className="py-10 text-center text-[var(--color-fg-subtle)]">…</CardBody></Card>
        </PageContent>
      </>
    )
  }

  if (q.error || !q.data) {
    const msg = (q.error as Error)?.message ?? 'Ticker introuvable'
    return (
      <>
        <PageHeader
          title={ticker}
          subtitle="Fiche indisponible"
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate('/market')}>
              <ArrowLeft size={14} /> Retour marché
            </Button>
          }
        />
        <PageContent>
          <Card><CardBody className="py-10 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">{msg}</p>
          </CardBody></Card>
        </PageContent>
      </>
    )
  }

  const d = q.data
  const latest = d.latest
  const e = latest?.extras ?? {}

  const open = Number(e.open_price) || null
  const high = Number(e.high_price) || null
  const low = Number(e.low_price) || null
  const prev = Number(e.previous_close) || null
  const rsi = Number(e.rsi) || null
  const beta = Number(e.beta_1y) || null
  const per = Number(e.per) || null
  const dividend = Number(e.dividend) || null
  const yieldPct = Number(e.dividend_yield_pct) || null
  const marketCap = Number(e.market_cap_mfcfa) || null
  const capitalTraded = Number(e.capital_traded_pct) || null

  const variation = latest?.variation_pct ?? 0
  const close = latest?.close_price ?? 0

  const sikaUrl = `https://www.sikafinance.com/marches/cotation_${d.ticker}.${d.country}`

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono text-2xl tracking-tight">{d.ticker}</span>
            <Badge tone="neutral" size="md">{d.country.toUpperCase()}</Badge>
            {d.sector && <Badge tone="gold" size="md">{d.sector}</Badge>}
          </span>
        }
        subtitle={
          <span>
            <span className="font-medium text-[var(--color-fg)]">{d.name}</span>
            {latest && (
              <span className="ml-3 text-[var(--color-fg-subtle)]">
                · Cotation du {new Date(latest.quote_date).toLocaleDateString('fr-FR',
                  { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/market')}>
              <ArrowLeft size={14} /> Marché
            </Button>
            <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw size={14} className={q.isFetching ? 'animate-spin' : ''} /> Rafraîchir
            </Button>
            <a
              href={sikaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 h-8 px-3 rounded-md text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors"
            >
              <ExternalLink size={14} /> Sika Finance
            </a>
          </>
        }
      />

      <PageContent>
        {/* Hero cours actuel */}
        <Card>
          <CardBody className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-fg-muted)]">
                Cours actuel
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-mono text-4xl font-semibold text-[var(--color-navy)] tabular-nums">
                  {fmtNum(close)}
                </span>
                <span className="text-sm text-[var(--color-fg-muted)]">FCFA</span>
              </div>
              <div className={cn('mt-2 flex items-center gap-2 font-mono text-base font-semibold', signColor(variation))}>
                <SignIcon v={variation} size={16} />
                <span>{fmtPct(variation)}</span>
                {prev && (
                  <span className="text-[var(--color-fg-subtle)] text-sm font-normal">
                    vs clôture veille {fmtNum(prev)}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 max-w-2xl">
              <Kpi label="1 jour" value={fmtPct(d.stats.perf_1d ?? variation)}
                   accent={((d.stats.perf_1d ?? variation) > 0) ? 'up' : ((d.stats.perf_1d ?? variation) < 0) ? 'down' : 'neutral'} />
              <Kpi label="7 jours" value={fmtPct(d.stats.perf_7d)}
                   accent={d.stats.perf_7d && d.stats.perf_7d > 0 ? 'up' : d.stats.perf_7d && d.stats.perf_7d < 0 ? 'down' : 'neutral'} />
              <Kpi label="30 jours" value={fmtPct(d.stats.perf_30d)}
                   accent={d.stats.perf_30d && d.stats.perf_30d > 0 ? 'up' : d.stats.perf_30d && d.stats.perf_30d < 0 ? 'down' : 'neutral'} />
              <Kpi label="90 jours" value={fmtPct(d.stats.perf_90d)}
                   accent={d.stats.perf_90d && d.stats.perf_90d > 0 ? 'up' : d.stats.perf_90d && d.stats.perf_90d < 0 ? 'down' : 'neutral'} />
            </div>
          </CardBody>
        </Card>

        {/* Chart */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Cours · {d.stats.series_days} séance(s) en base</CardTitle>
            <div className="flex gap-1">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setDays(opt.days)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs transition-colors border',
                    days === opt.days
                      ? 'bg-[var(--color-navy-solid)] text-white border-transparent'
                      : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-muted)]',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            {d.series.length < 2 ? (
              <div className="py-12 text-center text-sm text-[var(--color-fg-subtle)]">
                Pas assez d'historique pour tracer une courbe.<br />
                <span className="text-[var(--color-fg-muted)]">L'historique se construit au fil des runs quotidiens.</span>
              </div>
            ) : (
              <PriceChart points={chartPoints} height={280} />
            )}
          </CardBody>
        </Card>

        {/* KPI détaillés — séance */}
        <Card>
          <CardHeader>
            <CardTitle>Métriques de la séance</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi label="Ouverture" value={fmtNum(open)} />
              <Kpi label="Plus haut" value={fmtNum(high)} accent="up" />
              <Kpi label="Plus bas" value={fmtNum(low)} accent="down" />
              <Kpi label="Clôt. veille" value={fmtNum(prev)} />
              <Kpi label="Volume (titres)" value={fmtNum(latest?.volume)}
                   sub={d.stats.avg_volume_30d ? `moy 30j · ${fmtNum(d.stats.avg_volume_30d)}` : undefined} />
              <Kpi label="Valeur échangée" value={`${fmtValue(latest?.value_traded)}`} sub="FCFA" />
            </div>
          </CardBody>
        </Card>

        {/* KPI valorisation + indicateurs techniques */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Valorisation</CardTitle></CardHeader>
            <CardBody className="pt-0">
              <div className="grid grid-cols-2 gap-3">
                <Kpi label="Capitalisation" value={fmtValue(marketCap)} sub="MFCFA" />
                <Kpi label="PER" value={fmtNum(per, 2)} />
                <Kpi label="Dividende" value={fmtNum(dividend)} sub="FCFA / action" />
                <Kpi label="Rendement" value={fmtPct(yieldPct)} accent={yieldPct && yieldPct > 0 ? 'up' : 'neutral'} />
                <Kpi label="Plus haut 52s"
                     value={fmtNum(d.stats.high_52w)}
                     sub={close && d.stats.high_52w ? `${((close - d.stats.high_52w) / d.stats.high_52w * 100).toFixed(1)}% de l'ATH` : undefined} />
                <Kpi label="Plus bas 52s"
                     value={fmtNum(d.stats.low_52w)}
                     sub={close && d.stats.low_52w ? `${((close - d.stats.low_52w) / d.stats.low_52w * 100).toFixed(1)}% vs ATL` : undefined} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Indicateurs techniques</CardTitle></CardHeader>
            <CardBody className="pt-0">
              <div className="grid grid-cols-2 gap-3">
                <Kpi label="RSI"
                     value={fmtNum(rsi, 1)}
                     sub={rsi ? (rsi > 70 ? 'Suracheté' : rsi < 30 ? 'Survendu' : 'Neutre') : undefined}
                     accent={rsi ? (rsi > 70 ? 'down' : rsi < 30 ? 'up' : 'neutral') : 'neutral'} />
                <Kpi label="Beta 1 an" value={fmtNum(beta, 2)}
                     sub={beta ? (beta > 1 ? 'Plus volatile que marché' : beta < 1 ? 'Moins volatile' : '') : undefined} />
                <Kpi label="Capital échangé" value={fmtPct(capitalTraded)} sub="du flottant" />
                <Kpi label="Pays" value={d.country.toUpperCase()} />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Historique tabulaire */}
        <Card>
          <CardHeader><CardTitle>Historique · {d.series.length} séance(s)</CardTitle></CardHeader>
          <CardBody className="p-0">
            {d.series.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--color-fg-subtle)]">
                Aucun historique en base pour ce ticker.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-surface-2)]">
                    <tr>
                      <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">Date</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">Ouv.</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">Haut</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">Bas</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">Clôture</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">Var.</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...d.series].reverse().map((p) => (
                      <tr key={p.date} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                        <td className="px-5 py-2.5 font-mono text-[var(--color-fg)]">
                          {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono">{fmtNum(p.open)}</td>
                        <td className="px-5 py-2.5 text-right font-mono">{fmtNum(p.high)}</td>
                        <td className="px-5 py-2.5 text-right font-mono">{fmtNum(p.low)}</td>
                        <td className="px-5 py-2.5 text-right font-mono font-semibold">{fmtNum(p.close)}</td>
                        <td className={cn('px-5 py-2.5 text-right font-mono font-semibold', signColor(p.variation_pct))}>
                          {fmtPct(p.variation_pct)}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-[var(--color-fg-muted)]">
                          {fmtNum(p.volume)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* News liées */}
        <Card>
          <CardHeader><CardTitle>Actualités mentionnant {d.ticker} · {d.news.length}</CardTitle></CardHeader>
          <CardBody className="p-0">
            {d.news.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
                Aucune actualité liée enregistrée pour le moment.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {d.news.map((n) => (
                  <li key={n.id} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <a
                        href={n.url} target="_blank" rel="noreferrer"
                        className="text-sm font-medium text-[var(--color-fg)] hover:text-[var(--color-navy)] line-clamp-2"
                      >
                        {n.title}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-fg-subtle)]">
                        <span className="font-mono">{n.source_key}</span>
                        {n.published_at && (
                          <span>· {new Date(n.published_at).toLocaleDateString('fr-FR')}</span>
                        )}
                        {n.sentiment && (
                          <Badge tone={n.sentiment === 'positive' ? 'success' : n.sentiment === 'negative' ? 'danger' : 'neutral'}>
                            {n.sentiment}
                          </Badge>
                        )}
                        {typeof n.materiality === 'number' && n.materiality > 0 && (
                          <Badge tone={n.materiality >= 4 ? 'gold' : 'neutral'}>mat · {n.materiality}</Badge>
                        )}
                      </div>
                    </div>
                    <a
                      href={n.url} target="_blank" rel="noreferrer"
                      className="flex-none text-[var(--color-fg-muted)] hover:text-[var(--color-navy)]"
                      aria-label="Ouvrir l'article"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </PageContent>
    </>
  )
}
