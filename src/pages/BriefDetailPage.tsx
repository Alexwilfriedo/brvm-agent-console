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
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { apiFetch, ApiError } from '@/lib/api'
import type { BriefDetail, DeliveryStatus, RedeliverResult } from '@/lib/types'
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

interface Opportunity {
  ticker: string
  name?: string
  direction?: string
  conviction?: number
  time_horizon?: 'court' | 'moyen' | 'long' | null
  thesis?: string
  signals?: string[]
  catalysts?: string[]
  risks?: string[]
  entry_zone_fcfa?: string | null
  invalidation?: string | null
}

function OpportunityCard({ opp, signalPrice }: { opp: Opportunity; signalPrice?: number | null }) {
  const dir = DIRECTION_META[opp.direction ?? 'watch'] ?? DIRECTION_META.watch
  const Icon = dir.icon
  const conviction = Math.max(1, Math.min(5, opp.conviction ?? 3))

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
      <div className="px-4 py-3 space-y-3">
        {opp.thesis && (
          <p className="text-sm text-[var(--color-fg)] leading-relaxed">{opp.thesis}</p>
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
        {(opp.entry_zone_fcfa || opp.invalidation || signalPrice !== undefined) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)]">
            {opp.entry_zone_fcfa && (
              <KV label="Zone d'entrée" value={opp.entry_zone_fcfa} />
            )}
            {opp.invalidation && (
              <KV label="Invalidation" value={opp.invalidation} />
            )}
            {signalPrice != null && (
              <KV label="Prix au signal" value={`${signalPrice.toLocaleString('fr-FR')} FCFA`} />
            )}
          </div>
        )}
      </div>
    </div>
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
  const confirm = useConfirm()
  const [rawExpanded, setRawExpanded] = useState(false)

  const { data: brief, isLoading, error, refetch } = useQuery<BriefDetail>({
    queryKey: ['brief', briefId],
    queryFn: () => apiFetch<BriefDetail>(`/api/briefs/${briefId}`),
    enabled: !isNaN(briefId),
  })

  const redeliver = useMutation<RedeliverResult>({
    mutationFn: () =>
      apiFetch<RedeliverResult>(`/api/briefs/${briefId}/redeliver`, { method: 'POST' }),
    onSuccess: (r) => {
      if (r.status === 'delivered') {
        toast.success('Brief re-livré avec succès')
      } else if (r.status === 'partial') {
        toast.warning('Livraison partielle', { description: r.errors.join(' · ') })
      } else {
        toast.error('Échec de la re-livraison', { description: r.errors.join(' · ') })
      }
      qc.invalidateQueries({ queryKey: ['brief', briefId] })
      qc.invalidateQueries({ queryKey: ['briefs'] })
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
            <span>Brief #{brief.id}</span>
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
            {canRedeliver && (
              <Button
                variant="primary"
                size="sm"
                disabled={redeliver.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Rejouer la livraison ?',
                    description: 'Email + WhatsApp seront renvoyés aux destinataires actifs. Ne relance pas la synthèse Opus.',
                    confirmLabel: 'Rejouer',
                  })
                  if (ok) redeliver.mutate()
                }}
              >
                <RotateCw size={14} className={cn(redeliver.isPending && 'animate-spin')} />
                {redeliver.isPending ? 'Livraison…' : 'Rejouer la livraison'}
              </Button>
            )}
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
    </>
  )
}
