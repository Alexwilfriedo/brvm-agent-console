import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, RefreshCw, Power, ExternalLink, AlertTriangle, CheckCircle2,
  Clock, Database as DbIcon, Copy,
} from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { apiFetch } from '@/lib/api'
import type { Source } from '@/lib/types'
import { cn } from '@/lib/cn'

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Jamais'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

const TYPE_LABELS: Record<string, string> = {
  brvm_official: 'BRVM officiel',
  sika_finance: 'Sika Finance',
  rss: 'RSS générique',
}

function formatType(t: string): string {
  return TYPE_LABELS[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function SourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()

  const src = useQuery({
    queryKey: ['sources', id],
    queryFn: () => apiFetch<Source>(`/api/sources/${id}`),
  })

  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch<Source>(`/api/sources/${id}`, { method: 'PATCH', body: { enabled } }),
    onSuccess: (updated) => {
      toast.success(updated.enabled ? 'Source activée' : 'Source désactivée')
      qc.invalidateQueries({ queryKey: ['sources'] })
    },
    onError: (err) => toast.error('Échec', { description: (err as Error).message }),
  })

  if (src.isLoading) {
    return <>
      <PageHeader title="Source" subtitle="Chargement…" />
      <PageContent><Card><CardBody className="text-center py-10">…</CardBody></Card></PageContent>
    </>
  }

  if (src.error || !src.data) {
    return <>
      <PageHeader title="Source introuvable" />
      <PageContent>
        <Card>
          <CardBody className="text-center py-10">
            <AlertTriangle size={28} className="mx-auto text-[var(--color-danger)] mb-3" />
            <p className="text-sm text-[var(--color-fg)]">Cette source n'existe pas ou plus.</p>
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate('/sources')}>
              <ArrowLeft size={14} /> Retour à la liste
            </Button>
          </CardBody>
        </Card>
      </PageContent>
    </>
  }

  const s = src.data
  const hasError = s.last_status === 'error' && s.last_error

  async function onToggle() {
    if (s.enabled) {
      const ok = await confirm({
        title: 'Désactiver cette source ?',
        description: (
          <>
            <span className="font-medium text-[var(--color-fg)]">{s.name}</span> ne sera plus
            collectée lors des prochains runs jusqu'à réactivation.
          </>
        ),
        confirmLabel: 'Désactiver',
        tone: 'danger',
      })
      if (!ok) return
    }
    toggle.mutate(!s.enabled)
  }

  function copyError() {
    if (!s.last_error) return
    navigator.clipboard.writeText(s.last_error)
    toast.success('Erreur copiée dans le presse-papier')
  }

  return (
    <>
      <PageHeader
        title={s.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-[var(--color-fg-muted)]">{s.key}</span>
            <span className="text-[var(--color-fg-subtle)]">·</span>
            <Badge tone="neutral">{formatType(s.type)}</Badge>
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/sources')}>
              <ArrowLeft size={14} /> Liste
            </Button>
            <Button variant="outline" size="sm" onClick={() => src.refetch()} disabled={src.isFetching}>
              <RefreshCw size={14} className={src.isFetching ? 'animate-spin' : ''} />
              Rafraîchir
            </Button>
            <Button
              variant={s.enabled ? 'outline' : 'primary'}
              size="sm"
              onClick={onToggle}
              disabled={toggle.isPending}
            >
              <Power size={14} />
              {s.enabled ? 'Désactiver' : 'Activer'}
            </Button>
          </>
        }
      />

      <PageContent>
        {/* Overview */}
        <Card>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <Meta label="État">
                {s.enabled ? <Badge tone="success">Actif</Badge> : <Badge tone="neutral">Désactivé</Badge>}
              </Meta>
              <Meta label="Dernier statut">
                {s.last_status === 'ok' ? (
                  <Badge tone="success"><CheckCircle2 size={11} /> OK</Badge>
                ) : s.last_status === 'error' ? (
                  <Badge tone="danger"><AlertTriangle size={11} /> Erreur</Badge>
                ) : (
                  <span className="text-[var(--color-fg-subtle)] text-sm">Jamais collectée</span>
                )}
              </Meta>
              <Meta label="Dernière collecte">
                <span className="text-sm font-mono text-[var(--color-fg)] inline-flex items-center gap-1.5">
                  <Clock size={12} className="text-[var(--color-fg-muted)]" />
                  {formatDateTime(s.last_collected_at)}
                </span>
              </Meta>
              <Meta label="Créée le">
                <span className="text-sm font-mono text-[var(--color-fg)]">
                  {formatDateTime(s.created_at)}
                </span>
              </Meta>
              <Meta label="URL" className="md:col-span-4">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-mono text-[var(--color-navy)] hover:underline inline-flex items-center gap-1.5 break-all"
                >
                  {s.url}
                  <ExternalLink size={11} className="flex-none" />
                </a>
              </Meta>
            </div>
          </CardBody>
        </Card>

        {/* Dernière erreur de collecte */}
        {hasError && (
          <Card className={cn('border-[var(--color-danger)]/30')}>
            <CardHeader>
              <CardTitle className="text-[var(--color-danger)] flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle size={12} />
                  Dernière erreur de collecte
                </span>
                <button
                  type="button"
                  onClick={copyError}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                >
                  <Copy size={11} /> Copier
                </button>
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <pre className="font-mono text-[12px] leading-relaxed text-[var(--color-danger)] bg-[var(--color-danger-bg)] rounded-md p-4 overflow-x-auto whitespace-pre-wrap break-words">
                {s.last_error}
              </pre>
              <p className="mt-3 text-xs text-[var(--color-fg-muted)]">
                Cette erreur a été enregistrée lors de la dernière tentative de collecte
                ({formatDateTime(s.last_collected_at)}). Elle sera remplacée au prochain run si la
                source répond correctement.
              </p>
            </CardBody>
          </Card>
        )}

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DbIcon size={12} /> Configuration
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            {Object.keys(s.config).length === 0 ? (
              <p className="text-sm text-[var(--color-fg-subtle)]">
                Aucune configuration supplémentaire pour cette source.
              </p>
            ) : (
              <pre className="font-mono text-[12px] leading-relaxed text-[var(--color-fg)] bg-[var(--color-surface-2)] rounded-md p-4 overflow-x-auto border border-[var(--color-border)]">
                {JSON.stringify(s.config, null, 2)}
              </pre>
            )}
          </CardBody>
        </Card>
      </PageContent>
    </>
  )
}

function Meta({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
