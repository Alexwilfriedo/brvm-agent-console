import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, AlertTriangle, RotateCw,
  TrendingUp, TrendingDown, Minus, ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RedeliverDialog } from '@/components/ui/RedeliverDialog'
import { WeeklyBriefView, type WeeklyPayload } from '@/components/brief/WeeklyBriefView'
import { apiFetch, ApiError } from '@/lib/api'
import type { BriefDetail, DeliveryStatus, RedeliverResult, RedeliverTarget } from '@/lib/types'
import { cn } from '@/lib/cn'

// --- Formatters -------------------------------------------------------------

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

// --- Badges -----------------------------------------------------------------

const DELIVERY_LABELS: Record<DeliveryStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  pending:      { label: 'En attente',       tone: 'neutral' },
  delivered:    { label: 'Livré',            tone: 'success' },
  partial:      { label: 'Partiel',          tone: 'warning' },
  failed:       { label: 'Échec',            tone: 'danger'  },
  failed_synth: { label: 'Synthèse dégradée', tone: 'danger'  },
}

function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  const meta = DELIVERY_LABELS[status] ?? { label: status, tone: 'neutral' as const }
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

const DIRECTION_META: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger'; icon: typeof TrendingUp }> = {
  buy:    { label: 'Achat',      tone: 'success', icon: TrendingUp   },
  watch:  { label: 'Surveiller', tone: 'warning', icon: Clock        },
  hold:   { label: 'Conserver',  tone: 'neutral', icon: Minus        },
  reduce: { label: 'Alléger',    tone: 'warning', icon: TrendingDown },
  avoid:  { label: 'Éviter',     tone: 'danger',  icon: XCircle      },
}

// --- Opportunity card -------------------------------------------------------

interface Valuation {
  dpa_current?: number | null
  dpa_estimate?: number | null
  p_b_current?: number | null
  p_b_estimate?: number | null
  per_current?: number | null
  per_estimate?: number | null
  dividend_yield_current?: number | null
  dividend_yield_estimate?: number | null
}

interface Opportunity {
  ticker: string
  name?: string
  sector?: string
  direction?: string
  conviction?: number
  time_horizon?: 'court' | 'moyen' | 'long' | null
  thesis?: string
  signals?: string[]
  catalysts?: string[]
  risks?: string[]
  price_current?: number | null
  price_target?: number | null
  gain_potential_pct?: number | null
  price_range_min?: number | null
  price_range_max?: number | null
  valuation?: Valuation | null
  entry_zone_fcfa?: string | null
  invalidation?: string | null
}

function formatFcfa(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' FCFA'
}

function formatPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

function formatNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function OpportunityCard({ opp, signalPrice }: { opp: Opportunity; signalPrice?: number | null }) {
  const dir = DIRECTION_META[opp.direction ?? 'watch'] ?? DIRECTION_META.watch
  const Icon = dir.icon
  const conviction = Math.max(1, Math.min(5, opp.conviction ?? 3))

  // Gain potentiel : couleur selon signe
  const gain = opp.gain_potential_pct
  const gainColor =
    gain == null ? 'text-[var(--color-fg-muted)]'
    : gain >= 0   ? 'text-[var(--color-success)]'
    :               'text-[var(--color-danger)]'

  // Bloc prix affiché seulement si au moins une valeur présente
  const hasPriceBlock =
    opp.price_current != null || opp.price_target != null || opp.gain_potential_pct != null

  // Bloc valuation
  const v = opp.valuation ?? {}
  const hasValuation =
    v.dpa_current != null || v.dpa_estimate != null ||
    v.p_b_current != null || v.p_b_estimate != null ||
    v.per_current != null || v.per_estimate != null ||
    v.dividend_yield_current != null || v.dividend_yield_estimate != null

  // Range d'entrée
  const hasRange = opp.price_range_min != null && opp.price_range_max != null

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface-2)]">
      <div className="px-4 py-3 flex items-start justify-between gap-4 border-b border-[var(--color-border)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/tickers/${opp.ticker}`}
              className="text-base font-semibold text-[var(--color-fg)] hover:text-[var(--color-navy)] hover:underline"
            >
              {opp.ticker}
            </Link>
            {opp.name && (
              <span className="text-sm text-[var(--color-fg-muted)]">— {opp.name}</span>
            )}
            {opp.sector && (
              <Badge tone="neutral" size="sm">{opp.sector}</Badge>
            )}
          </div>
          {opp.time_horizon && (
            <div className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">
              Horizon : {opp.time_horizon}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge tone={dir.tone} size="md">
            <Icon size={12} className="inline-block mr-1 -mt-0.5" />
            {dir.label}
          </Badge>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={cn(
                  'text-[10px]',
                  n <= conviction ? 'text-[var(--color-gold-600)]' : 'text-[var(--color-border)]'
                )}
              >
                ★
              </span>
            ))}
            <span className="ml-1 text-[10px] text-[var(--color-fg-muted)]">{conviction}/5</span>
          </div>
        </div>
      </div>

      {/* Bloc prix / gain potentiel — le plus saillant */}
      {hasPriceBlock && (
        <div className="px-4 py-3 grid grid-cols-3 gap-3 border-b border-[var(--color-border)] bg-[var(--color-muted)]">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              Cours du jour
            </div>
            <div className="text-sm font-mono text-[var(--color-fg)]">{formatFcfa(opp.price_current)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              Cours cible
            </div>
            <div className="text-sm font-mono text-[var(--color-fg)]">{formatFcfa(opp.price_target)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              Gain potentiel
            </div>
            <div className={cn('text-base font-mono font-semibold', gainColor)}>{formatPct(gain)}</div>
          </div>
        </div>
      )}

      <div className="px-4 py-3 space-y-3">
        {opp.thesis && (
          <p className="text-sm text-[var(--color-fg)] leading-relaxed">{opp.thesis}</p>
        )}

        {/* Valuation table */}
        {hasValuation && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
              Ratios fondamentaux
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-[var(--color-border)] rounded-md overflow-hidden">
                <thead className="bg-[var(--color-muted)]">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-[var(--color-fg-muted)]">Ratio</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-[var(--color-fg-muted)]">Actuel</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-[var(--color-fg-muted)]">Estimé</th>
                  </tr>
                </thead>
                <tbody>
                  <ValuationRow label="DPA (FCFA)" current={v.dpa_current} estimate={v.dpa_estimate} fmt={formatNum} />
                  <ValuationRow label="P/B" current={v.p_b_current} estimate={v.p_b_estimate} fmt={formatNum} />
                  <ValuationRow label="PER" current={v.per_current} estimate={v.per_estimate} fmt={formatNum} />
                  <ValuationRow label="Rend. Dividende" current={v.dividend_yield_current} estimate={v.dividend_yield_estimate} fmt={(n) => formatPct(n, 2)} />
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(opp.signals?.length ?? 0) > 0 && (
          <DetailList label="Signaux" items={opp.signals ?? []} />
        )}
        {(opp.catalysts?.length ?? 0) > 0 && (
          <DetailList label="Catalyseurs" items={opp.catalysts ?? []} />
        )}
        {(opp.risks?.length ?? 0) > 0 && (
          <DetailList label="Risques" items={opp.risks ?? []} tone="danger" />
        )}
        {(hasRange || opp.entry_zone_fcfa || opp.invalidation || signalPrice != null) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)]">
            {hasRange ? (
              <KV label="Zone d'entrée" value={`${formatFcfa(opp.price_range_min)} — ${formatFcfa(opp.price_range_max)}`} />
            ) : opp.entry_zone_fcfa ? (
              <KV label="Zone d'entrée" value={opp.entry_zone_fcfa} />
            ) : null}
            {opp.invalidation && (
              <KV label="Invalidation" value={opp.invalidation} />
            )}
            {signalPrice != null && (
              <KV label="Prix au signal" value={formatFcfa(signalPrice)} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ValuationRow({
  label, current, estimate, fmt,
}: {
  label: string
  current: number | null | undefined
  estimate: number | null | undefined
  fmt: (n: number | null | undefined) => string
}) {
  if (current == null && estimate == null) return null
  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-2 py-1.5 text-[var(--color-fg)]">{label}</td>
      <td className="px-2 py-1.5 text-right font-mono text-[var(--color-fg)]">{fmt(current)}</td>
      <td className="px-2 py-1.5 text-right font-mono text-[var(--color-fg-muted)]">{fmt(estimate)}</td>
    </tr>
  )
}

function DetailList({ label, items, tone = 'neutral' }: { label: string; items: string[]; tone?: 'neutral' | 'danger' }) {
  const iconColor = tone === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg-muted)]'
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
        {label}
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-[var(--color-fg)] flex gap-2">
            <span className={cn('shrink-0', iconColor)}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-0.5">
        {label}
      </div>
      <div className="text-sm font-mono text-[var(--color-fg)]">{value}</div>
    </div>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}

// --- Page -------------------------------------------------------------------

export function BriefDetailPage() {
  const { id } = useParams<{ id: string }>()
  const briefId = id ? parseInt(id, 10) : NaN
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [rawExpanded, setRawExpanded] = useState(false)
  const [redeliverOpen, setRedeliverOpen] = useState(false)

  const { data: brief, isLoading, error, refetch } = useQuery<BriefDetail>({
    queryKey: ['brief', briefId],
    queryFn: () => apiFetch<BriefDetail>(`/api/briefs/${briefId}`),
    enabled: !isNaN(briefId),
  })

  const redeliver = useMutation<RedeliverResult, Error, RedeliverTarget[] | null>({
    mutationFn: (recipients) =>
      apiFetch<RedeliverResult>(`/api/briefs/${briefId}/redeliver`, {
        method: 'POST',
        body: recipients ? { recipients } : undefined,
      }),
    onSuccess: (r, recipients) => {
      const isTargeted = recipients !== null
      if (r.status === 'delivered') {
        toast.success(
          isTargeted
            ? `Envoyé à ${r.sent_to.length} destinataire${r.sent_to.length > 1 ? 's' : ''}`
            : 'Brief re-livré avec succès',
        )
      } else if (r.status === 'partial') {
        toast.warning('Livraison partielle', { description: r.errors.join(' · ') })
      } else {
        toast.error('Échec de la re-livraison', { description: r.errors.join(' · ') })
      }
      setRedeliverOpen(false)
      // En mode ciblé le statut du brief n'a pas changé — pas la peine d'invalider.
      if (!isTargeted) {
        qc.invalidateQueries({ queryKey: ['brief', briefId] })
        qc.invalidateQueries({ queryKey: ['briefs'] })
      }
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : (err as Error).message
      toast.error('Re-livraison impossible', { description: msg })
    },
  })

  if (isLoading) {
    return (
      <>
        <PageHeader title="Détail du brief" subtitle="Chargement…" />
        <PageContent>
          <Card><CardBody><p className="text-sm text-[var(--color-fg-subtle)]">Chargement…</p></CardBody></Card>
        </PageContent>
      </>
    )
  }

  if (error || !brief) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <>
        <PageHeader title="Détail du brief" subtitle="Erreur de chargement" />
        <PageContent>
          <Card>
            <CardBody className="text-center py-10">
              <AlertTriangle size={24} className="mx-auto text-[var(--color-danger)] mb-3" />
              <p className="text-sm text-[var(--color-fg)]">
                {notFound ? `Brief #${briefId} introuvable.` : ((error as Error)?.message ?? 'Erreur inconnue')}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/briefs')}>
                <ArrowLeft size={14} /> Retour à la liste
              </Button>
            </CardBody>
          </Card>
        </PageContent>
      </>
    )
  }

  const isWeekly = brief.brief_type === 'weekly'
  const payload = (brief.payload ?? {}) as {
    market_summary?: string
    market_regime?: string | null
    opportunities?: Opportunity[]
    alerts?: string[]
    watchlist_updates?: string[]
    skip_reasons?: string
  }
  const opportunities = payload.opportunities ?? []
  const alerts = payload.alerts ?? []
  const watchlist = payload.watchlist_updates ?? []
  const signalPriceByTicker = new Map<string, number | null>(
    brief.signals.map((s) => [s.ticker, s.price_at_signal])
  )
  const canRedeliver =
    brief.delivery_status !== 'delivered' &&
    brief.delivery_status !== 'failed_synth'

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span>{isWeekly ? 'Brief hebdo' : 'Brief'} #{brief.id}</span>
            {isWeekly && (
              <Badge tone="navy" size="md">Hebdomadaire</Badge>
            )}
            {brief.revision > 1 && (
              <Badge tone="warning" size="md">Révision {brief.revision}</Badge>
            )}
            <DeliveryBadge status={brief.delivery_status} />
          </span>
        }
        subtitle={formatDateOnly(brief.brief_date)}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/briefs')}>
              <ArrowLeft size={14} /> Liste
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Rafraîchir
            </Button>
            {brief.payload_alt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/briefs/${brief.id}/compare`)}
                title="Comparer la version Opus vs la version alternative"
              >
                Comparer A/B
              </Button>
            )}
            <Button
              variant={canRedeliver ? 'primary' : 'outline'}
              size="sm"
              disabled={redeliver.isPending}
              onClick={() => setRedeliverOpen(true)}
              title={
                canRedeliver
                  ? 'Renvoyer le brief (tous les actifs ou cible personnalisée)'
                  : 'Renvoyer à des destinataires spécifiques (ad-hoc)'
              }
            >
              <RotateCw size={14} className={cn(redeliver.isPending && 'animate-spin')} />
              {redeliver.isPending ? 'Livraison…' : 'Rejouer la livraison'}
            </Button>
          </>
        }
      />

      <PageContent>
        {/* Overview */}
        <Card>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <Meta label="Date">
                <span className="text-sm font-mono text-[var(--color-fg)]">{formatDateOnly(brief.brief_date)}</span>
              </Meta>
              <Meta label="Révision">
                <span className="text-sm font-mono text-[var(--color-fg)]">
                  {brief.revision}
                  {brief.revised_at && (
                    <span className="text-[var(--color-fg-muted)]"> · maj {formatDateTime(brief.revised_at)}</span>
                  )}
                </span>
              </Meta>
              <Meta label="Livraison">
                <DeliveryBadge status={brief.delivery_status} />
              </Meta>
              <Meta label="Canaux">
                <div className="flex gap-1.5">
                  <Badge tone={brief.email_sent ? 'success' : 'neutral'} size="sm">
                    {brief.email_sent ? <CheckCircle2 size={11} className="inline mr-1" /> : null}
                    Email
                  </Badge>
                  <Badge tone={brief.whatsapp_sent ? 'success' : 'neutral'} size="sm">
                    {brief.whatsapp_sent ? <CheckCircle2 size={11} className="inline mr-1" /> : null}
                    WhatsApp
                  </Badge>
                </div>
              </Meta>
            </div>
            {brief.delivery_errors && (
              <div className="mt-4 p-3 rounded-md bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-[var(--color-danger)] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-danger)] mb-1">
                      Erreurs de livraison
                    </div>
                    <div className="text-xs text-[var(--color-fg)] font-mono break-all">
                      {brief.delivery_errors}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {isWeekly ? (
          /* Vue weekly : scorecard + plays + news + week ahead */
          <WeeklyBriefView payload={brief.payload as WeeklyPayload} />
        ) : (
          <>
            {/* Market summary */}
            {payload.market_summary && (
              <Card>
                <CardHeader>
                  <CardTitle>Analyse de séance</CardTitle>
                </CardHeader>
                <CardBody className="pt-2">
                  <p className="text-sm text-[var(--color-fg)] leading-relaxed whitespace-pre-wrap">
                    {payload.market_summary}
                  </p>
                </CardBody>
              </Card>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-[var(--color-danger)]" />
                    Alertes ({alerts.length})
                  </CardTitle>
                </CardHeader>
                <CardBody className="pt-2">
                  <ul className="space-y-2">
                    {alerts.map((a, i) => (
                      <li key={i} className="text-sm text-[var(--color-fg)] flex gap-2">
                        <span className="text-[var(--color-danger)] shrink-0">⚠</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}

            {/* Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Opportunités <span className="text-[var(--color-fg-muted)] font-normal">({opportunities.length})</span>
                </CardTitle>
              </CardHeader>
              <CardBody className="pt-2 space-y-3">
                {opportunities.length === 0 ? (
                  <p className="text-sm text-[var(--color-fg-subtle)]">
                    Aucune opportunité identifiée pour ce brief.
                  </p>
                ) : (
                  opportunities.map((opp) => (
                    <OpportunityCard
                      key={`${opp.ticker}-${opp.direction}`}
                      opp={opp}
                      signalPrice={signalPriceByTicker.get(opp.ticker)}
                    />
                  ))
                )}
              </CardBody>
            </Card>

            {/* Watchlist updates */}
            {watchlist.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Watchlist — mises à jour</CardTitle>
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

            {/* Skip reasons (si synthèse dégradée) */}
            {payload.skip_reasons && (
              <Card>
                <CardHeader>
                  <CardTitle>Raisons de skip</CardTitle>
                </CardHeader>
                <CardBody className="pt-2">
                  <p className="text-sm text-[var(--color-fg)] leading-relaxed whitespace-pre-wrap">
                    {payload.skip_reasons}
                  </p>
                </CardBody>
              </Card>
            )}
          </>
        )}

        {/* Raw payload (debug) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Payload brut (JSON Opus)</span>
              <button
                type="button"
                onClick={() => setRawExpanded(!rawExpanded)}
                className="text-[11px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                {rawExpanded ? 'Masquer' : 'Afficher'}
              </button>
            </CardTitle>
          </CardHeader>
          {rawExpanded && (
            <CardBody className="pt-0">
              <pre className="font-mono text-[11px] leading-relaxed text-[var(--color-fg)] bg-[var(--color-surface-2)] rounded-md p-4 overflow-x-auto border border-[var(--color-border)]">
                {JSON.stringify(brief.payload, null, 2)}
              </pre>
            </CardBody>
          )}
        </Card>
      </PageContent>

      <RedeliverDialog
        open={redeliverOpen}
        onOpenChange={setRedeliverOpen}
        loading={redeliver.isPending}
        onConfirm={(targets) => redeliver.mutate(targets)}
      />
    </>
  )
}
