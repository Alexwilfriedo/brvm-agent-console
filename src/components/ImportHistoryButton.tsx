import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { API_BASE, ApiError } from '@/lib/api'
import { getJwt, getAdminToken, clearSession } from '@/features/auth/token'

interface ImportResult {
  ticker: string
  inserted: number
  updated: number
  skipped: number
  total_rows_in_file: number
  earliest_date: string | null
  latest_date: string | null
  detected_delimiter: string
  detected_columns: Record<string, string>
  errors: string[]
}

interface Props {
  ticker: string
}

/**
 * Bouton "Importer historique CSV" — upload multipart vers
 * `POST /api/market/tickers/{ticker}/import`.
 *
 * `apiFetch` fait du JSON uniquement, donc on gère le fetch à la main ici.
 * L'auth (JWT ou admin token) est reprise via les helpers de token.ts.
 */
export function ImportHistoryButton({ ticker }: Props) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)

    const headers: Record<string, string> = {}
    const jwt = getJwt()
    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`
    } else {
      const admin = getAdminToken()
      if (admin) headers['X-Admin-Token'] = admin
    }

    try {
      const resp = await fetch(
        `${API_BASE}/api/market/tickers/${ticker}/import`,
        { method: 'POST', headers, body: form },
      )
      if (resp.status === 401) {
        clearSession()
        throw new ApiError(401, 'Session invalide — reconnecte-toi.')
      }
      const text = await resp.text()
      let parsed: unknown = null
      try {
        parsed = text ? JSON.parse(text) : null
      } catch {
        parsed = text
      }
      if (!resp.ok) {
        let msg = `HTTP ${resp.status}`
        if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
          const d = (parsed as { detail: unknown }).detail
          msg = typeof d === 'string' ? d : JSON.stringify(d)
        }
        throw new ApiError(resp.status, msg, parsed)
      }
      const result = parsed as ImportResult
      const dateRange =
        result.earliest_date && result.latest_date
          ? `${new Date(result.earliest_date).toLocaleDateString('fr-FR')} → ${new Date(result.latest_date).toLocaleDateString('fr-FR')}`
          : ''
      const parts: string[] = []
      if (result.inserted > 0) parts.push(`${result.inserted} ajoutée(s)`)
      if (result.updated > 0) parts.push(`${result.updated} mise(s) à jour`)
      if (result.skipped > 0) parts.push(`${result.skipped} ignorée(s)`)

      toast.success('Historique importé', {
        description: [parts.join(', '), dateRange].filter(Boolean).join(' · '),
        duration: 6000,
      })
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} ligne(s) avec erreur`, {
          description: result.errors.slice(0, 3).join(' · ') + (result.errors.length > 3 ? '…' : ''),
          duration: 8000,
        })
      }
      // Rafraîchit le graphe + les features techniques + les analyses
      qc.invalidateQueries({ queryKey: ['market'] })
      qc.invalidateQueries({ queryKey: ['investment-analyses'] })
    } catch (err) {
      const msg = (err as Error).message || 'Échec de l\'import'
      toast.error('Import impossible', { description: msg, duration: 8000 })
    } finally {
      setUploading(false)
      // Reset le input pour pouvoir re-uploader le même fichier si besoin
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        title="Uploader un CSV d'historique pour backfiller les cotations"
      >
        {uploading ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Import…
          </>
        ) : (
          <>
            <Upload size={14} /> Importer historique
          </>
        )}
      </Button>
    </>
  )
}
