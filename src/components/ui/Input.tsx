import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] transition-colors disabled:opacity-50',
        // Focus premium : bordure navy douce + micro-lueur intérieure, pas de ring épais
        'focus:border-[var(--color-navy)]/50 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--focus-ring)]',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
