import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * Chart SVG maison — line chart avec area fill, grid Y, axe X daté, crosshair.
 *
 * Pas de dep. Volontairement minimal et propre (cohérent avec la direction
 * éditoriale du reste de l'app). Si on veut candlesticks un jour, on migrera
 * vers lightweight-charts (TradingView) — 40kb gzipped.
 */

export interface SeriesPoint {
  date: string          // ISO
  close: number
  volume?: number
}

interface Props {
  points: SeriesPoint[]
  height?: number
  formatValue?: (v: number) => string
  className?: string
}

const PAD = { top: 12, right: 12, bottom: 24, left: 56 }

function fmtDateShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min]
  const range = max - min
  const step = range / count
  const mag = 10 ** Math.floor(Math.log10(step))
  const stepRounded = Math.ceil(step / mag) * mag
  const start = Math.floor(min / stepRounded) * stepRounded
  const ticks: number[] = []
  for (let v = start; v <= max + 1e-6; v += stepRounded) ticks.push(Number(v.toFixed(6)))
  return ticks
}

export function PriceChart({ points, height = 260, formatValue, className }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const width = 800  // viewBox — le svg est responsive via viewBox

  const geom = useMemo(() => {
    const valid = points.filter((p) => p.close > 0)
    if (valid.length < 2) return null

    const closes = valid.map((p) => p.close)
    const minY = Math.min(...closes)
    const maxY = Math.max(...closes)
    const spanY = maxY - minY || 1
    // Padding visuel : on élargit de 5% pour que la courbe ne colle pas en haut/bas
    const padY = spanY * 0.08
    const yMin = minY - padY
    const yMax = maxY + padY

    const chartW = width - PAD.left - PAD.right
    const chartH = height - PAD.top - PAD.bottom

    const xs = valid.map((_, i) => PAD.left + (i / (valid.length - 1)) * chartW)
    const ys = valid.map((p) => PAD.top + ((yMax - p.close) / (yMax - yMin)) * chartH)

    const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')
    const areaPath = `${linePath} L ${xs[xs.length - 1].toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${xs[0].toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`

    const yTicks = niceTicks(yMin, yMax, 4)

    // Ticks X : ~5 labels équirépartis
    const xTickCount = Math.min(5, valid.length)
    const xTickIdx = Array.from({ length: xTickCount }, (_, i) =>
      Math.round((i / Math.max(1, xTickCount - 1)) * (valid.length - 1))
    )

    return { valid, xs, ys, linePath, areaPath, yMin, yMax, yTicks, xTickIdx, chartW, chartH }
  }, [points, height])

  if (!geom) {
    return (
      <div className={cn('flex items-center justify-center text-sm text-[var(--color-fg-subtle)]', className)}
           style={{ height }}>
        Historique insuffisant pour tracer un graphique (≥ 2 séances requises).
      </div>
    )
  }

  const { valid, xs, ys, linePath, areaPath, yMin, yMax, yTicks, xTickIdx, chartH } = geom

  const lastClose = valid[valid.length - 1].close
  const firstClose = valid[0].close
  const isUp = lastClose >= firstClose
  const stroke = isUp ? 'var(--color-success)' : 'var(--color-danger)'
  const fillId = `chart-gradient-${isUp ? 'up' : 'down'}`
  const fmt = formatValue ?? ((v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }))

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * width
    // find nearest idx
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < xs.length; i++) {
      const d = Math.abs(xs[i] - x)
      if (d < bestDist) { bestDist = d; best = i }
    }
    setHoverIdx(best)
  }

  const hover = hoverIdx !== null ? valid[hoverIdx] : null

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid Y + labels */}
        {yTicks.map((v, i) => {
          const y = PAD.top + ((yMax - v) / (yMax - yMin)) * chartH
          return (
            <g key={i}>
              <line
                x1={PAD.left} x2={width - PAD.right} y1={y} y2={y}
                stroke="var(--color-border)" strokeDasharray="2 3" strokeWidth="1"
              />
              <text
                x={PAD.left - 8} y={y + 4}
                textAnchor="end"
                className="fill-[var(--color-fg-subtle)]"
                style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              >
                {fmt(v)}
              </text>
            </g>
          )
        })}

        {/* Axe X — dates */}
        {xTickIdx.map((i) => (
          <text
            key={i}
            x={xs[i]} y={height - 6}
            textAnchor="middle"
            className="fill-[var(--color-fg-subtle)]"
            style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
          >
            {fmtDateShort(valid[i].date)}
          </text>
        ))}

        {/* Area + ligne */}
        <path d={areaPath} fill={`url(#${fillId})`} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

        {/* Dernier point (dot) */}
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3.5" fill={stroke} />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="7" fill={stroke} opacity="0.15" />

        {/* Crosshair */}
        {hoverIdx !== null && (
          <g>
            <line
              x1={xs[hoverIdx]} x2={xs[hoverIdx]}
              y1={PAD.top} y2={PAD.top + chartH}
              stroke="var(--color-fg-subtle)" strokeWidth="1" strokeDasharray="2 2"
            />
            <circle cx={xs[hoverIdx]} cy={ys[hoverIdx]} r="4" fill={stroke} stroke="var(--color-surface)" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* Tooltip flottant */}
      {hover && hoverIdx !== null && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg text-xs space-y-0.5"
          style={{
            left: `${(xs[hoverIdx] / width) * 100}%`,
            top: 0,
            transform: `translateX(${hoverIdx < xs.length / 2 ? '12px' : 'calc(-100% - 12px)'})`,
          }}
        >
          <div className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
            {new Date(hover.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <div className="font-mono font-semibold text-[var(--color-fg)]">
            {fmt(hover.close)}
          </div>
          {typeof hover.volume === 'number' && hover.volume > 0 && (
            <div className="font-mono text-[10px] text-[var(--color-fg-muted)]">
              Vol. {hover.volume.toLocaleString('fr-FR')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
