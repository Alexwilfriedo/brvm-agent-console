import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Play, Power, Save, Calendar, ClipboardCheck } from 'lucide-react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Switch } from '@/components/ui/Switch'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { apiFetch } from '@/lib/api'
import type { ScheduleConfig } from '@/lib/types'

const DAILY_CRONS: { label: string; expr: string }[] = [
  { label: 'Tous les jours à 8h', expr: '0 8 * * *' },
  { label: 'Tous les jours à 7h30', expr: '30 7 * * *' },
  { label: 'Semaine uniquement (8h)', expr: '0 8 * * 1-5' },
  { label: 'Tous les jours à 6h', expr: '0 6 * * *' },
]

const WEEKLY_CRONS: { label: string; expr: string }[] = [
  { label: 'Samedi 7h (défaut)', expr: '0 7 * * 6' },
  { label: 'Samedi 8h', expr: '0 8 * * 6' },
  { label: 'Dimanche 18h', expr: '0 18 * * 0' },
  { label: 'Lundi 6h', expr: '0 6 * * 1' },
]

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SchedulePage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [cron, setCron] = useState('')
  const [weeklyEnabled, setWeeklyEnabled] = useState(false)
  const [weeklyCron, setWeeklyCron] = useState('0 7 * * 6')
  const [enabled, setEnabled] = useState(true)

  const schedule = useQuery({
    queryKey: ['schedule'],
    queryFn: () => apiFetch<ScheduleConfig>('/api/schedule'),
  })

  useEffect(() => {
    if (schedule.data) {
      setCron(schedule.data.cron_expression)
      setEnabled(schedule.data.enabled)
      const wc = schedule.data.weekly_cron_expression
      setWeeklyEnabled(Boolean(wc))
      setWeeklyCron(wc || '0 7 * * 6')
    }
  }, [schedule.data])

  const save = useMutation({
    mutationFn: (body: {
      cron_expression?: string
      weekly_cron_expression?: string | null
      enabled?: boolean
    }) =>
      apiFetch<ScheduleConfig>('/api/schedule', { method: 'PATCH', body }),
    onSuccess: (data) => {
      toast.success('Planification enregistrée', {
        description: data.enabled
          ? `Prochain daily : ${data.next_run ? new Date(data.next_run).toLocaleString('fr-FR') : '—'}`
          : 'Scheduler désactivé',
      })
      qc.invalidateQueries({ queryKey: ['schedule'] })
    },
    onError: (err) => toast.error('Échec', { description: (err as Error).message }),
  })

  const triggerNow = useMutation({
    mutationFn: (force: boolean) =>
      apiFetch(`/api/schedule/run-now${force ? '?force=true' : ''}`, { method: 'POST' }),
    onSuccess: (_, force) => {
      toast.success(force ? 'Régénération daily déclenchée' : 'Pipeline daily déclenché', {
        description: force
          ? "Création d'une nouvelle révision du brief du jour."
          : "Suivi dans l'onglet Exécutions. Skippera si le brief du jour existe déjà.",
      })
      qc.invalidateQueries({ queryKey: ['runs'] })
      qc.invalidateQueries({ queryKey: ['briefs'] })
    },
    onError: (err) => toast.error('Échec du déclenchement', { description: (err as Error).message }),
  })

  const triggerWeeklyNow = useMutation({
    mutationFn: (force: boolean) =>
      apiFetch(`/api/schedule/run-weekly-now${force ? '?force=true' : ''}`, { method: 'POST' }),
    onSuccess: (_, force) => {
      toast.success(force ? 'Régénération hebdo déclenchée' : 'Audit hebdomadaire lancé', {
        description: force
          ? "Nouvelle révision de l'audit de la semaine."
          : "Suivi dans Exécutions. Skippera si l'audit de la semaine existe déjà.",
      })
      qc.invalidateQueries({ queryKey: ['runs'] })
      qc.invalidateQueries({ queryKey: ['briefs'] })
    },
    onError: (err) =>
      toast.error('Échec du déclenchement hebdo', { description: (err as Error).message }),
  })

  const currentWeeklyExpr = weeklyEnabled ? weeklyCron : null
  const isDirty =
    schedule.data &&
    (cron !== schedule.data.cron_expression
      || enabled !== schedule.data.enabled
      || currentWeeklyExpr !== schedule.data.weekly_cron_expression)

  return (
    <>
      <PageHeader
        title="Planification"
        subtitle="Horaire du pipeline quotidien + audit hebdomadaire · déclenchement manuel."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={triggerWeeklyNow.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Lancer l'audit hebdomadaire ?",
                  description:
                    "Produit l'audit de la dernière semaine de trading (lundi → vendredi). Idempotent — skip si l'audit de la semaine existe déjà.",
                  confirmLabel: 'Lancer',
                  tone: 'primary',
                })
                if (ok) triggerWeeklyNow.mutate(false)
              }}
            >
              <ClipboardCheck size={14} />
              {triggerWeeklyNow.isPending ? 'Audit…' : 'Lancer audit hebdo'}
            </Button>
            <Button
              variant="accent"
              size="sm"
              disabled={triggerNow.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Lancer un brief daily maintenant ?',
                  description:
                    "Déclenche le pipeline complet. Si un brief existe déjà pour aujourd'hui, le run sera skippé (idempotent par date). Coût ≈ 0,80 $ Anthropic.",
                  confirmLabel: 'Lancer',
                  tone: 'primary',
                })
                if (ok) triggerNow.mutate(false)
              }}
            >
              <Play size={14} />
              {triggerNow.isPending ? 'Démarrage…' : 'Lancer daily'}
            </Button>
          </>
        }
      />

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Daily config */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Brief daily — cron</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  Expression cron
                </span>
                <Input
                  value={cron}
                  onChange={(e) => setCron(e.target.value)}
                  className="font-mono"
                  placeholder="0 8 * * *"
                />
                <span className="mt-1 block text-[11px] text-[var(--color-fg-subtle)]">
                  Format : minute heure jour mois jour-semaine · Timezone Africa/Abidjan
                </span>
              </label>

              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                  Presets
                </span>
                <div className="flex flex-wrap gap-2">
                  {DAILY_CRONS.map((c) => (
                    <button
                      key={c.expr}
                      onClick={() => setCron(c.expr)}
                      className={
                        'px-3 py-1.5 rounded-md border text-xs transition-colors ' +
                        (cron === c.expr
                          ? 'border-[var(--color-gold)] bg-[var(--color-gold-50)] text-[var(--color-navy)]'
                          : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-muted)]')
                      }
                    >
                      {c.label}
                      <span className="ml-2 font-mono text-[var(--color-fg-subtle)]">
                        {c.expr}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <Switch
                id="scheduler-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                label="Scheduler actif (master switch)"
                description={
                  enabled
                    ? 'Daily + hebdo seront déclenchés automatiquement selon les crons.'
                    : 'Aucun brief automatique tant que ce switch reste désactivé (daily ET hebdo).'
                }
              />
            </CardBody>
          </Card>

          {/* État actuel */}
          <Card>
            <CardHeader>
              <CardTitle>État actuel</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  Statut
                </div>
                {schedule.data?.enabled ? (
                  <Badge tone="success"><Power size={10} /> Actif</Badge>
                ) : (
                  <Badge tone="neutral">Désactivé</Badge>
                )}
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  Cron daily
                </div>
                <div className="font-mono text-[var(--color-navy)]">
                  {schedule.data?.cron_expression ?? '—'}
                </div>
                <div className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
                  <Calendar size={10} className="inline mr-1" />
                  Prochain : {formatDateTime(schedule.data?.next_run ?? null)}
                </div>
              </div>
              <div className="pt-3 border-t border-[var(--color-border)]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  Cron hebdo
                </div>
                {schedule.data?.weekly_cron_expression ? (
                  <>
                    <div className="font-mono text-[var(--color-navy)]">
                      {schedule.data.weekly_cron_expression}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
                      <Calendar size={10} className="inline mr-1" />
                      Prochain : {formatDateTime(schedule.data.weekly_next_run ?? null)}
                    </div>
                  </>
                ) : (
                  <Badge tone="neutral">Désactivé</Badge>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Weekly config */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Brief hebdomadaire — cron</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Switch
                id="weekly-enabled"
                checked={weeklyEnabled}
                onCheckedChange={setWeeklyEnabled}
                label="Envoi hebdo activé"
                description={
                  weeklyEnabled
                    ? "L'audit de la semaine sera envoyé selon le cron ci-dessous. Couvre lundi → vendredi."
                    : "Aucun audit hebdomadaire ne sera envoyé automatiquement."
                }
              />

              {weeklyEnabled && (
                <>
                  <label className="block">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                      Expression cron
                    </span>
                    <Input
                      value={weeklyCron}
                      onChange={(e) => setWeeklyCron(e.target.value)}
                      className="font-mono"
                      placeholder="0 7 * * 6"
                    />
                    <span className="mt-1 block text-[11px] text-[var(--color-fg-subtle)]">
                      Jour-semaine : 0=dim · 1=lun · 2=mar · … · 6=sam
                    </span>
                  </label>

                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                      Presets
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {WEEKLY_CRONS.map((c) => (
                        <button
                          key={c.expr}
                          onClick={() => setWeeklyCron(c.expr)}
                          className={
                            'px-3 py-1.5 rounded-md border text-xs transition-colors ' +
                            (weeklyCron === c.expr
                              ? 'border-[var(--color-gold)] bg-[var(--color-gold-50)] text-[var(--color-navy)]'
                              : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-muted)]')
                          }
                        >
                          {c.label}
                          <span className="ml-2 font-mono text-[var(--color-fg-subtle)]">
                            {c.expr}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* Actions (save) */}
          <Card className="lg:col-span-3">
            <CardBody>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!isDirty || save.isPending}
                  onClick={async () => {
                    // Si on désactive le scheduler → confirm
                    if (schedule.data?.enabled && !enabled) {
                      const ok = await confirm({
                        title: 'Désactiver la planification ?',
                        description:
                          "Aucun brief (daily OU hebdo) ne sera généré automatiquement tant que ce switch reste désactivé. Tu pourras toujours lancer manuellement.",
                        confirmLabel: 'Désactiver',
                        tone: 'danger',
                      })
                      if (!ok) return
                    }
                    save.mutate({
                      cron_expression: cron,
                      weekly_cron_expression: currentWeeklyExpr,
                      enabled,
                    })
                  }}
                >
                  <Save size={14} />
                  Enregistrer
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!isDirty || save.isPending}
                  onClick={() => {
                    if (schedule.data) {
                      setCron(schedule.data.cron_expression)
                      setEnabled(schedule.data.enabled)
                      const wc = schedule.data.weekly_cron_expression
                      setWeeklyEnabled(Boolean(wc))
                      setWeeklyCron(wc || '0 7 * * 6')
                    }
                  }}
                >
                  Annuler
                </Button>
                {save.isError && (
                  <span className="text-xs text-[var(--color-danger)]">
                    {(save.error as Error).message}
                  </span>
                )}
                {save.isSuccess && !isDirty && (
                  <span className="text-xs text-[var(--color-success)]">Enregistré ✓</span>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </PageContent>
    </>
  )
}
