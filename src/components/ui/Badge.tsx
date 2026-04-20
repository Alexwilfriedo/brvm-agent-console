import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Badge premium — petit, aéré, pas de majuscules agressives.
 *
 * Typo : Title Case naturel, letter-spacing subtil (0.02em).
 * Tailles : `sm` (par défaut, pour tableau) et `md` (hero, headers).
 */
const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium leading-none whitespace-nowrap max-w-full',
  {
    variants: {
      tone: {
        neutral:
          'bg-[var(--color-muted)] text-[var(--color-fg-muted)]',
        success:
          'bg-[var(--color-success-bg)] text-[var(--color-success)]',
        warning:
          'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
        danger:
          'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
        navy:
          'bg-[var(--color-navy-solid)] text-white',
        gold:
          'bg-[var(--color-gold-50)] text-[var(--color-gold-600)] ring-1 ring-inset ring-[var(--color-gold)]/30',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px]',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone, size }), className)} {...props} />
}
