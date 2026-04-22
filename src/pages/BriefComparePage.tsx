import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, ThumbsUp } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { apiFetch } from '@/lib/api'
import type { BriefDetail } from '@/lib/types'

// --- Types ------------------------------------------------------------------

interface PayloadOpportunity {
  ticker?: string
  direction?: string
  conviction?: number
  thesis?: string
  price_current?: number
  price_target?: number
  gain_potential_pct?: number
  time_horizon?: string
}

interface PayloadShape {
  market_summary?: string
  opportunities?: PayloadOpportunity[]
  alerts?: string[]
  _error?: boolean
  _hallucination_filter?: {
    dropped?: string[]
    dropped_count?: number
  }
}

type Preference = 'A' | 'B' | 'tie'

interface LocalVote {
  briefId: number
  preferred: Preference
  modelA: string
  modelB: string
  votedAt: string
}

const VOTES_KEY = 'brvm-ab-votes'

function readVotes(): LocalVote[] {
  try {
    const raw = localStorage.getItem(VOTES_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as LocalVote[]) : []
  } catch {
    return []
  }
}

function writeVotes(votes: LocalVote[]): void {
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes))
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function formatFcfa(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('fr-FR').format(Math.round(v)) + ' FCFA'
}

// --- Page -------------------------------------------------------------------

export function BriefComparePage() {
  const { id } = useParams<{ id: string }>()
  const briefId = Number(id)

  const briefQ = useQuery({
    queryKey: ['briefs', briefId, 'compare'],
    queryFn: () => apiFetch<BriefDetail>(`/api/briefs/${briefId}`),
    enabled: Number.isFinite(briefId),
  })

  // Seed random figée au mount : évite de rebattre l'ordre A/B à chaque reload,
  // et évite setState-in-useEffect.
  const [mountSeed] = useState(() => Math.random())
  const [revealed, setRevealed] = useState(false)
  const [vote, setVote] = useState<Preference | null>(null)

  const data = briefQ.data
  const mapping: 'primary-A' | 'primary-B' | null = data
    ? (mountSeed < 0.5 ? 'primary-A' : 'primary-B')
    : null

  const { payloadA, payloadB, modelA, modelB } = useMemo(() => {
    if (!data || mapping === null) {
      return { payloadA: null, payloadB: null, modelA: '', modelB: '' }
    }
    const primary = data.payload as PayloadShape
    const alt = data.payload_alt as PayloadShape | null
    const primaryModelGuess = 'principal' // on n'a pas le model name du principal dans l'API
    const altModel = data.model_alt ?? 'alternatif'
    if (mapping === 'primary-A') {
      return {
        payloadA: primary,
        payloadB: alt,
        modelA: primaryModelGuess,
        modelB: altModel,
      }
    }
    return {
      payloadA: alt,
      payloadB: primary,
      modelA: altModel,
      modelB: primaryModelGuess,
    }
  }, [data, mapping])

  if (briefQ.isLoading) {
    return (
      <>
        <PageHeader title="Chargement…" />
        <PageContent>
          <div className="text-sm text-[var(--color-fg-muted)]">Chargement du brief…</div>
        </PageContent>
      </>
    )
  }

  if (briefQ.error || !data) {
    return (
      <>
        <PageHeader title="Erreur" />
        <PageContent>
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--color-danger)]">
                Impossible de charger ce brief.
              </p>
            </CardBody>
          </Card>
        </PageContent>
      </>
    )
  }

  if (!data.payload_alt) {
    return (
      <>
        <PageHeader
          title={`Brief du ${formatDateOnly(data.brief_date)}`}
          subtitle="Comparaison A/B indisponible — le test A/B n'était pas activé lors de la génération de ce brief."
          actions={
            <Link to={`/briefs/${briefId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft size={14} /> Retour au brief
              </Button>
            </Link>
          }
        />
        <PageContent>
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--color-fg-muted)]">
                Active <code className="font-mono">AB_TEST_SYNTHESIS=true</code> dans
                la config de l'API pour que les briefs suivants soient générés avec
                les deux modèles et deviennent comparables ici.
              </p>
            </CardBody>
          </Card>
        </PageContent>
      </>
    )
  }

  function handleVote(pref: Preference) {
    setVote(pref)
    setRevealed(true)
    // Persist local pour historique
    const entry: LocalVote = {
      briefId,
      preferred: pref,
      modelA,
      modelB,
      votedAt: new Date().toISOString(),
    }
    const existing = readVotes().filter((v) => v.briefId !== briefId)
    writeVotes([entry, ...existing])
  }

  return (
    <>
      <PageHeader
        title={`Comparaison A/B — ${formatDateOnly(data.brief_date)}`}
        subtitle="Lis les deux versions sans savoir laquelle vient de quel modèle. Choisis la meilleure, puis révèle."
        actions={
          <Link to={`/briefs/${briefId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft size={14} /> Retour au brief
            </Button>
          </Link>
        }
      />
      <PageContent>
        <MethodologyCard />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PayloadColumn
            label="A"
            model={revealed ? modelA : undefined}
            payload={payloadA}
            selected={vote === 'A'}
          />
          <PayloadColumn
            label="B"
            model={revealed ? modelB : undefined}
            payload={payloadB}
            selected={vote === 'B'}
          />
        </div>

        {!revealed ? (
          <Card>
            <CardHeader>
              <CardTitle>Ton verdict</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                <Button variant="accent" onClick={() => handleVote('A')}>
                  <ThumbsUp size={14} /> Je préfère A
                </Button>
                <Button variant="accent" onClick={() => handleVote('B')}>
                  <ThumbsUp size={14} /> Je préfère B
                </Button>
                <Button variant="outline" onClick={() => handleVote('tie')}>
                  Indistinguable
                </Button>
              </div>
              <p className="mt-3 text-xs text-[var(--color-fg-muted)]">
                Ton choix est stocké localement (localStorage) — utile pour compter
                après 14 jours. Pas envoyé au serveur.
              </p>
            </CardBody>
          </Card>
        ) : (
          <RevealCard vote={vote} modelA={modelA} modelB={modelB} />
        )}

        <VotesHistoryCard />
      </PageContent>
    </>
  )
}

// --- Subviews ---------------------------------------------------------------

function MethodologyCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Méthodologie — test en aveugle</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="text-sm text-[var(--color-fg-muted)] space-y-1 list-disc pl-5">
          <li>
            L'ordre A/B est tiré au hasard à chaque chargement — inutile de reload
            pour "deviner" l'attribution.
          </li>
          <li>
            Juge sur le fond : pertinence des signaux, précision des chiffres,
            qualité de la thèse. Ignore le style (ponctuation, longueur).
          </li>
          <li>
            Après 14 jours, compte tes votes dans le tableau d'historique en bas.
            Si tu ne distingues pas → bascule sur le modèle le moins cher (Sonnet).
          </li>
        </ul>
      </CardBody>
    </Card>
  )
}

function PayloadColumn({
  label,
  model,
  payload,
  selected,
}: {
  label: 'A' | 'B'
  model?: string
  payload: PayloadShape | null
  selected: boolean
}) {
  if (!payload) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--color-fg-muted)]">Payload vide.</p>
        </CardBody>
      </Card>
    )
  }
  const opportunities = payload.opportunities ?? []
  const alerts = payload.alerts ?? []

  return (
    <Card className={selected ? 'ring-2 ring-[var(--color-gold)]' : undefined}>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Badge tone={label === 'A' ? 'navy' : 'gold'}>Version {label}</Badge>
            {model && (
              <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                {model}
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        {payload._error && (
          <div className="text-xs bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded px-3 py-2 mb-3">
            Payload en erreur — synthèse dégradée.
          </div>
        )}

        {payload.market_summary && (
          <section className="mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
              Synthèse marché
            </h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {payload.market_summary}
            </p>
          </section>
        )}

        {opportunities.length > 0 && (
          <section className="mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
              Opportunités ({opportunities.length})
            </h3>
            <div className="space-y-3">
              {opportunities.map((opp, idx) => (
                <div
                  key={idx}
                  className="border border-[var(--color-border)] rounded-md p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-mono font-semibold text-[var(--color-navy)]">
                      {opp.ticker ?? '—'}
                    </span>
                    {opp.direction && (
                      <Badge tone="neutral">{opp.direction}</Badge>
                    )}
                    {opp.conviction != null && (
                      <span className="text-xs text-[var(--color-fg-muted)]">
                        conviction {opp.conviction}/5
                      </span>
                    )}
                    {opp.time_horizon && (
                      <span className="text-xs text-[var(--color-fg-muted)]">
                        horizon {opp.time_horizon}
                      </span>
                    )}
                  </div>
                  {(opp.price_current != null || opp.price_target != null) && (
                    <div className="text-xs text-[var(--color-fg-muted)] mb-1.5 font-mono">
                      {opp.price_current != null && `actuel ${formatFcfa(opp.price_current)}`}
                      {opp.price_target != null && ` → cible ${formatFcfa(opp.price_target)}`}
                      {opp.gain_potential_pct != null && ` (${opp.gain_potential_pct > 0 ? '+' : ''}${opp.gain_potential_pct}%)`}
                    </div>
                  )}
                  {opp.thesis && (
                    <p className="text-sm text-[var(--color-fg)] leading-relaxed">
                      {opp.thesis}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {alerts.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
              Alertes ({alerts.length})
            </h3>
            <ul className="text-sm list-disc pl-5 space-y-1">
              {alerts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </section>
        )}

        {payload._hallucination_filter?.dropped_count ? (
          <div className="mt-4 text-xs text-[var(--color-warning)]">
            Filtre anti-hallucination : {payload._hallucination_filter.dropped_count}{' '}
            opportunité(s) retirée(s) ({payload._hallucination_filter.dropped?.join(', ')})
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

function RevealCard({
  vote,
  modelA,
  modelB,
}: {
  vote: Preference | null
  modelA: string
  modelB: string
}) {
  const preferredModel =
    vote === 'A' ? modelA : vote === 'B' ? modelB : 'indistinguable'

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Eye size={14} /> Révélation
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="space-y-2 text-sm">
          <div>
            <strong>A</strong> était le modèle{' '}
            <span className="font-mono bg-[var(--color-muted)] px-1.5 py-0.5 rounded">
              {modelA}
            </span>
          </div>
          <div>
            <strong>B</strong> était le modèle{' '}
            <span className="font-mono bg-[var(--color-muted)] px-1.5 py-0.5 rounded">
              {modelB}
            </span>
          </div>
          <div className="pt-2 border-t border-[var(--color-border)]">
            Ton choix :{' '}
            <Badge tone={vote === 'tie' ? 'neutral' : 'gold'}>
              {preferredModel}
            </Badge>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

function VotesHistoryCard() {
  const [hidden, setHidden] = useState(true)
  const votes = readVotes()

  if (votes.length === 0) return null

  // Compte par modèle préféré
  const tally: Record<string, number> = {}
  for (const v of votes) {
    const k =
      v.preferred === 'tie'
        ? 'indistinguable'
        : v.preferred === 'A'
          ? v.modelA
          : v.modelB
    tally[k] = (tally[k] ?? 0) + 1
  }
  const rows = Object.entries(tally).sort((a, b) => b[1] - a[1])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            Historique ({votes.length} vote{votes.length > 1 ? 's' : ''})
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHidden((h) => !h)}
            >
              {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {hidden ? 'Afficher' : 'Masquer'}
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      {!hidden && (
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                <th className="pb-2">Modèle préféré</th>
                <th className="pb-2 text-right">Votes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([model, n]) => (
                <tr key={model} className="border-t border-[var(--color-border)]">
                  <td className="py-2 font-mono">{model}</td>
                  <td className="py-2 text-right font-mono">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-[var(--color-fg-muted)]">
            Stocké en localStorage — disparaît si tu vides le cache navigateur.
            Export manuel :{' '}
            <code className="font-mono">
              localStorage.getItem('brvm-ab-votes')
            </code>
          </p>
        </CardBody>
      )}
    </Card>
  )
}
