import * as RadixSwitch from '@radix-ui/react-switch'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Switch premium — construit sur Radix UI (accessibilité + keyboard + focus trap).
 *
 * État off : fond `muted` / thumb blanc déporté à gauche
 * État on  : fond `navy-solid` / thumb blanc déporté à droite
 *
 * Utilisation :
 *   <Switch checked={enabled} onCheckedChange={setEnabled} />
 *   <Switch checked={enabled} onCheckedChange={setEnabled} label="Scheduler actif" />
 */

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof RadixSwitch.Root> {
  label?: ReactNode
  description?: ReactNode
  size?: 'sm' | 'md'
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, label, description, size = 'md', id, ...props }, ref) => {
    const dims =
      size === 'sm'
        ? { root: 'h-4 w-7', thumb: 'h-3 w-3 data-[state=checked]:translate-x-3' }
        : { root: 'h-5 w-9', thumb: 'h-4 w-4 data-[state=checked]:translate-x-4' }

    const control = (
      <RadixSwitch.Root
        ref={ref}
        id={id}
        className={cn(
          'group relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors cursor-pointer',
          'data-[state=unchecked]:bg-[var(--color-border)] data-[state=checked]:bg-[var(--color-navy-solid)]',
          'hover:data-[state=unchecked]:bg-[var(--color-fg-subtle)]/60',
          'focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--focus-ring)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          dims.root,
          className
        )}
        {...props}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block rounded-full bg-white shadow-sm ring-0 transition-transform pointer-events-none',
            'translate-x-0.5',
            dims.thumb
          )}
        />
      </RadixSwitch.Root>
    )

    if (!label && !description) return control

    return (
      <label
        htmlFor={id}
        className="flex items-start gap-3 cursor-pointer group"
      >
        {control}
        <div className="flex-1 min-w-0 leading-tight">
          {label && (
            <div className="text-sm text-[var(--color-fg)] group-hover:text-[var(--color-fg)]">
              {label}
            </div>
          )}
          {description && (
            <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
              {description}
            </div>
          )}
        </div>
      </label>
    )
  }
)
Switch.displayName = 'Switch'
