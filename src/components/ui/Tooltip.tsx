import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Tooltip premium — hover simple, delay 150ms, contenu multi-ligne supporté.
 *
 * Usage :
 *   <Tooltip content="Texte long…">
 *     <span>Élément tronqué</span>
 *   </Tooltip>
 */

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={150}>{children}</RadixTooltip.Provider>
}

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-50 max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-fg)] shadow-[var(--shadow-elevated)]',
            'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0',
            'whitespace-pre-wrap break-words',
            className
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-[var(--color-surface)] stroke-[var(--color-border)]" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}
