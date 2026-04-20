/**
 * Types miroir de l'API FastAPI. À garder en sync manuellement (ou générer
 * automatiquement via openapi-typescript si l'API bouge vite).
 */

/** Enveloppe standard des endpoints list. */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface HealthResponse {
  status: 'ok'
  scheduler_running: boolean
  next_run: string | null
  sentry: boolean
}

export type RunStatus = 'running' | 'success' | 'failed' | 'skipped_locked'
export type RunTrigger = 'cron' | 'manual'

export interface PipelineRun {
  id: number
  started_at: string
  ended_at: string | null
  status: RunStatus
  trigger: RunTrigger
  brief_id: number | null
  error: string | null
  summary: Record<string, unknown>
}

export type DeliveryStatus = 'pending' | 'delivered' | 'partial' | 'failed'

export interface BriefSummary {
  id: number
  brief_date: string
  summary_markdown: string
  email_sent: boolean
  whatsapp_sent: boolean
  delivery_status: DeliveryStatus
  signals_count: number
}

export interface ScheduleConfig {
  cron_expression: string
  enabled: boolean
  updated_at: string
  next_run: string | null
}

export interface Source {
  id: number
  key: string
  name: string
  type: string
  url: string
  enabled: boolean
  config: Record<string, unknown>
  last_collected_at: string | null
  last_status: string | null
  last_error: string | null
  created_at: string
}

export type Channel = 'email' | 'whatsapp'

export interface Recipient {
  id: number
  channel: Channel
  address: string
  name: string | null
  enabled: boolean
  notes: string | null
  created_at: string
  updated_at: string
}
