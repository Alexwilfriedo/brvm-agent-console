import { TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

/**
 * Vue dédiée au brief hebdomadaire (brief_type='weekly').
 *
 * Structure du payload différente du daily :
 *   - scorecard (wins/losses/pending + avg P&L + best/worst)
 *   - plays (opportunités rétrospectives avec outcome + lesson)
 *   - structural_news, week_ahead_catalysts, watchlist_updates
 *
 * Ton : sobre, audit-oriented, pas de call-to-action.
 */

export interface WeeklyPlay {
  ticker: string
  name?: string
  sector?: string
  direction?: string
  conviction?: number
  issued_on?: string
  price_at_signal?: number | null
  current_price?: number | null
  realized_pnl_pct?: number | null
  outcome?: 'won' | 'lost' | 'pending'
  lesson?: string
  thesis?: string
}

export interface WeeklyScorecard {
  total_calls?: number
  wins?: number
  losses?: number
  pending?: number
  avg_realized_pnl_pct?: number | null
  best_ticker?: string | null
  best_pnl_pct?: number | null
  worst_ticker?: string | null
  worst_pnl_pct?: number | null
}

export interface WeeklyPayload {
  week_start?: string
  week_end?: string
  market_regime?: string | null
  week_summary?: string
  scorecard?: WeeklyScorecard
  plays?: WeeklyPlay[]
  structural_news?: string[]
  week_ahead_catalysts?: string[]
  watchlist_updates?: string[]
}

// --- Formatters -------------------------------------------------------------

function formatFcfa(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' FCFA'
}

function formatPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

const OUTCOME_META: Record<
  'won' | 'lost' | 'pending',
  { label: string; tone: 'success' | 'danger' | 'neutral'; color: string }
> = {
  won:     { label: 'Gagné',      tone: 'success', color: 'var(--color-success)' },
  lost:    { label: 'Perdu',      tone: 'danger',  color: 'var(--color-danger)'  },
  pending: { label: 'En attente', tone: 'neutral', color: 'var(--color-fg-muted)'},
}

// --- Scorecard --------------------------------------------------------------

function ScorecardView({ sc }: { sc: WeeklyScorecard }) {
  const total = sc.total_calls ?? 0
  const wins = sc.wins ?? 0
  const losses = sc.losses ?? 0
  const pending = sc.pending ?? 0
  const avg = sc.avg_realized_pnl_pct
  const avgColor =
    avg == null ? 'text-[var(--color-fg-muted)]'
    : avg >= 0  ? 'text-[var(--color-success)]'
    :             'text-[var(--color-danger)]'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scorecard de la semaine</CardTitle>
      </CardHeader>
      <CardBody className="pt-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScoreCell label="Calls" value={total} color="text-[var(--color-fg)]" />
          <ScoreCell label="Gagnés" value={wins} color="text-[var(--color-success)]" />
          <ScoreCell label="Perdus" value={losses} color="text-[var(--color-danger)]" />
          <ScoreCell label="En attente" value={pending} color="text-[var(--color-fg-muted)]" />
        </div>
        {avg != null && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between gap-4 flex-wrap">
            <div className="inline-flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                P&L moyen réalisé
              </span>
              <span className={cn('font-mono font-semibold', avgColor)}>
                {formatPct(avg)}
              </span>
            </div>
            <div className="inline-flex items-center gap-3 text-xs font-mono">
              {sc.best_ticker && (
                <span className="inline-flex items-center gap-1">
                  <TrendingUp size={12} className="text-[var(--color-success)]" />
                  <span className="text-[var(--color-fg)]">{sc.best_ticker}</span>
                  <span className="text-[var(--color-success)]">{formatPct(sc.best_pnl_pct)}</span>
                </span>
              )}
              {sc.worst_ticker && (
                <span className="inline-flex items-center gap-1">
                  <TrendingDown size={12} className="text-[var(--color-danger)]" />
                  <span className="text-[var(--color-fg)]">{sc.worst_ticker}</span>
                  <span className="text-[var(--color-danger)]">{formatPct(sc.worst_pnl_pct)}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function ScoreCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
        {label}
      </div>
      <div className={cn('font-mono text-2xl font-bold', color)}>{value}</div>
    </div>
  )
}

// --- Play card --------------------------------------------------------------

function PlayCard({ play }: { play: WeeklyPlay }) {
  const outcome = (play.outcome ?? 'pending') as 'won' | 'lost' | 'pending'
  const meta = OUTCOME_META[outcome]
  const pnl = play.realized_pnl_pct
  const pnlColor =
    pnl == null ? 'text-[var(--color-fg-muted)]'
    : pnl >= 0  ? 'text-[var(--color-success)]'
    :             'text-[var(--color-danger)]'

  return (
    <div
      className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
      style={{ borderLeft: `4px solid ${meta.color}` }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between gap-4 border-b border-[var(--color-border)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-[var(--color-fg)]">{play.ticker}</span>
            {play.name && <span className="text-sm text-[var(--color-fg-muted)]">— {play.name}</span>}
            {play.sector && <Badge tone="neutral" size="sm">{play.sector}</Badge>}
          </div>
          <div className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">
            {play.direction ?? 'signal'}
            {play.issued_on && ` · émis le ${play.issued_on}`}
          </div>
        </div>
        <Badge tone={meta.tone} size="md">{meta.label}</Badge>
      </div>

      {/* P&L block */}
      {(play.price_at_signal != null || play.current_price != null || pnl != null) && (
        <div className="px-4 py-3 grid grid-cols-3 gap-3 border-b border-[var(--color-border)] bg-[var(--color-muted)]">
          <KV label="Cours au signal" value={formatFcfa(play.price_at_signal)} />
          <KV label="Cours actuel" value={formatFcfa(play.current_price)} />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              P&L réalisé
            </div>
            <div className={cn('text-base font-mono font-semibold', pnlColor)}>
              {formatPct(pnl)}
            </div>
          </div>
        </div>
      )}

      {/* Thesis + lesson */}
      <div className="px-4 py-3 space-y-3">
        {play.thesis && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              Thèse d'origine
            </div>
            <p className="text-sm text-[var(--color-fg-muted)] italic leading-relaxed">{play.thesis}</p>
          </div>
        )}
        {play.lesson && (
          <div className="rounded-md p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-warning)] mb-1">
              <AlertTriangle size={11} />
              Leçon
            </div>
            <p className="text-sm text-[var(--color-fg)] leading-relaxed">{play.lesson}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
        {label}
      </div>
      <div className="text-sm font-mono text-[var(--color-fg)]">{value}</div>
    </div>
  )
}

// --- Main view --------------------------------------------------------------

export function WeeklyBriefView({ payload }: { payload: WeeklyPayload }) {
  const sc = payload.scorecard ?? {}
  const plays = payload.plays ?? []
  const news = payload.structural_news ?? []
  const weekAhead = payload.week_ahead_catalysts ?? []
  const watchlist = payload.watchlist_updates ?? []

  return (
    <>
      <Card>
        <CardBody>
          <div className="flex items-center gap-2 flex-wrap">
            <Clock size={14} className="text-[var(--color-fg-muted)]" />
            <span className="text-sm text-[var(--color-fg-muted)]">
              Fenêtre couverte :
            </span>
            <span className="text-sm font-mono text-[var(--color-fg)]">
              {payload.week_start ?? '—'}
            </span>
            <span className="text-[var(--color-fg-subtle)]">→</span>
            <span className="text-sm font-mono text-[var(--color-fg)]">
              {payload.week_end ?? '—'}
            </span>
          </div>
        </CardBody>
      </Card>

      <ScorecardView sc={sc} />

      {payload.week_summary && (
        <Card>
          <CardHeader>
            <CardTitle>Contexte marché</CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <p className="text-sm text-[var(--color-fg)] leading-relaxed whitespace-pre-wrap">
              {payload.week_summary}
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Détail des calls <span className="text-[var(--color-fg-muted)] font-normal">({plays.length})</span>
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-2 space-y-3">
          {plays.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-subtle)]">
              Aucun call émis pendant la semaine. Le weekly ne contient donc
              pas d'audit de performance — les événements marquants restent listés ci-dessous.
            </p>
          ) : (
            plays.map((p, i) => <PlayCard key={`${p.ticker}-${p.issued_on}-${i}`} play={p} />)
          )}
        </CardBody>
      </Card>

      {news.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>News structurelles</CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <ul className="space-y-2">
              {news.map((n, i) => (
                <li key={i} className="text-sm text-[var(--color-fg)] flex gap-2">
                  <span className="text-[var(--color-fg-muted)] shrink-0">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {weekAhead.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Semaine à venir</CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <ul className="space-y-2">
              {weekAhead.map((c, i) => (
                <li key={i} className="text-sm text-[var(--color-fg)] flex gap-2">
                  <span className="text-[var(--color-navy)] shrink-0">→</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {watchlist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Watchlist — évolutions</CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <ul className="space-y-1.5">
              {watchlist.map((w, i) => (
                <li key={i} className="text-sm text-[var(--color-fg)] flex gap-2">
                  <span className="text-[var(--color-fg-muted)] shrink-0">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  )
}
