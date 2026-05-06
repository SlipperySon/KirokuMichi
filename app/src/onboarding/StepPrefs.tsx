import { useIntl } from 'react-intl'
import { useAppStore } from '../store'

interface Props {
  onNext: () => void
}

export function StepPrefs({ onNext }: Props) {
  const intl = useIntl()
  const { settings, updateSettings } = useAppStore()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold">{intl.formatMessage({ id: 'onboarding.prefs.title' })}</h2>

      <div className="flex flex-col gap-6 w-full">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {intl.formatMessage({ id: 'onboarding.prefs.daily_limit' })}: {settings.dailyCardLimit}
          </label>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={settings.dailyCardLimit}
            onChange={e => updateSettings({ dailyCardLimit: Number(e.target.value) })}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>5</span><span>100</span>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.furiganaEnabled}
            onChange={e => updateSettings({ furiganaEnabled: e.target.checked })}
            className="w-5 h-5 accent-indigo-600"
          />
          <span>{intl.formatMessage({ id: 'onboarding.prefs.furigana' })}</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.romajiEnabled}
            onChange={e => updateSettings({ romajiEnabled: e.target.checked })}
            className="w-5 h-5 accent-indigo-600"
          />
          <span>{intl.formatMessage({ id: 'onboarding.prefs.romaji' })}</span>
        </label>
      </div>

      <button
        onClick={onNext}
        className="w-full px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
      >
        {intl.formatMessage({ id: 'onboarding.prefs.continue' })}
      </button>
    </div>
  )
}
