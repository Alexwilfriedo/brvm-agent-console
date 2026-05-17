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

export type RunStatus =
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped_locked'
  | 'already_generated'
  | 'no_data'
export type RunTrigger = 'cron' | 'manual'

export type PipelineType = 'daily' | 'weekly'

export interface PipelineRun {
  id: number
  started_at: string
  ended_at: string | null
  status: RunStatus
  trigger: RunTrigger
  pipeline_type: PipelineType
  brief_id: number | null
  error: string | null
  summary: Record<string, unknown>
}

export interface RunNews {
  id: number | null
  source_key: string
  title: string
  url: string
  published_at: string | null
  tickers_mentioned: string[]
  enriched: boolean
}

export interface RunSource {
  source_key: string
  source_name: string | null
  source_type: string | null
  news_count: number
  quotes_count: number
  new_news_count: number
  errors: string[]
  news: RunNews[]
}

export type DeliveryStatus =
  | 'pending'
  | 'delivered'
  | 'partial'
  | 'failed'
  | 'failed_synth'

export type BriefType = 'daily' | 'weekly'

export interface BriefSummary {
  id: number
  brief_date: string
  brief_type: BriefType
  summary_markdown: string
  email_sent: boolean
  whatsapp_sent: boolean
  delivery_status: DeliveryStatus
  signals_count: number
  revision: number
  revised_at: string | null
}

export interface BriefDetail {
  id: number
  brief_date: string
  brief_type: BriefType
  summary_markdown: string
  payload: Record<string, unknown>
  email_sent: boolean
  whatsapp_sent: boolean
  delivery_status: DeliveryStatus
  delivery_errors: string | null
  revision: number
  revised_at: string | null
  signals: Array<{
    ticker: string
    direction: string
    conviction: number
    thesis: string
    price_at_signal: number | null
  }>
  /** Q-1 A/B : payload produit par le modèle alternatif (null si A/B désactivé). */
  payload_alt: Record<string, unknown> | null
  model_alt: string | null
}

export interface RedeliverResult {
  brief_id: number
  status: 'delivered' | 'partial' | 'failed'
  email_ok: boolean
  whatsapp_ok: boolean
  errors: string[]
  sent_to: string[]
}

export interface RedeliverTarget {
  email: string
  name?: string | null
}

export interface ScheduleConfig {
  cron_expression: string
  weekly_cron_expression: string | null
  enabled: boolean
  updated_at: string
  next_run: string | null
  weekly_next_run: string | null
  scheduler_running: boolean
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

export type TradeAction = 'buy' | 'sell'
export type TradeReason = 'brief' | 'intuition' | 'news' | 'other'

export interface Trade {
  id: number
  ticker: string
  action: TradeAction
  quantity: number
  unit_price: number
  executed_at: string
  reason: TradeReason
  brief_id: number | null
  signal_id: number | null
  notes: string | null
  created_at: string
}

export interface TradeCreate {
  ticker: string
  action: TradeAction
  quantity: number
  unit_price: number
  executed_at?: string | null
  reason: TradeReason
  brief_id?: number | null
  signal_id?: number | null
  notes?: string | null
}

export type RecipientFrequency = 'daily' | 'weekly' | 'critical_only'

export interface Recipient {
  id: number
  channel: Channel
  address: string
  name: string | null
  enabled: boolean
  frequency: RecipientFrequency
  notes: string | null
  created_at: string
  updated_at: string
}

// --- Investment analyses (on-demand Opus) ----------------------------------

export type InvestmentHorizon = 'short' | 'medium' | 'long'
export type InvestmentRecommendation = 'buy' | 'hold' | 'avoid'

/** Payload Opus (forme attendue — tolérant aux champs manquants). */
export interface InvestmentAnalysisPayload {
  recommendation?: InvestmentRecommendation
  confidence?: number
  price_at_analysis?: number
  price_target?: number | null
  stop_loss?: number | null
  time_horizon_days?: number | null
  rationale?: string[]
  risks?: string[]
  catalysts?: string[]
  invalidation?: string
  valuation_snapshot?: Record<string, number | string | null>
  liquidity_flag?: boolean
  data_quality_note?: 'ok' | 'sparse_history' | 'no_news' | 'stale_quotes' | 'partial'
  _error?: boolean
  _error_reason?: string
  _sanitize_issues?: string[]
}

export interface InvestmentAnalysis {
  id: number
  ticker: string
  horizon: InvestmentHorizon
  recommendation: InvestmentRecommendation
  confidence: number
  price_at_analysis: number
  price_target: number | null
  stop_loss: number | null
  time_horizon_days: number | null
  payload: InvestmentAnalysisPayload
  input_tokens: number
  output_tokens: number
  model_used: string | null
  requested_by: string | null
  requested_at: string
  from_cache: boolean
}

/** Vue listing — exclut le payload complet. */
export interface InvestmentAnalysisSummary {
  id: number
  ticker: string
  horizon: InvestmentHorizon
  recommendation: InvestmentRecommendation
  confidence: number
  price_at_analysis: number
  price_target: number | null
  requested_at: string
  from_cache: boolean
}

export interface InvestmentAnalysisCreate {
  ticker: string
  horizon: InvestmentHorizon
}

// --- Backfill (import historique reprisable) ------------------------------

export type BackfillSourceType = 'pdf_brvm' | 'csv'
export type BackfillJobStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type BackfillItemStatus = 'pending' | 'processing' | 'done' | 'failed' | 'skipped'

export interface BackfillJob {
  id: number
  status: BackfillJobStatus
  source_type: BackfillSourceType
  total_items: number
  processed_items: number
  failed_items: number
  inserted_quotes: number
  updated_quotes: number
  pause_requested: boolean
  requested_by: string | null
  message: string | null
  created_at: string
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  updated_at: string
}

export interface BackfillItem {
  id: number
  filename: string
  kind: 'pdf' | 'csv'
  status: BackfillItemStatus
  ticker_hint: string | null
  inserted_quotes: number
  updated_quotes: number
  error: string | null
  meta: Record<string, unknown>
  processed_at: string | null
}

export interface BackfillJobDetail extends BackfillJob {
  items: BackfillItem[]
}
