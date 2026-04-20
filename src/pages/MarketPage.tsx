import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCw, Sparkles, TrendingUp, TrendingDown, Activity, BarChart3, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/cn'

// --- Types -----------------------------------------------------------------

interface QuoteRow {
  ticker: string
  name: string
  sector: string
  country: string
  close_price: number
  variation_pct: number
  volume: number
  value_traded: number
  extras: Record<string, number | string>
}

interface SnapshotResponse {
  trading_date: string | null
  quotes_count: number
  traded_count: number
  total_value: number
  movers_up: QuoteRow[]
  movers_down: QuoteRow[]
  top_volumes: QuoteRow[]
  top_values: QuoteRow[]
  by_sector: { sector: string; count: number; traded_count: number; avg_var_pct: number; total_value: number }[]
  all_quotes: QuoteRow[]
}

interface AnalysisResponse {
  id: number
  trading_date: string
  narrative_fr: string
  key_stats: {
    headline?: string
    market_summary?: string
    sector_highlights?: { sector: string; takeaway: string }[]
    signals?: string[]
    watchlist?: { ticker: string; reason: string }[]
  }
  model_used: string | null
  input_tokens: number
  output_tokens: number
  generated_at: string
}

// --- Formatters ------------------------------------------------------------

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtValue(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} Md`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} k`
  return v.toFixed(0)
}

// --- Heatmap ---------------------------------------------------------------

function HeatCell({ q, onClick }: { q: QuoteRow; onClick?: () => void }) {
  const alpha = Math.min(Math.abs(q.variation_pct), 5) / 5
  const opacity = 0.12 + alpha * 0.55
  const color = q.variation_pct > 0
    ? `rgba(5, 150, 105, ${opacity})`
    : q.variation_pct < 0
      ? `rgba(220, 38, 38, ${opacity})`
      : 'var(--color-muted)'
  const sign = q.variation_pct > 0 ? '+' : ''
  const tooltip = (
    <div className="space-y-1">
      <div className="font-semibold">{q.name}</div>
      <div className="font-mono text-[10px] text-[var(--color-fg-muted)]">{q.ticker} · {q.sector}</div>
      <div>Cours : <span className="font-mono">{q.close_price.toLocaleString('fr-FR')}</span></div>
      <div>Variation : <span className="font-mono">{sign}{q.variation_pct.toFixed(2)}%</span></div>
      <div>Volume : <span className="font-mono">{q.volume.toLocaleString('fr-FR')}</span></div>
    </div>
  )
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'aspect-square p-2 rounded-md border border-transparent hover:border-[var(--color-gold)]/40',
          'flex flex-col justify-between text-left transition-colors cursor-pointer',
        )}
        style={{ backgroundColor: color }}
      >
        <span className="font-mono text-[10px] font-semibold text-[var(--color-fg)] leading-none">{q.ticker}</span>
        <span className={cn(
          'font-mono text-xs font-semibold leading-none',
          q.variation_pct > 0 && 'text-[var(--color-success)]',
          q.variation_pct < 0 && 'text-[var(--color-danger)]',
          q.variation_pct === 0 && 'text-[var(--color-fg-muted)]',
        )}>
          {sign}{q.variation_pct.toFixed(1)}%
        </span>
      </button>
    </Tooltip>
  )
}

// --- Movers list ----------------------------------------------------------

function MoversList({ rows, tone, onSelect }: { rows: QuoteRow[]; tone: 'up' | 'down'; onSelect: (t: string) => void }) {
  if (rows.length === 0) {
    return <div className="px-5 pb-5 text-sm text-[var(--color-fg-subtle)]">Aucun mouvement.</div>
  }
  const color = tone === 'up' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {rows.map((r) => (
        <li key={r.ticker}>
          <button
            type="button"
            onClick={() => onSelect(r.ticker)}
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-[var(--color-fg)]">{r.ticker}</span>
                <span className="text-[10px] text-[var(--color-fg-subtle)]">{r.country}</span>
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-fg-muted)] truncate max-w-[200px]">{r.name}</div>
            </div>
            <div className="text-right">
              <div className={cn('font-mono text-sm font-semibold', color)}>
                {r.variation_pct > 0 ? '+' : ''}{r.variation_pct.toFixed(2)}%
              </div>
              <div className="text-[10px] font-mono text-[var(--color-fg-subtle)]">
                {r.close_price.toLocaleString('fr-FR')}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

// --- Main page ------------------------------------------------------------

type SortKey = 'ticker' | 'name' | 'close_price' | 'variation_pct' | 'volume' | 'value_traded'
type SortDir = 'asc' | 'desc'

function SortHeader({
  label, k, align, current, dir, onClick, hideOnMobile, hideOnLarge,
}: {
  label: string
  k: SortKey
  align: 'left' | 'right'
  current: SortKey
  dir: SortDir
  onClick: (k: SortKey) => void
  hideOnMobile?: boolean
  hideOnLarge?: boolean
}) {
  const active = current === k
  return (
    <th
      className={cn(
        'px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider select-none',
        active ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]',
        align === 'left' ? 'text-left' : 'text-right',
        hideOnMobile && 'hidden md:table-cell',
        hideOnLarge && 'hidden lg:table-cell',
      )}
    >
      <button
        type="button"
        onClick={() => onClick(k)}
        className={cn(
          'inline-flex items-center gap-1.5 hover:text-[var(--color-fg)] transition-colors cursor-pointer',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        <span>{label}</span>
        {active ? (
          dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
        ) : (
          <span className="opacity-30"><ArrowDown size={11} /></span>
        )}
      </button>
    </th>
  )
}

export function MarketPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [sectorFilter, setSectorFilter] = useState<string | null>(null)
  // Défaut "pertinence financière" — cf. backend `build_snapshot`.
  const [sortKey, setSortKey] = useState<SortKey>('value_traded')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const openTicker = (ticker: string) => navigate(`/market/${ticker}`)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Défaut par colonne : numérique = desc (le plus grand d'abord), texte = asc
      setSortDir(key === 'ticker' || key === 'name' ? 'asc' : 'desc')
    }
  }

  const snapshot = useQuery({
    queryKey: ['market', 'snapshot'],
    queryFn: () => apiFetch<SnapshotResponse>('/api/market/snapshot'),
  })

  const analysis = useQuery({
    queryKey: ['market', 'analysis'],
    queryFn: () => apiFetch<AnalysisResponse>('/api/market/analysis'),
    // N'auto-refetch pas sans raison (l'analyse est 1×/jour)
    staleTime: 5 * 60_000,
  })

  const regenerate = useMutation({
    mutationFn: () => apiFetch<AnalysisResponse>('/api/market/analysis/regenerate', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Analyse régénérée', { description: 'Sonnet a produit une nouvelle lecture de la séance.' })
      qc.invalidateQueries({ queryKey: ['market', 'analysis'] })
    },
    onError: (err) => toast.error('Échec régénération', { description: (err as Error).message }),
  })

  // HOOKS : tous les hooks doivent être appelés avant les early returns. On
  // calcule `allQuotes` à partir de `snapshot.data?.all_quotes ?? []` pour
  // rester safe pendant le loading.
  const allQuotes = useMemo(() => {
    const source = snapshot.data?.all_quotes ?? []
    const filtered = sectorFilter
      ? source.filter((q) => (q.sector || 'Autres') === sectorFilter)
      : source
    const sign = sortDir === 'asc' ? 1 : -1
    const copy = [...filtered]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * sign
      }
      return String(av).localeCompare(String(bv)) * sign
    })
    return copy
  }, [snapshot.data, sectorFilter, sortKey, sortDir])

  if (snapshot.isLoading) {
    return <>
      <PageHeader title="Marché" subtitle="Chargement…" />
      <PageContent>
        <Card><CardBody className="text-center py-10 text-[var(--color-fg-subtle)]">…</CardBody></Card>
      </PageContent>
    </>
  }

  if (snapshot.error || !snapshot.data) {
    const msg = (snapshot.error as Error)?.message || 'Données indisponibles'
    return <>
      <PageHeader title="Marché" subtitle="Aucune donnée pour le moment." />
      <PageContent>
        <Card>
          <CardBody className="text-center py-10">
            <p className="text-sm text-[var(--color-fg-muted)]">{msg}</p>
            <p className="mt-2 text-xs text-[var(--color-fg-subtle)]">
              Lance d'abord un run depuis le Dashboard pour remplir la base des cotations.
            </p>
          </CardBody>
        </Card>
      </PageContent>
    </>
  }

  const s = snapshot.data
  const a = analysis.data

  return (
    <>
      <PageHeader
        title="Marché BRVM"
        subtitle={`Séance du ${fmtDate(s.trading_date)} · ${s.traded_count}/${s.quotes_count} tickers cotés · ${fmtValue(s.total_value)} FCFA échangés`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => snapshot.refetch()} disabled={snapshot.isFetching}>
              <RefreshCw size={14} className={snapshot.isFetching ? 'animate-spin' : ''} /> Rafraîchir
            </Button>
            <Button variant="accent" size="sm" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
              <Sparkles size={14} />
              {regenerate.isPending ? 'Génération…' : a ? 'Régénérer l\'analyse' : 'Générer l\'analyse'}
            </Button>
          </>
        }
      />

      <PageContent>
        {/* Analyse Sonnet du jour */}
        {a ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles size={12} className="text-[var(--color-gold)]" /> Analyse du jour
                <span className="ml-auto text-[10px] text-[var(--color-fg-subtle)] font-normal">
                  {a.model_used} · {a.input_tokens}→{a.output_tokens} tok
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-0 space-y-4">
              {a.key_stats.headline && (
                <div className="text-base font-semibold text-[var(--color-navy)] leading-snug">
                  {a.key_stats.headline}
                </div>
              )}
              <p className="text-sm text-[var(--color-fg)] leading-relaxed">
                {a.narrative_fr || a.key_stats.market_summary}
              </p>

              {a.key_stats.sector_highlights && a.key_stats.sector_highlights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {a.key_stats.sector_highlights.map((h, i) => (
                    <div key={i} className="border-l-2 border-[var(--color-gold)] pl-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                        {h.sector}
                      </div>
                      <div className="mt-0.5 text-sm text-[var(--color-fg)]">{h.takeaway}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {a.key_stats.signals && a.key_stats.signals.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                      Signaux observés
                    </div>
                    <ul className="text-sm text-[var(--color-fg)] space-y-1.5 list-disc list-inside">
                      {a.key_stats.signals.map((sig, i) => <li key={i}>{sig}</li>)}
                    </ul>
                  </div>
                )}
                {a.key_stats.watchlist && a.key_stats.watchlist.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                      À surveiller
                    </div>
                    <ul className="text-sm space-y-1.5">
                      {a.key_stats.watchlist.map((w, i) => (
                        <li key={i}>
                          <span className="font-mono font-semibold text-[var(--color-navy)]">{w.ticker}</span>
                          <span className="text-[var(--color-fg-muted)]"> — {w.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[var(--color-border)] text-[10px] text-[var(--color-fg-subtle)]">
                Générée le {new Date(a.generated_at).toLocaleString('fr-FR')} · Analyse probabiliste, pas une recommandation
              </div>
            </CardBody>
          </Card>
        ) : analysis.isLoading ? (
          <Card><CardBody className="text-center py-10 text-sm text-[var(--color-fg-subtle)]">
            <Sparkles size={20} className="mx-auto text-[var(--color-gold)] mb-2 animate-pulse" />
            Chargement de l'analyse…
          </CardBody></Card>
        ) : (
          <Card>
            <CardBody className="text-center py-8">
              <p className="text-sm text-[var(--color-fg-muted)]">Pas encore d'analyse pour cette séance.</p>
              <Button variant="accent" size="sm" className="mt-3" onClick={() => regenerate.mutate()}>
                <Sparkles size={14} /> Générer avec Sonnet
              </Button>
            </CardBody>
          </Card>
        )}

        {/* Top movers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-[var(--color-success)]"><TrendingUp size={12} /> Top hausses</CardTitle></CardHeader>
            <CardBody className="p-0"><MoversList rows={s.movers_up} tone="up" onSelect={openTicker} /></CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-[var(--color-danger)]"><TrendingDown size={12} /> Top baisses</CardTitle></CardHeader>
            <CardBody className="p-0"><MoversList rows={s.movers_down} tone="down" onSelect={openTicker} /></CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity size={12} /> Top volumes</CardTitle></CardHeader>
            <CardBody className="p-0"><MoversList rows={s.top_volumes} tone="up" onSelect={openTicker} /></CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 size={12} /> Top valeur</CardTitle></CardHeader>
            <CardBody className="p-0"><MoversList rows={s.top_values} tone="up" onSelect={openTicker} /></CardBody>
          </Card>
        </div>

        {/* Par secteur */}
        <Card>
          <CardHeader>
            <CardTitle>Par secteur</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSectorFilter(null)}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-xs transition-colors',
                  sectorFilter === null
                    ? 'bg-[var(--color-navy-solid)] text-white border-transparent'
                    : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-muted)]',
                )}
              >
                Tous ({s.quotes_count})
              </button>
              {s.by_sector.map((sec) => (
                <button
                  key={sec.sector}
                  onClick={() => setSectorFilter(sec.sector)}
                  className={cn(
                    'px-3 py-1.5 rounded-full border text-xs transition-colors inline-flex items-center gap-2',
                    sectorFilter === sec.sector
                      ? 'bg-[var(--color-navy-solid)] text-white border-transparent'
                      : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-muted)]',
                  )}
                >
                  <span>{sec.sector}</span>
                  <span className="text-[10px] opacity-70">{sec.traded_count}/{sec.count}</span>
                  <span className={cn(
                    'text-[10px] font-mono',
                    sec.avg_var_pct > 0 && sectorFilter !== sec.sector && 'text-[var(--color-success)]',
                    sec.avg_var_pct < 0 && sectorFilter !== sec.sector && 'text-[var(--color-danger)]',
                  )}>
                    {sec.avg_var_pct > 0 ? '+' : ''}{sec.avg_var_pct.toFixed(2)}%
                  </span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>Heatmap — {sectorFilter ?? 'tous les tickers'}</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
              {allQuotes
                .filter((q) => q.close_price > 0 || q.volume > 0)
                .map((q) => <HeatCell key={q.ticker} q={q} onClick={() => openTicker(q.ticker)} />)
              }
            </div>
          </CardBody>
        </Card>

        {/* Détail par ticker */}
        <Card>
          <CardHeader>
            <CardTitle>Détail · {allQuotes.length} ticker(s)</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-2)]">
                  <tr>
                    <SortHeader label="Ticker" k="ticker" align="left" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortHeader label="Nom" k="name" align="left" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] hidden md:table-cell">Secteur</th>
                    <SortHeader label="Cours" k="close_price" align="right" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortHeader label="Var." k="variation_pct" align="right" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortHeader label="Volume" k="volume" align="right" hideOnMobile current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortHeader label="Valeur" k="value_traded" align="right" hideOnLarge current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {allQuotes.map((q) => (
                    <tr
                      key={q.ticker}
                      onClick={() => openTicker(q.ticker)}
                      className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)] cursor-pointer"
                    >
                      <td className="px-5 py-3 font-mono font-semibold text-[var(--color-navy)]">{q.ticker}</td>
                      <td className="px-5 py-3 text-[var(--color-fg)]">{q.name}</td>
                      <td className="px-5 py-3 hidden md:table-cell"><Badge tone="neutral">{q.sector || 'Autres'}</Badge></td>
                      <td className="px-5 py-3 text-right font-mono">{q.close_price.toLocaleString('fr-FR')}</td>
                      <td className={cn(
                        'px-5 py-3 text-right font-mono font-semibold',
                        q.variation_pct > 0 && 'text-[var(--color-success)]',
                        q.variation_pct < 0 && 'text-[var(--color-danger)]',
                      )}>
                        {q.variation_pct > 0 ? '+' : ''}{q.variation_pct.toFixed(2)}%
                      </td>
                      <td className="px-5 py-3 text-right font-mono hidden md:table-cell">{q.volume.toLocaleString('fr-FR')}</td>
                      <td className="px-5 py-3 text-right font-mono hidden lg:table-cell">{fmtValue(q.value_traded)}</td>
                      <td className="px-5 py-3 text-right">
                        <a
                          href={`https://www.sikafinance.com/marches/cotation_${q.ticker}.${q.country}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center text-[var(--color-fg-muted)] hover:text-[var(--color-navy)]"
                          title="Voir sur Sika Finance"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </PageContent>
    </>
  )
}
