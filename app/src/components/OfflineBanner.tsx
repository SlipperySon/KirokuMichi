import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 inset-x-0 z-50 bg-amber-500 text-white text-sm font-medium px-4 py-2 text-center"
    >
      You're offline — AI features unavailable. SRS reviews still work.
    </div>
  )
}
