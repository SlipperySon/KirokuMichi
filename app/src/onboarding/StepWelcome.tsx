import { useIntl } from 'react-intl'

interface Props {
  onNext: () => void
}

export function StepWelcome({ onNext }: Props) {
  const intl = useIntl()
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight">
          {intl.formatMessage({ id: 'onboarding.welcome.title' })}
        </h1>
        <p className="text-xl text-gray-500" lang="ja">
          {intl.formatMessage({ id: 'onboarding.welcome.subtitle' })}
        </p>
      </div>
      <p className="max-w-md text-gray-600">
        {intl.formatMessage({ id: 'onboarding.welcome.description' })}
      </p>
      <button
        onClick={onNext}
        className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-lg font-semibold hover:bg-indigo-700 transition-colors"
      >
        {intl.formatMessage({ id: 'onboarding.welcome.start' })}
      </button>
    </div>
  )
}
