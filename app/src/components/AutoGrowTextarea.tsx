import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

interface AutoGrowTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxHeight?: number
}

export function AutoGrowTextarea({
  maxHeight = 160,
  value,
  className = '',
  ...props
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const textarea = ref.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [maxHeight, value])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={`resize-none leading-6 ${className}`}
      {...props}
    />
  )
}
