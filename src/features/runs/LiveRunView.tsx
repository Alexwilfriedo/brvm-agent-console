import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { API_BASE } from '@/lib/api'
import { getAdminToken, getJwt } from '@/features/auth/token'

/**
 * Vue live d'un run en cours — stream SSE depuis /api/runs/:id/stream.
 *
 * Affiche :
 *  - Un "pool de workers" en haut : chaque thread actif et ce qu'il scrape
 *  - Un terminal log en bas : events colorés, horodatés, défilement auto
 */

// --- Types d'events émis par le backend ----------------------------------

interface BaseEvent {
  t: number  // timestamp float (time.time())
  event: string
  run_id: number
  [key: string]: unknown
}

// --- Palette par type d'event --------------------------------------------

const EVENT_STYLE: Record<string, { color: string; label: string }> = {
  'run.started':        { color: 'text-[var(--color-gold)]',    label: 'RUN'    },
  'run.done':           { color: 'text-[var(--color-gold)]',    label: 'RUN'    },
  'run.closed':         { color: 'text-[var(--color-fg-muted)]', label: 'RUN'    },
  'step.start':         { color: 'text-sky-400',                label: 'STEP'   },
  'step.done':          { color: 'text-sky-400',                label: 'STEP'   },
  'source.start':       { color: 'text-purple-400',             label: 'SOURCE' },
  'source.done':        { color: 'text-purple-400',             label: 'SOURCE' },
  'source.scrape_start':{ color: 'text-purple-400',             label: 'SCRAPE' },
  'ticker.start':       { color: 'text-[var(--color-fg-muted)]', label: 'TICKER' },
  'ticker.done':        { color: 'text-emerald-400',            label: 'TICKER' },
  'ticker.error':       { color: 'text-[var(--color-danger)]',  label: 'TICKER' },
  'article.start':      { color: 'text-[var(--color-fg-muted)]', label: 'ART'   },
  'article.done':       { color: 'text-emerald-400',            label: 'ART'    },
  'article.error':      { color: 'text-[var(--color-danger)]',  label: 'ART'    },
}

function fmtTime(t: number): string {
  const d = new Date(t * 1000)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function eventMessage(evt: BaseEvent): string {
  switch (evt.event) {
    case 'run.started':
      return `Run démarré (trigger=${evt.trigger})`
    case 'run.done':
      return `Run terminé · ${evt.status}${evt.brief_id ? ' · brief #' + evt.brief_id : ''}${evt.error ? ' · ' + evt.error : ''}`
    case 'run.closed':
      return 'Stream fermé.'
    case 'step.start':
      return `→ ${evt.step} démarré${evt.total ? ` (${evt.total} items)` : ''}`
    case 'step.done':
      return `✓ ${evt.step} terminé (${Object.entries(evt).filter(([k]) => !['t','event','run_id','step'].includes(k)).map(([k,v]) => `${k}=${v}`).join(' · ')})`
    case 'source.start':
      return `⟶ ${evt.source_key} (${evt.source_type})`
    case 'source.done':
      return `✓ ${evt.source_key} · news=${evt.news} quotes=${evt.quotes}${evt.errors && (evt.errors as string[]).length ? ' · erreurs=' + (evt.errors as string[]).length : ''}`
    case 'source.scrape_start':
      return `Scraping parallèle de ${evt.total_tickers} tickers avec ${evt.max_workers} workers`
    case 'ticker.start':
      return `[${evt.worker}] fetch ${evt.ticker}.${evt.country} · ${evt.name}`
    case 'ticker.done':
      return `[${evt.worker}] ${evt.ticker} · close=${evt.close_price} var=${(evt.variation_pct as number).toFixed(2)}% vol=${evt.volume}`
    case 'ticker.error':
      return `[${evt.worker}] ${evt.ticker} · ${evt.error}`
    case 'article.start':
      return `(${evt.index}/${evt.total}) enrich ${String(evt.title).slice(0, 60)}`
    case 'article.done': {
      const tickers = (evt.tickers as string[] | undefined)?.join(',') || '—'
      return `(${evt.index}) ${String(evt.title).slice(0, 60)} · tickers=${tickers} · mat=${evt.materiality ?? '—'}`
    }
    case 'article.error':
      return `(${evt.index}) ${String(evt.title).slice(0, 60)} · ${evt.error}`
    default:
      return JSON.stringify(evt)
  }
}

// --- Hook : consomme le flux SSE ------------------------------------------

export function useRunEventStream(runId: number, enabled: boolean) {
  const [events, setEvents] = useState<BaseEvent[]>([])
  const [connected, setConnected] = useState(false)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!enabled) return

    // EventSource ne supporte pas les headers custom → on passe le token en
    // query-string. Le backend accepte soit l'admin token (bypass super-admin)
    // soit le JWT de session — on prend ce qu'on a sous la main.
    const token = getAdminToken() ?? getJwt()
    if (!token) {
      // Pas authentifié → on ne connecte pas. L'UI reste sur "idle".
      return
    }
    // URL absolue obligatoire en prod : l'admin et l'API sont sur deux
    // domaines Railway distincts, donc une URL relative tombe sur l'origine
    // du front (qui n'expose pas /api/runs/*/stream). En dev, API_BASE === ""
    // et le proxy Vite (vite.config.ts) réécrit /api vers 127.0.0.1:8000.
    const url = `${API_BASE}/api/runs/${runId}/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)
    sourceRef.current = es

    es.onopen = () => setConnected(true)
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as BaseEvent
        setEvents((prev) => [...prev, evt])
        if (evt.event === 'run.closed') {
          es.close()
          setConnected(false)
        }
      } catch {
        /* ignore malformed */
      }
    }
    es.onerror = () => {
      // Erreur réseau → on ne spam pas, juste déconnecte
      setConnected(false)
    }

    return () => {
      es.close()
      sourceRef.current = null
    }
  }, [runId, enabled])

  return { events, connected }
}

// --- Vue Workers : threads actifs en train de scraper ---------------------

function WorkersPool({ events }: { events: BaseEvent[] }) {
  // Calcule l'état courant de chaque worker (ticker actuel ou terminé)
  type WorkerState = {
    worker: string
    status: 'idle' | 'working' | 'done' | 'error'
    current?: BaseEvent
    lastEventT: number
  }
  const workers = new Map<string, WorkerState>()

  for (const evt of events) {
    const w = evt.worker as string | undefined
    if (!w) continue
    const cur = workers.get(w) || { worker: w, status: 'idle' as const, lastEventT: evt.t }
    if (evt.event === 'ticker.start') {
      workers.set(w, { worker: w, status: 'working', current: evt, lastEventT: evt.t })
    } else if (evt.event === 'ticker.done') {
      workers.set(w, { worker: w, status: 'done', current: evt, lastEventT: evt.t })
    } else if (evt.event === 'ticker.error') {
      workers.set(w, { worker: w, status: 'error', current: evt, lastEventT: evt.t })
    } else {
      workers.set(w, cur)
    }
  }

  const list = Array.from(workers.values()).sort((a, b) => a.worker.localeCompare(b.worker))
  if (list.length === 0) return null

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-surface-2)]">
      <div className="px-4 py-2 text-[10px] font-mono tracking-wider text-[var(--color-fg-muted)] border-b border-[var(--color-border)] uppercase">
        Workers · {list.length} threads
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)]">
        {list.map((w) => (
          <div key={w.worker} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-block w-1.5 h-1.5 rounded-full',
                  w.status === 'working' && 'bg-[var(--color-gold)] animate-pulse',
                  w.status === 'done' && 'bg-[var(--color-success)]',
                  w.status === 'error' && 'bg-[var(--color-danger)]',
                  w.status === 'idle' && 'bg-[var(--color-fg-subtle)]',
                )}
              />
              <span className="font-mono text-xs text-[var(--color-fg-muted)]">{w.worker}</span>
            </div>
            {w.current && (
              <div className="mt-2 min-h-[40px]">
                <div className="font-mono text-sm text-[var(--color-fg)]">
                  {(w.current.ticker as string) ?? '—'}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] truncate">
                  {(w.current.name as string) ??
                    (w.status === 'error' ? (w.current.error as string) : '…')}
                </div>
                {w.status === 'done' && typeof w.current.close_price === 'number' && (
                  <div className="mt-1 font-mono text-[11px] text-[var(--color-fg-muted)]">
                    close={String(w.current.close_price)} var=
                    <span
                      className={
                        (w.current.variation_pct as number) >= 0
                          ? 'text-[var(--color-success)]'
                          : 'text-[var(--color-danger)]'
                      }
                    >
                      {(w.current.variation_pct as number).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Terminal scroll auto -------------------------------------------------

function Terminal({ events, connected }: { events: BaseEvent[]; connected: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll en bas à chaque nouveau event
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events.length])

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[#0A0E14] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[#0F141B]">
        <div className="flex items-center gap-2 text-[10px] font-mono tracking-wider text-slate-400 uppercase">
          <span className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500/60" />
            <span className="w-2 h-2 rounded-full bg-yellow-500/60" />
            <span className="w-2 h-2 rounded-full bg-green-500/60" />
          </span>
          <span>brvm-agent · live stream</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
          <span className={cn('w-1.5 h-1.5 rounded-full', connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
          <span>{connected ? 'connected' : 'idle'}</span>
          <span className="ml-3">{events.length} events</span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-300 overflow-y-auto"
        style={{ maxHeight: '420px', minHeight: '260px', scrollbarColor: '#334155 transparent' }}
      >
        {events.length === 0 ? (
          <div className="text-slate-500 italic">En attente d'events…</div>
        ) : (
          events.map((evt, i) => {
            const style = EVENT_STYLE[evt.event] ?? { color: 'text-slate-400', label: '···' }
            return (
              <div key={i} className="flex gap-3 items-baseline hover:bg-slate-500/5 -mx-4 px-4 py-0.5">
                <span className="text-slate-500 text-[11px] whitespace-nowrap">{fmtTime(evt.t)}</span>
                <span className={cn('text-[10px] font-semibold w-14 text-center rounded px-1', style.color, 'bg-slate-500/10')}>
                  {style.label}
                </span>
                <span className="flex-1 break-all">{eventMessage(evt)}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// --- Vue principale -------------------------------------------------------

export function LiveRunView({ runId, enabled }: { runId: number; enabled: boolean }) {
  const { events, connected } = useRunEventStream(runId, enabled)
  return (
    <div className="space-y-4">
      <WorkersPool events={events} />
      <Terminal events={events} connected={connected} />
    </div>
  )
}
