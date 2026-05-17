import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Upload, Play, Pause, X, CheckCircle2, AlertTriangle, Clock,
  FileText, Files, Database, Loader2,
} from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/Select'
import { API_BASE, ApiError, apiFetch } from '@/lib/api'
import { getJwt, getAdminToken, clearSession } from '@/features/auth/token'
import { cn } from '@/lib/cn'
import type {
  BackfillJob, BackfillJobDetail, BackfillItem, BackfillSourceType,
  BackfillJobStatus, BackfillItemStatus, PaginatedResponse,
} from '@/lib/types'

const STATUS_META: Record<BackfillJobStatus, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' | 'navy' }> = {
  running: { label: 'En cours', tone: 'navy' },
  paused: { label: 'En pause', tone: 'warning' },
  completed: { label: 'Terminé', tone: 'success' },
  failed: { label: 'Échec', tone: 'danger' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
}

const ITEM_STATUS_META: Record<BackfillItemStatus, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' | 'navy' }> = {
  pending: { label: 'En attente', tone: 'neutral' },
  processing: { label: 'En cours', tone: 'navy' },
  done: { label: 'OK', tone: 'success' },
  failed: { label: 'Erreur', tone: 'danger' },
  skipped: { label: 'Ignoré', tone: 'neutral' },
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `il y a ${diffD} j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// --- Query keys --------------------------------------------------------------

const backfillKeys = {
  list: ['backfill', 'list'] as const,
  detail: (id: number) => ['backfill', 'detail', id] as const,
}

// --- Page -------------------------------------------------------------------

export function BackfillPage() {
  const qc = useQueryClient()
  const [sourceType, setSourceType] = useState<BackfillSourceType>('pdf_brvm')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Liste globale — polling 3s dès qu'il y a au moins 1 job running
  const jobs = useQuery({
    queryKey: backfillKeys.list,
    queryFn: () =>
      apiFetch<PaginatedResponse<BackfillJob>>(`/api/backfill/jobs?limit=20`),
    refetchInterval: (q) => {
      const data = q.state.data as PaginatedResponse<BackfillJob> | undefined
      const hasActive = data?.items?.some((j) => j.status === 'running' || j.pause_requested)
      return hasActive ? 3000 : false
    },
  })

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      toast.error('Sélectionne au moins un fichier')
      return
    }
    setUploading(true)
    const form = new FormData()
    form.append('source_type', sourceType)
    for (const f of selectedFiles) form.append('files', f)

    const headers: Record<string, string> = {}
    const jwt = getJwt()
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`
    else {
      const admin = getAdminToken()
      if (admin) headers['X-Admin-Token'] = admin
    }

    try {
      const resp = await fetch(`${API_BASE}/api/backfill/jobs`, {
        method: 'POST', headers, body: form,
      })
      if (resp.status === 401) {
        clearSession()
        throw new ApiError(401, 'Session invalide')
      }
      const text = await resp.text()
      const parsed = text ? JSON.parse(text) : null
      if (!resp.ok) {
        let msg = `HTTP ${resp.status}`
        if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
          const d = (parsed as { detail: unknown }).detail
          msg = typeof d === 'string' ? d : JSON.stringify(d)
        }
        throw new ApiError(resp.status, msg, parsed)
      }
      const job = parsed as BackfillJob
      toast.success(`Job #${job.id} créé`, {
        description: `${job.total_items} fichier(s) en cours d'import.`,
      })
      setSelectedFiles([])
      if (inputRef.current) inputRef.current.value = ''
      qc.invalidateQueries({ queryKey: ['backfill'] })
      setExpandedJobId(job.id)
    } catch (err) {
      toast.error('Upload échoué', { description: (err as Error).message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Database size={18} className="text-[var(--color-gold)]" />
            Import historique
          </span>
        }
        subtitle="Backfill reprisable de cotations (bulletins BRVM PDF ou CSV par ticker). En cas d'interruption, le job passe automatiquement en pause et peut être repris."
      />

      <PageContent>
        {/* Upload zone */}
        <Card>
          <CardHeader>
            <CardTitle>Nouveau job d'import</CardTitle>
          </CardHeader>
          <CardBody className="pt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  Type de source
                </label>
                <Select
                  value={sourceType}
                  onValueChange={(v) => setSourceType(v as BackfillSourceType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf_brvm">Bulletins BRVM officiels (PDF)</SelectItem>
                    <SelectItem value="csv">Historiques par ticker (CSV, 1 fichier = 1 ticker)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-2 text-[11px] text-[var(--color-fg-subtle)]">
                  {sourceType === 'pdf_brvm' ? (
                    <>Chaque PDF = 1 séance BRVM. La date est extraite du texte ou du nom de fichier (ex: <code className="font-mono">boc_15_01_2024.pdf</code>).</>
                  ) : (
                    <>Chaque CSV = 1 ticker. Nom de fichier doit commencer par le code (ex: <code className="font-mono">SNTS_history.csv</code>). Colonnes minimales : <code className="font-mono">date</code>, <code className="font-mono">close</code>.</>
                  )}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                Fichiers
              </label>
              <div
                className={cn(
                  'border-2 border-dashed rounded-md p-6 text-center transition-colors',
                  'border-[var(--color-border)] hover:border-[var(--color-gold)]/60 bg-[var(--color-surface-2)]',
                )}
                onDragOver={(e) => { e.preventDefault() }}
                onDrop={(e) => {
                  e.preventDefault()
                  const dropped = Array.from(e.dataTransfer.files || [])
                  if (dropped.length > 0) setSelectedFiles((prev) => [...prev, ...dropped])
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={sourceType === 'pdf_brvm' ? '.pdf,application/pdf' : '.csv,text/csv,text/plain'}
                  className="hidden"
                  onChange={(e) => {
                    const chosen = Array.from(e.target.files || [])
                    if (chosen.length > 0) setSelectedFiles((prev) => [...prev, ...chosen])
                  }}
                />
                <Files size={28} className="mx-auto text-[var(--color-fg-subtle)] mb-2" />
                <p className="text-sm text-[var(--color-fg-muted)]">
                  Glisser-déposer des fichiers ici ou{' '}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="text-[var(--color-navy)] font-medium hover:underline"
                  >
                    parcourir
                  </button>
                </p>
                <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                  Max 2000 fichiers, 200 MB total.
                </p>
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="border border-[var(--color-border)] rounded-md">
                <div className="px-4 py-2 bg-[var(--color-surface-2)] border-b border-[var(--color-border)] flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--color-fg)]">
                    {selectedFiles.length} fichier(s) sélectionné(s)
                  </span>
                  <span className="text-[var(--color-fg-muted)]">
                    {fmtSize(selectedFiles.reduce((a, f) => a + f.size, 0))}
                  </span>
                </div>
                <ul className="max-h-40 overflow-y-auto divide-y divide-[var(--color-border)]">
                  {selectedFiles.slice(0, 50).map((f, i) => (
                    <li key={`${f.name}-${i}`} className="px-4 py-1.5 flex items-center gap-2 text-xs">
                      <FileText size={12} className="text-[var(--color-fg-subtle)]" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="font-mono text-[var(--color-fg-subtle)]">{fmtSize(f.size)}</span>
                      <button
                        onClick={() => setSelectedFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)]"
                        aria-label="Retirer"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                  {selectedFiles.length > 50 && (
                    <li className="px-4 py-1.5 text-[11px] text-[var(--color-fg-subtle)] italic">
                      … et {selectedFiles.length - 50} fichier(s) supplémentaire(s)
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {selectedFiles.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFiles([])}
                  disabled={uploading}
                >
                  Vider la liste
                </Button>
              )}
              <Button
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
              >
                {uploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Upload…
                  </>
                ) : (
                  <>
                    <Upload size={14} /> Lancer l'import ({selectedFiles.length})
                  </>
                )}
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Liste des jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs récents</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {jobs.isLoading ? (
              <div className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
                Chargement…
              </div>
            ) : (jobs.data?.items ?? []).length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
                Aucun job encore. Uploade des fichiers ci-dessus pour commencer.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {jobs.data!.items.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    expanded={expandedJobId === job.id}
                    onToggleExpand={() => setExpandedJobId((id) => (id === job.id ? null : job.id))}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </PageContent>
    </>
  )
}

// --- Job row --------------------------------------------------------------

function JobRow({
  job,
  expanded,
  onToggleExpand,
}: {
  job: BackfillJob
  expanded: boolean
  onToggleExpand: () => void
}) {
  const qc = useQueryClient()
  const meta = STATUS_META[job.status]
  const progress = job.total_items > 0 ? (job.processed_items / job.total_items) * 100 : 0

  // Detail (lazy) — load when expanded + poll while running
  const detail = useQuery({
    queryKey: backfillKeys.detail(job.id),
    queryFn: () => apiFetch<BackfillJobDetail>(`/api/backfill/jobs/${job.id}`),
    enabled: expanded,
    refetchInterval: expanded && (job.status === 'running' || job.pause_requested) ? 3000 : false,
  })

  const action = useMutation({
    mutationFn: ({ kind }: { kind: 'pause' | 'resume' | 'cancel' }) =>
      apiFetch<BackfillJob>(`/api/backfill/jobs/${job.id}/${kind}`, { method: 'POST' }),
    onSuccess: (_, variables) => {
      const labels = { pause: 'Pause demandée', resume: 'Reprise demandée', cancel: 'Job annulé' }
      toast.success(labels[variables.kind])
      qc.invalidateQueries({ queryKey: ['backfill'] })
    },
    onError: (err) =>
      toast.error('Action refusée', { description: (err as Error).message }),
  })

  const canPause = job.status === 'running' && !job.pause_requested
  const canResume = job.status === 'paused'
  const canCancel = job.status === 'running' || job.status === 'paused'

  return (
    <li>
      <div className="px-5 py-3 hover:bg-[var(--color-surface-2)] transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleExpand}
            className="font-mono text-sm text-[var(--color-navy)] font-semibold hover:underline"
          >
            #{job.id}
          </button>
          <Badge tone={meta.tone}>
            {job.status === 'running' && <Loader2 size={10} className="animate-spin" />}
            {meta.label}
            {job.pause_requested && job.status === 'running' && ' (pause…)'}
          </Badge>
          <Badge tone="neutral">
            {job.source_type === 'pdf_brvm' ? 'PDF BRVM' : 'CSV'}
          </Badge>
          <span className="text-[11px] text-[var(--color-fg-subtle)]">
            {formatRelative(job.created_at)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canPause && (
              <Button
                variant="outline" size="sm"
                onClick={() => action.mutate({ kind: 'pause' })}
                disabled={action.isPending}
              >
                <Pause size={12} /> Pause
              </Button>
            )}
            {canResume && (
              <Button
                variant="outline" size="sm"
                onClick={() => action.mutate({ kind: 'resume' })}
                disabled={action.isPending}
              >
                <Play size={12} /> Reprendre
              </Button>
            )}
            {canCancel && (
              <Button
                variant="ghost" size="sm"
                onClick={() => action.mutate({ kind: 'cancel' })}
                disabled={action.isPending}
              >
                <X size={12} /> Annuler
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                job.status === 'completed' && 'bg-[var(--color-success)]',
                job.status === 'failed' && 'bg-[var(--color-danger)]',
                (job.status === 'running' || job.status === 'paused') && 'bg-[var(--color-navy-solid)]',
                job.status === 'cancelled' && 'bg-[var(--color-fg-subtle)]',
              )}
              style={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
            />
          </div>
          <span className="font-mono text-xs text-[var(--color-fg-muted)] tabular-nums">
            {job.processed_items}/{job.total_items}
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-4 text-[11px] text-[var(--color-fg-subtle)]">
          <span><CheckCircle2 size={10} className="inline" /> {fmtInt(job.inserted_quotes)} insérées</span>
          <span>↻ {fmtInt(job.updated_quotes)} mises à jour</span>
          {job.failed_items > 0 && (
            <span className="text-[var(--color-danger)]">
              <AlertTriangle size={10} className="inline" /> {job.failed_items} erreur(s)
            </span>
          )}
          {job.requested_by && <span>par {job.requested_by}</span>}
        </div>

        {job.message && (
          <div className="mt-1.5 text-[11px] text-[var(--color-fg-muted)] italic line-clamp-2">
            {job.message}
          </div>
        )}
      </div>

      {expanded && detail.data && (
        <div className="px-5 pb-3 pt-0 bg-[var(--color-surface-2)]/50 border-t border-[var(--color-border)]">
          <ItemsList items={detail.data.items} />
        </div>
      )}
    </li>
  )
}

function ItemsList({ items }: { items: BackfillItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] max-h-96 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
          <tr>
            <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Fichier</th>
            <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Statut</th>
            <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Inséré</th>
            <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">MAJ</th>
            <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">Erreur</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const m = ITEM_STATUS_META[it.status]
            return (
              <tr key={it.id} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-1.5 font-mono truncate max-w-xs">
                  {it.filename}
                  {it.ticker_hint && (
                    <span className="ml-2 text-[var(--color-fg-subtle)]">({it.ticker_hint})</span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  <Badge tone={m.tone} size="sm">
                    {it.status === 'processing' && <Loader2 size={9} className="animate-spin" />}
                    {it.status === 'pending' && <Clock size={9} />}
                    {m.label}
                  </Badge>
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {it.inserted_quotes > 0 ? fmtInt(it.inserted_quotes) : '—'}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {it.updated_quotes > 0 ? fmtInt(it.updated_quotes) : '—'}
                </td>
                <td className="px-3 py-1.5 text-[var(--color-danger)] truncate max-w-md">
                  {it.error ? it.error.slice(0, 100) : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
