import * as RadixSelect from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Select premium — construit sur Radix UI (accessibilité + keyboard nav),
 * stylé aux couleurs de la charte (navy / gold / Lexend).
 *
 * Usage :
 *   <Select value={v} onValueChange={setV}>
 *     <SelectTrigger>
 *       <SelectValue placeholder="Choisir…" />
 *     </SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="email">Email</SelectItem>
 *       <SelectItem value="whatsapp">WhatsApp</SelectItem>
 *     </SelectContent>
 *   </Select>
 */

export const Select = RadixSelect.Root
export const SelectValue = RadixSelect.Value

export const SelectTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger> & { size?: 'sm' | 'md' }
>(({ className, children, size = 'md', ...props }, ref) => (
  <RadixSelect.Trigger
    ref={ref}
    className={cn(
      'group inline-flex w-full items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-fg)] transition-colors cursor-pointer',
      'hover:border-[var(--color-fg-subtle)]',
      'focus:border-[var(--color-navy)]/50 focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--focus-ring)]',
      'data-[state=open]:border-[var(--color-navy)]/50 data-[state=open]:shadow-[inset_0_0_0_1px_var(--focus-ring)]',
      'data-[placeholder]:text-[var(--color-fg-subtle)] disabled:cursor-not-allowed disabled:opacity-50',
      size === 'sm' ? 'h-8 text-xs' : 'h-9',
      className
    )}
    {...props}
  >
    <span className="flex-1 truncate text-left">{children}</span>
    <RadixSelect.Icon asChild>
      <ChevronDown
        size={14}
        className="text-[var(--color-fg-muted)] transition-transform group-data-[state=open]:rotate-180"
      />
    </RadixSelect.Icon>
  </RadixSelect.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

export const SelectContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <RadixSelect.Portal>
    <RadixSelect.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={cn(
        'z-50 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'min-w-[8rem]',
        className
      )}
      style={{
        maxHeight: 'var(--radix-select-content-available-height)',
        width: 'var(--radix-select-trigger-width)',
      }}
      {...props}
    >
      <RadixSelect.ScrollUpButton className="flex h-7 items-center justify-center text-[var(--color-fg-muted)]">
        <ChevronUp size={14} />
      </RadixSelect.ScrollUpButton>
      <RadixSelect.Viewport className="p-1">
        {children}
      </RadixSelect.Viewport>
      <RadixSelect.ScrollDownButton className="flex h-7 items-center justify-center text-[var(--color-fg-muted)]">
        <ChevronDown size={14} />
      </RadixSelect.ScrollDownButton>
    </RadixSelect.Content>
  </RadixSelect.Portal>
))
SelectContent.displayName = 'SelectContent'

export interface SelectItemProps
  extends React.ComponentPropsWithoutRef<typeof RadixSelect.Item> {
  icon?: ReactNode
}

export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, icon, ...props }, ref) => (
    <RadixSelect.Item
      ref={ref}
      className={cn(
        'group relative flex w-full cursor-pointer select-none items-center gap-2.5 rounded px-2.5 py-2 pr-8 text-sm text-[var(--color-fg)] outline-none transition-colors',
        // Highlight subtil — muted gris doux, gold accent sur l'icône
        'data-[highlighted]:bg-[var(--color-muted)]',
        'data-[state=checked]:font-medium data-[state=checked]:text-[var(--color-navy)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      {icon && (
        <span className="flex-none text-[var(--color-fg-muted)] group-data-[highlighted]:text-[var(--color-gold-600)] transition-colors">
          {icon}
        </span>
      )}
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="absolute right-2.5 text-[var(--color-gold-600)]">
        <Check size={13} strokeWidth={2.5} />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
)
SelectItem.displayName = 'SelectItem'

export const SelectSeparator = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Separator>
>(({ className, ...props }, ref) => (
  <RadixSelect.Separator
    ref={ref}
    className={cn('my-1 h-px bg-[var(--color-border)]', className)}
    {...props}
  />
))
SelectSeparator.displayName = 'SelectSeparator'

export const SelectLabel = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Label>
>(({ className, ...props }, ref) => (
  <RadixSelect.Label
    ref={ref}
    className={cn(
      'px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]',
      className
    )}
    {...props}
  />
))
SelectLabel.displayName = 'SelectLabel'
