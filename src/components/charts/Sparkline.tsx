import { useMemo } from 'react'
import { cn } from '@/lib/cn'

/**
 * Sparkline SVG minimale — 1 courbe + area fill, pas d'axes, pas de tooltip.
 * Pour donner une indication visuelle rapide dans un KPI card / barre status.
 */

interface Props {
  points: number[]
  width?: number
  height?: number
  stroke?: 'auto' | string     // 'auto' = vert si positif, rouge si négatif
  className?: string
}

export function Sparkline({
  points,
  width = 120,
  height = 32,
  stroke = 'auto',
  className,
}: Props) {
  const geom = useMemo(() => {
    if (points.length < 2) return null
    const min = Math.min(...points)
    const max = Math.max(...points)
    const span = max - min || 1
    const stepX = width / (points.length - 1)
    const ys = points.map((v) => height - ((v - min) / span) * height)
    const xs = points.map((_, i) => i * stepX)
    const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
    const areaPath = `${linePath} L${xs[xs.length - 1].toFixed(1)},${height} L0,${height} Z`
    return { linePath, areaPath }
  }, [points, width, height])

  if (!geom) {
    return <div className={cn('text-[10px] text-[var(--color-fg-subtle)]', className)}>—</div>
  }

  const auto = points[points.length - 1] >= points[0]
  const color = stroke === 'auto' ? (auto ? 'var(--color-success)' : 'var(--color-danger)') : stroke
  const gradId = `sparkline-gradient-${auto ? 'up' : 'down'}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('inline-block', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={geom.areaPath} fill={`url(#${gradId})`} />
      <path d={geom.linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
