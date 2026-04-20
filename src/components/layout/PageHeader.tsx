import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: Props) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-4 px-6 md:px-10 pt-6 pb-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-[var(--color-navy)] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1 text-sm text-[var(--color-fg-muted)]">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-none">{actions}</div>}
    </header>
  )
}

export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex-1 px-6 md:px-10 py-6 space-y-6', className)}>{children}</div>
}
