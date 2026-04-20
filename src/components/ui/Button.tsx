import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-navy-solid)] text-white hover:bg-[var(--color-navy-solid-hover)]',
        accent:
          'bg-[var(--color-gold)] text-[var(--color-navy-solid)] hover:bg-[var(--color-gold-600)] font-semibold',
        ghost:
          'bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-muted)]',
        outline:
          'border border-[var(--color-border)] bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-muted)]',
        danger:
          'bg-[var(--color-danger)] text-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  )
)
Button.displayName = 'Button'
