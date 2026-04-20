import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pt-4 pb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]',
        className
      )}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // Par défaut `p-5` pour que la Card respire même sans CardHeader.
  // Pour annuler (cas DataTable dans Card) : `className="p-0"`.
  // Pour enlever juste le haut (CardHeader + CardBody) : `className="pt-0"`.
  return <div className={cn('p-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-b-lg',
        className
      )}
      {...props}
    />
  )
}
