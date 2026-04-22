import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from './api'
import { useDebounce } from './useDebounce'
import type { PaginatedResponse } from './types'

interface Options {
  /** Préfixe (ex: "briefs", "runs") — utilisé pour la cache key */
  resource: string
  /** Path de base (ex: "/api/briefs") */
  path: string
  /** Filtres strict supplémentaires (ex: {status: 'failed'}) */
  filters?: Record<string, string | undefined>
  /** Taille de page par défaut */
  pageSize?: number
  /** Intervalle de refetch (ms), par défaut désactivé */
  refetchInterval?: number
}

/**
 * Gestion complète d'une liste paginée + recherche fuzzy.
 *
 * Usage :
 *   const t = useListQuery<BriefSummary>({ resource: 'briefs', path: '/api/briefs' })
 *   <DataTable rows={t.data.items} total={t.data.total} ... {...t.tableProps} />
 */
export function useListQuery<T>({
  resource,
  path,
  filters = {},
  pageSize = 10,
  refetchInterval,
}: Options) {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(pageSize)
  const debouncedSearch = useDebounce(search, 300)

  // Reset offset quand search/filters changent (sinon on reste sur une page vide)
  const filterKey = JSON.stringify(filters)

  const query = useQuery({
    queryKey: [resource, { q: debouncedSearch, limit, offset, ...filters }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      if (debouncedSearch) params.set('q', debouncedSearch)
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v)
      }
      return apiFetch<PaginatedResponse<T>>(`${path}?${params}`)
    },
    placeholderData: keepPreviousData,
    refetchInterval,
  })

  function changeSearch(q: string) {
    setSearch(q)
    setOffset(0)
  }

  function changeLimit(n: number) {
    setLimit(n)
    setOffset(0)
  }

  // Reset offset si la clé des filtres change
  useResetOnChange(filterKey, () => setOffset(0))

  return {
    data: query.data ?? { items: [] as T[], total: 0, limit, offset },
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    tableProps: {
      total: query.data?.total ?? 0,
      limit,
      offset,
      onOffsetChange: setOffset,
      onLimitChange: changeLimit,
      search,
      onSearchChange: changeSearch,
    },
  }
}

function useResetOnChange(key: string, fn: () => void) {
  // Mini hook : fn() au premier render de chaque nouvelle key
  const [prev, setPrev] = useState(key)
  if (prev !== key) {
    setPrev(key)
    fn()
  }
}
