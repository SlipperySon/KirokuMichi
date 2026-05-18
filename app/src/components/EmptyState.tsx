/**
 * EmptyState — consistent zero-data placeholder.
 *
 * Use whenever a list, dashboard panel, or feed has no items to show.
 * Always include an icon, a title, a short description, and (when possible)
 * a primary action.
 */

import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** Compact variant for inline use (panels, cards) */
  compact?: boolean
}

export function EmptyState({
  icon = '✨',
  title,
  description,
  action,
  className = '',
  compact = false,
}: EmptyStateProps) {
  const padding = compact ? 'p-6' : 'py-12 px-6'
  const iconSize = compact ? 'text-3xl' : 'text-5xl'
  const titleSize = compact ? 'text-base' : 'text-lg'

  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-3 ${padding} ${className}`}
    >
      <div className={`${iconSize}`} aria-hidden>
        {icon}
      </div>
      <h3 className={`${titleSize} font-semibold text-gray-900 dark:text-gray-100`}>{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
