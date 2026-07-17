import { useIntl } from 'react-intl'

interface Props {
  onDone: () => void
  busy?: boolean
}

function detectPlatform(): 'macos' | 'windows' | 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  if (/mac os x/.test(ua)) return 'macos'
  if (/windows/.test(ua)) return 'windows'
  return 'other'
}

export function StepIME({ onDone, busy = false }: Props) {
  const intl = useIntl()
  const platform = detectPlatform()

  const platforms = ['macos', 'windows', 'ios', 'android'] as const

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold">{intl.formatMessage({ id: 'onboarding.ime.title' })}</h2>
      <p className="text-gray-600 text-center">{intl.formatMessage({ id: 'onboarding.ime.description' })}</p>

      <div className="flex flex-col gap-3 w-full">
        {platforms.map(p => (
          <div
            key={p}
            className={`px-4 py-3 rounded-xl text-sm border-2 transition-colors ${
              p === platform
                ? 'border-indigo-400 bg-indigo-50 text-indigo-800 font-medium'
                : 'border-gray-100 text-gray-500'
            }`}
          >
            {intl.formatMessage({ id: `onboarding.ime.${p}` })}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={onDone}
          disabled={busy}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
        >
          {busy ? 'Starting your first lesson…' : intl.formatMessage({ id: 'onboarding.ime.done' })}
        </button>
        <button onClick={onDone} disabled={busy} className="text-gray-500 hover:text-gray-700 text-sm disabled:opacity-60">
          {intl.formatMessage({ id: 'onboarding.ime.skip' })}
        </button>
      </div>
    </div>
  )
}
