import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select'
import { cn } from '@/lib/cn'

export interface Column<T> {
  /** Identifiant stable pour les keys React */
  key: string
  /** En-tête de colonne */
  header: ReactNode
  /** Rendu d'une cellule */
  cell: (row: T) => ReactNode
  /** Largeur fixe / min optionnelle (Tailwind: w-24, min-w-32, etc.) */
  width?: string
  /** Aligne à droite (ex: nombres) */
  align?: 'left' | 'right' | 'center'
  /** Applique font-mono sur la colonne */
  mono?: boolean
  /** Masque la colonne en mobile */
  hideOnMobile?: boolean
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  total: number
  limit: number
  offset: number
  onOffsetChange: (offset: number) => void
  onLimitChange?: (limit: number) => void
  search?: string
  onSearchChange?: (q: string) => void
  searchPlaceholder?: string
  loading?: boolean
  error?: Error | null
  emptyMessage?: string
  onRowClick?: (row: T) => void
  actions?: ReactNode
}

const PAGE_SIZES = [10, 25, 50, 100, 200]

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  total,
  limit,
  offset,
  onOffsetChange,
  onLimitChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  loading = false,
  error = null,
  emptyMessage = 'Aucun résultat.',
  onRowClick,
  actions,
}: DataTableProps<T>) {
  const startIdx = total === 0 ? 0 : offset + 1
  const endIdx = Math.min(offset + limit, total)
  const canPrev = offset > 0
  const canNext = endIdx < total

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)] pointer-events-none"
            />
            <input
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border-0 bg-transparent pl-8 pr-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
            />
          </div>
        )}
        <div className="flex-1" />
        {actions}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-2)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-fg-muted)]',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.align !== 'right' && c.align !== 'center' && 'text-left',
                    c.hideOnMobile && 'hidden md:table-cell',
                    c.width
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-[var(--color-fg-subtle)]"
                >
                  <Loader2 size={18} className="inline-block mr-2 animate-spin" />
                  Chargement…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center">
                  <div className="text-sm text-[var(--color-danger)]">
                    Erreur de chargement : {error.message}
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-14 text-center text-[var(--color-fg-subtle)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-t border-[var(--color-border)] transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-[var(--color-surface-2)]'
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-5 py-3.5 align-middle',
                        c.align === 'right' && 'text-right',
                        c.align === 'center' && 'text-center',
                        c.mono && 'font-mono text-[13px]',
                        c.hideOnMobile && 'hidden md:table-cell'
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-[var(--color-border)] text-xs text-[var(--color-fg-muted)]">
        <div className="flex items-center gap-3">
          {total > 0 ? (
            <span>
              <span className="font-mono font-semibold text-[var(--color-fg)]">
                {startIdx}–{endIdx}
              </span>
              {' sur '}
              <span className="font-mono font-semibold text-[var(--color-fg)]">{total}</span>
            </span>
          ) : (
            <span>0 résultat</span>
          )}
          {onLimitChange && (
            <div className="w-28">
              <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={!canPrev || loading}
            onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            aria-label="Page précédente"
          >
            <ChevronLeft size={14} />
            Précédent
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canNext || loading}
            onClick={() => onOffsetChange(offset + limit)}
            aria-label="Page suivante"
          >
            Suivant
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}
