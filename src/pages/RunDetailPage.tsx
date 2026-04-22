import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, AlertTriangle,
  Download, Upload, Database, Sparkles, Send, Radio, ChevronRight, Copy, ExternalLink,
  RotateCw, Inbox,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { apiFetch, ApiError } from '@/lib/api'
import type {
  BriefDetail, DeliveryStatus, PipelineRun, RedeliverResult, RunSource, RunStatus,
} from '@/lib/types'
import { cn } from '@/lib/cn'
import { LiveRunView } from '@/features/runs/LiveRunView'

// --- Formatters -------------------------------------------------------------

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'en cours…'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const min = Math.floor(ms / 60_000)
  const sec = Math.round((ms % 60_000) / 1000)
  return `${min} min ${sec.toString().padStart(2, '0')} s`
}

// --- Step metadata ----------------------------------------------------------

interface StepDef {
  key: string
  label: string
  icon: typeof Download
  description?: (step: Record<string, unknown>) => string
}

const STEP_DEFS: Record<string, StepDef> = {
  collect: {
    key: 'collect',
    label: 'Collecte',
    icon: Download,
    description: (s) =>
      `${s.sources ?? 0} source(s) · ${s.news_count ?? 0} news · ${s.quotes_count ?? 0} cotations`,
  },
  persist: {
    key: 'persist',
    label: 'Persistance',
    icon: Database,
    description: (s) => `${s.new_news ?? 0} nouvelles news en base`,
  },
  enrich: {
    key: 'enrich',
    label: 'Enrichissement (Sonnet)',
    icon: Sparkles,
    description: (s) => `${s.count ?? 0} article(s) enrichi(s)`,
  },
  synthesize: {
    key: 'synthesize',
    label: 'Synthèse (Opus)',
    icon: Radio,
    description: (s) => `${s.opportunities ?? 0} opportunité(s) générée(s)`,
  },
  deliver: {
    key: 'deliver',
    label: 'Livraison',
    icon: Send,
    description: (s) => {
      const parts: string[] = []
      if (s.email_ok) parts.push('Email ✓')
      if (s.whatsapp_ok) parts.push('WhatsApp ✓')
      if (!s.email_ok && !s.whatsapp_ok) parts.push('aucune livraison')
      return parts.join(' · ')
    },
  },
}

// --- Status UI --------------------------------------------------------------

function StatusBadge({ status }: { status: RunStatus }) {
  switch (status) {
    case 'success':           return <Badge tone="success" size="md"><CheckCircle2 size={12} /> Réussi</Badge>
    case 'failed':            return <Badge tone="danger"  size="md"><XCircle size={12} /> Échec</Badge>
    case 'running':           return <Badge tone="gold"    size="md"><Clock size={12} /> En cours</Badge>
    case 'skipped_locked':    return <Badge tone="warning" size="md"><AlertTriangle size={12} /> Skippé (lock)</Badge>
    case 'already_generated': return <Badge tone="neutral" size="md"><CheckCircle2 size={12} /> Déjà généré</Badge>
    case 'no_data':           return <Badge tone="neutral" size="md"><Inbox size={12} /> Aucune donnée</Badge>
  }
}

function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  switch (status) {
    case 'delivered':
      return <Badge tone="success" size="md"><CheckCircle2 size={12} /> Livré</Badge>
    case 'partial':
      return <Badge tone="warning" size="md"><AlertTriangle size={12} /> Partiel</Badge>
    case 'failed':
      return <Badge tone="danger" size="md"><XCircle size={12} /> Échec</Badge>
    case 'pending':
      return <Badge tone="gold" size="md"><Clock size={12} /> En attente</Badge>
    case 'failed_synth':
      return <Badge tone="danger" size="md"><XCircle size={12} /> Synthèse en échec</Badge>
  }
}

/**
 * Carte "Livraison" — affichée quand le run a produit un brief.
 *
 * Montre l'état actuel de la livraison (email + whatsapp) et, si applicable,
 * propose de rejouer l'envoi. Le backend (`POST /api/briefs/:id/redeliver`)
 * ne touche qu'à la livraison : pas de nouvelle révision, pas de re-appel
 * Opus, pas de nouveau PipelineRun.
 *
 * Le bouton est caché pour les statuts `delivered` (rien à faire) et
 * `failed_synth` (payload stub, re-livrer n'a pas de sens — il faut
 * relancer le pipeline entier).
 */
function DeliverySection({
  brief,
  onRedeliver,
  redelivering,
}: {
  brief: BriefDetail
  onRedeliver: () => void
  redelivering: boolean
}) {
  const canRetry =
    brief.delivery_status === 'failed' ||
    brief.delivery_status === 'partial' ||
    brief.delivery_status === 'pending'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Livraison du brief #{brief.id}</span>
          <DeliveryBadge status={brief.delivery_status} />
        </CardTitle>
      </CardHeader>
      <CardBody className="pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-5 text-sm">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              Email
            </div>
            <div className="font-mono text-[var(--color-fg)]">
              {brief.email_sent ? '✓ envoyé' : '✗ non envoyé'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
              WhatsApp
            </div>
            <div className="font-mono text-[var(--color-fg)]">
              {brief.whatsapp_sent ? '✓ envoyé' : '— non configuré / non envoyé'}
            </div>
          </div>
        </div>

        {brief.delivery_errors && (
          <div className="rounded-md bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-danger)] mb-1">
              Dernière erreur
            </div>
            <div className="font-mono text-[12px] text-[var(--color-danger)] whitespace-pre-wrap break-all">
              {brief.delivery_errors}
            </div>
          </div>
        )}

        {canRetry && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-[var(--color-fg-muted)]">
              Rejoue uniquement l'envoi email + WhatsApp. Ne relance pas la
              synthèse Opus et ne crée pas de nouvelle révision.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={onRedeliver}
              disabled={redelivering}
            >
              <RotateCw size={14} className={cn(redelivering && 'animate-spin')} />
              {redelivering ? 'Envoi en cours…' : 'Rejouer la livraison'}
            </Button>
          </div>
        )}

        {brief.delivery_status === 'failed_synth' && (
          <p className="text-xs text-[var(--color-fg-muted)]">
            Le payload de synthèse est invalide (stub Opus). Re-livrer n'a pas
            de sens — il faut relancer le pipeline entier via la planification.
          </p>
        )}
      </CardBody>
    </Card>
  )
}

// --- Timeline step ----------------------------------------------------------

function hasStepError(step: Record<string, unknown>): boolean {
  if (Array.isArray(step.errors) && step.errors.length > 0) return true
  if (step.status === 'failed' || step.status === 'partial') return true
  return false
}

function StepItem({
  step,
  index,
  isLast,
}: {
  step: Record<string, unknown> & { step?: string }
  index: number
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const def = STEP_DEFS[step.step ?? '']
  const Icon = def?.icon ?? ChevronRight
  const label = def?.label ?? step.step ?? 'Étape inconnue'
  const desc = def?.description?.(step)
  const errored = hasStepError(step)

  return (
    <div className="relative flex gap-4">
      {/* Barre verticale connectante */}
      {!isLast && (
        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-[var(--color-border)]" aria-hidden />
      )}

      {/* Icône step */}
      <div
        className={cn(
          'relative flex-none w-8 h-8 rounded-full flex items-center justify-center border-2',
          errored
            ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger)]/30'
            : 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]/30'
        )}
      >
        <Icon size={14} />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0 pb-6">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left group"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[var(--color-fg-subtle)]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
                {errored && <Badge tone="danger">erreur</Badge>}
              </div>
              {desc && (
                <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{desc}</div>
              )}
            </div>
            <ChevronRight
              size={14}
              className={cn(
                'flex-none text-[var(--color-fg-subtle)] transition-transform',
                expanded && 'rotate-90'
              )}
            />
          </div>
        </button>

        {expanded && (
          <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden">
            {Array.isArray(step.errors) && step.errors.length > 0 && (
              <div className="px-4 py-3 bg-[var(--color-danger-bg)] border-b border-[var(--color-border)]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-danger)] mb-1">
                  Erreurs remontées
                </div>
                <ul className="text-xs text-[var(--color-danger)] font-mono space-y-1">
                  {(step.errors as string[]).map((e, i) => <li key={i}>· {e}</li>)}
                </ul>
              </div>
            )}
            <pre className="px-4 py-3 text-[11px] font-mono text-[var(--color-fg)] overflow-x-auto leading-relaxed">
              {JSON.stringify(step, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Main page --------------------------------------------------------------

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [rawExpanded, setRawExpanded] = useState(false)

  const queryClient = useQueryClient()

  const run = useQuery({
    queryKey: ['runs', id],
    queryFn: () => apiFetch<PipelineRun>(`/api/runs/${id}`),
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 3000 : false),
  })

  // Brief produit par ce run (si le run a atteint l'étape synthesize).
  // On utilise ce détail pour afficher l'état de livraison et conditionner
  // l'affichage du bouton "Rejouer la livraison".
  const briefId = run.data?.brief_id ?? null
  const brief = useQuery({
    queryKey: ['briefs', briefId],
    queryFn: () => apiFetch<BriefDetail>(`/api/briefs/${briefId}`),
    enabled: briefId !== null,
  })

  const redeliver = useMutation({
    mutationFn: () => apiFetch<RedeliverResult>(
      `/api/briefs/${briefId}/redeliver`,
      { method: 'POST' },
    ),
    onSuccess: (result) => {
      if (result.status === 'delivered') {
        toast.success('Brief renvoyé avec succès')
      } else if (result.status === 'partial') {
        toast.warning(`Livraison partielle : ${result.errors.join(' · ')}`)
      } else {
        toast.error(`Échec : ${result.errors.join(' · ')}`)
      }
      // Rafraîchit le brief (delivery_status mis à jour) et la liste de runs.
      queryClient.invalidateQueries({ queryKey: ['briefs', briefId] })
      queryClient.invalidateQueries({ queryKey: ['runs', id] })
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Erreur inconnue'
      toast.error(`Impossible de rejouer : ${msg}`)
    },
  })

  if (run.isLoading) {
    return (
      <>
        <PageHeader title="Exécution" subtitle="Chargement…" />
        <PageContent>
          <Card><CardBody><div className="py-10 text-center text-[var(--color-fg-subtle)]">…</div></CardBody></Card>
        </PageContent>
      </>
    )
  }

  if (run.error || !run.data) {
    return (
      <>
        <PageHeader title="Exécution introuvable" />
        <PageContent>
          <Card>
            <CardBody className="text-center py-10">
              <AlertTriangle size={28} className="mx-auto text-[var(--color-danger)] mb-3" />
              <p className="text-sm text-[var(--color-fg)]">Ce run n'existe pas ou plus.</p>
              <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate('/runs')}>
                <ArrowLeft size={14} /> Retour à la liste
              </Button>
            </CardBody>
          </Card>
        </PageContent>
      </>
    )
  }

  const r = run.data
  const summary = (r.summary ?? {}) as Record<string, unknown>
  const steps = Array.isArray(summary.steps) ? (summary.steps as Record<string, unknown>[]) : []

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(r, null, 2))
    toast.success('JSON copié dans le presse-papier')
  }

  return (
    <>
      <PageHeader
        title={`Run #${r.id}`}
        subtitle="Détail complet de l'exécution du pipeline."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/runs')}>
              <ArrowLeft size={14} /> Liste
            </Button>
            <Button variant="outline" size="sm" onClick={() => run.refetch()}>
              <Upload size={14} className="rotate-180" /> Rafraîchir
            </Button>
            <Button variant="ghost" size="sm" onClick={copyJson}>
              <Copy size={14} /> Copier JSON
            </Button>
          </>
        }
      />

      <PageContent>
        {/* Stream live (affiché en priorité tant que le run tourne) */}
        {r.status === 'running' && (
          <LiveRunView runId={r.id} enabled />
        )}

        {/* Overview */}
        <Card>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <Meta label="Statut">
                <StatusBadge status={r.status} />
              </Meta>
              <Meta label="Type">
                {r.pipeline_type === 'weekly' ? (
                  <Badge tone="navy">Hebdomadaire</Badge>
                ) : (
                  <Badge tone="neutral">Daily</Badge>
                )}
              </Meta>
              <Meta label="Trigger">
                <Badge tone="neutral">{r.trigger === 'cron' ? 'Cron automatique' : 'Manuel'}</Badge>
              </Meta>
              <Meta label="Démarré">
                <span className="text-sm font-mono text-[var(--color-fg)]">{formatDateTime(r.started_at)}</span>
              </Meta>
              <Meta label="Durée">
                <span className="text-sm font-mono text-[var(--color-fg)]">
                  {formatDuration(r.started_at, r.ended_at)}
                </span>
              </Meta>
              <Meta label="Terminé">
                <span className="text-sm font-mono text-[var(--color-fg)]">{formatDateTime(r.ended_at)}</span>
              </Meta>
              <Meta label="Brief produit">
                {r.brief_id ? (
                  <Link
                    to={`/briefs/${r.brief_id}`}
                    className="text-sm font-mono text-[var(--color-navy)] hover:underline inline-flex items-center gap-1"
                  >
                    #{r.brief_id} <ExternalLink size={11} />
                  </Link>
                ) : (
                  <span className="text-[var(--color-fg-subtle)]">—</span>
                )}
              </Meta>
              <Meta label="Étapes">
                <span className="text-sm font-mono text-[var(--color-fg)]">{steps.length}</span>
              </Meta>
              <Meta label="Opportunités">
                <span className="text-sm font-mono text-[var(--color-fg)]">
                  {(steps.find((s) => s.step === 'synthesize')?.opportunities as number | undefined) ?? 0}
                </span>
              </Meta>
            </div>
          </CardBody>
        </Card>

        {/* Livraison — affiché quand le run a produit un brief. Couvre le cas
            "le brief existe mais Brevo a timeout" → bouton de retry ciblé. */}
        {brief.data && (
          <DeliverySection
            brief={brief.data}
            onRedeliver={() => redeliver.mutate()}
            redelivering={redeliver.isPending}
          />
        )}

        {/* Erreur fatale */}
        {r.error && (
          <Card className="border-[var(--color-danger)]/30">
            <CardHeader>
              <CardTitle className="text-[var(--color-danger)] flex items-center gap-2">
                <AlertTriangle size={12} /> Erreur fatale
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <pre className="font-mono text-[12px] leading-relaxed text-[var(--color-danger)] bg-[var(--color-danger-bg)] rounded-md p-4 overflow-x-auto whitespace-pre-wrap">
                {r.error}
              </pre>
            </CardBody>
          </Card>
        )}

        {/* Timeline des étapes */}
        {steps.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Timeline des étapes</CardTitle>
            </CardHeader>
            <CardBody className="pt-2">
              <div className="mt-2">
                {steps.map((step, i) => (
                  <StepItem
                    key={i}
                    step={step}
                    index={i}
                    isLast={i === steps.length - 1}
                  />
                ))}
              </div>
            </CardBody>
          </Card>
        ) : r.status === 'skipped_locked' ? (
          <Card>
            <CardBody className="text-center py-8">
              <AlertTriangle size={20} className="mx-auto text-[var(--color-warning)] mb-2" />
              <p className="text-sm text-[var(--color-fg)]">
                Run skippé : un autre run était déjà en cours (lock Postgres actif).
              </p>
            </CardBody>
          </Card>
        ) : null}

        {/* Recap par source */}
        {(r.status === 'success' || r.status === 'failed') && (
          <BySourceSection runId={r.id} />
        )}

        {/* Résumé brut (JSON) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Résumé brut (JSON)</span>
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
                {JSON.stringify(summary, null, 2)}
              </pre>
            </CardBody>
          )}
        </Card>
      </PageContent>
    </>
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

// --- Recap par source ------------------------------------------------------

const SOURCE_TYPE_LABELS: Record<string, string> = {
  brvm_official: 'BRVM officiel',
  sika_finance: 'Sika Finance (RSS)',
  sika_quotes: 'Sika cotations',
  sika_communiques: 'Sika communiqués (PDF)',
  rss: 'RSS',
}

function formatSourceType(t: string | null | undefined): string {
  if (!t) return '—'
  return SOURCE_TYPE_LABELS[t] ?? t
}

function BySourceSection({ runId }: { runId: number }) {
  const { data, isLoading, error } = useQuery<RunSource[]>({
    queryKey: ['run-sources', runId],
    queryFn: () => apiFetch<RunSource[]>(`/api/runs/${runId}/sources`),
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Par source</CardTitle></CardHeader>
        <CardBody><p className="text-sm text-[var(--color-fg-subtle)]">Chargement…</p></CardBody>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Par source</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-[var(--color-danger)]">
            Erreur : {(error as Error).message}
          </p>
        </CardBody>
      </Card>
    )
  }

  const sources = data ?? []
  if (sources.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Par source</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-[var(--color-fg-subtle)]">
            Pas de détail par source disponible pour ce run (antérieur à la mise
            en place du recap, ou pipeline skippé).
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Par source <span className="text-[var(--color-fg-muted)] font-normal">({sources.length})</span>
        </CardTitle>
      </CardHeader>
      <CardBody className="pt-2 space-y-3">
        {sources.map((src) => (
          <SourceCard key={src.source_key} src={src} />
        ))}
      </CardBody>
    </Card>
  )
}

function SourceCard({ src }: { src: RunSource }) {
  const [expanded, setExpanded] = useState(false)
  const hasErrors = src.errors.length > 0
  const hasNews = src.news.length > 0

  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-2)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-3)] transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronRight
            size={14}
            className={cn(
              'text-[var(--color-fg-muted)] transition-transform shrink-0',
              expanded && 'rotate-90'
            )}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--color-fg)] truncate">
              {src.source_name ?? src.source_key}
            </div>
            <div className="text-[11px] text-[var(--color-fg-muted)] font-mono truncate">
              {src.source_key} · {formatSourceType(src.source_type)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasErrors && (
            <Badge tone="danger" size="sm">
              {src.errors.length} erreur{src.errors.length > 1 ? 's' : ''}
            </Badge>
          )}
          <Badge tone="neutral" size="sm">
            {src.news_count} news
            {src.new_news_count > 0 && (
              <span className="ml-1 text-[var(--color-success)]">· {src.new_news_count} nouvelle{src.new_news_count > 1 ? 's' : ''}</span>
            )}
          </Badge>
          {src.quotes_count > 0 && (
            <Badge tone="neutral" size="sm">{src.quotes_count} cotations</Badge>
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[var(--color-border)] px-4 py-3 space-y-3">
          {hasErrors && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-danger)]">
                Erreurs de collecte
              </div>
              <ul className="text-xs text-[var(--color-fg)] space-y-1">
                {src.errors.map((e, i) => (
                  <li key={i} className="font-mono break-all">• {e}</li>
                ))}
              </ul>
            </div>
          )}
          {hasNews ? (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                Articles capturés ({src.news.length})
              </div>
              <ul className="divide-y divide-[var(--color-border)]">
                {src.news.map((n) => (
                  <li key={`${n.url}-${n.id}`} className="py-2 flex items-start gap-2">
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--color-fg)] hover:text-[var(--color-navy)] hover:underline inline-flex items-center gap-1 min-w-0 flex-1"
                    >
                      <span className="truncate">{n.title}</span>
                      <ExternalLink size={11} className="shrink-0" />
                    </a>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {n.tickers_mentioned.length > 0 && (
                        <span className="text-[10px] font-mono text-[var(--color-navy)]">
                          {n.tickers_mentioned.join(' · ')}
                        </span>
                      )}
                      {n.enriched ? (
                        <Badge tone="success" size="sm">enrichi</Badge>
                      ) : (
                        <Badge tone="neutral" size="sm">brut</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : !hasErrors ? (
            <p className="text-xs text-[var(--color-fg-subtle)]">
              Aucun article capturé dans ce run.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
