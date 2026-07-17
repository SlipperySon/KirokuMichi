import { useState } from 'react'
import { useIntl } from 'react-intl'
import { useAppStore } from '../store'

type ProviderType = 'anthropic' | 'openai' | 'openrouter' | 'deepseek' | 'ollama' | 'custom' | null
type ConfigurableProvider = Exclude<ProviderType, null>

interface Props {
  onNext: () => void
}

const PROVIDER_DEFAULTS: Record<ConfigurableProvider, { fastModel: string; powerfulModel: string }> = {
  anthropic: {
    fastModel: 'claude-haiku-4-5-20251001',
    powerfulModel: 'claude-sonnet-4-6',
  },
  openai: {
    fastModel: 'gpt-3.5-turbo',
    powerfulModel: 'gpt-4',
  },
  openrouter: {
    fastModel: 'mistralai/mistral-7b-instruct',
    powerfulModel: 'anthropic/claude-3-sonnet',
  },
  deepseek: {
    fastModel: 'deepseek-v4-flash',
    powerfulModel: 'deepseek-v4-pro',
  },
  ollama: {
    fastModel: 'llama2',
    powerfulModel: 'llama2',
  },
  custom: {
    fastModel: 'your-model-name',
    powerfulModel: 'your-model-name',
  },
}

const PROVIDER_INFO: Record<ConfigurableProvider, { label: string; description: string }> = {
  anthropic: { label: 'Anthropic (Claude)', description: 'High-quality Claude models' },
  openai: { label: 'OpenAI (GPT)', description: 'GPT-4 and GPT-3.5 Turbo' },
  openrouter: { label: 'OpenRouter', description: '100+ models in one API' },
  deepseek: { label: 'DeepSeek', description: 'DeepSeek API models' },
  ollama: { label: 'Ollama (Local)', description: 'Run models locally, no cost' },
  custom: { label: 'Custom Provider', description: 'Self-hosted or proprietary endpoint' },
}

const SKIP_PROVIDER_INFO = { label: 'Skip for now', description: 'Configure later in Settings' }

export function StepAI({ onNext }: Props) {
  const intl = useIntl()
  const { settings, updateSettings } = useAppStore()
  const [provider, setProvider] = useState<ProviderType>(settings.aiProvider || null)
  const [apiKey, setApiKey] = useState(settings.apiKey || '')
  const [customEndpoint, setCustomEndpoint] = useState('')
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434')
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [showAdvanced, setShowAdvanced] = useState(false)

  async function testConnection() {
    if (!provider || provider === 'custom' && !customEndpoint) {
      setStatus('fail')
      return
    }

    setStatus('testing')
    try {
      const defaults = PROVIDER_DEFAULTS[provider]
      const response = await fetch('/api/ai/complete', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-session-token': settings.sessionToken ?? '',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say OK' }],
          system: 'You are helpful.',
          tier: 'fast',
          provider,
          apiKey: apiKey || null,
          apiEndpoint: provider === 'custom' ? customEndpoint : provider === 'ollama' ? ollamaEndpoint : null,
          fastModel: defaults.fastModel,
          powerfulModel: defaults.powerfulModel,
        }),
      })

      if (response.ok) {
        setStatus('ok')
        handleSaveSettings()
        setTimeout(onNext, 800)
      } else {
        setStatus('fail')
      }
    } catch {
      setStatus('fail')
    }
  }

  function handleSaveSettings() {
    if (!provider) return
    const defaults = PROVIDER_DEFAULTS[provider]
    updateSettings({
      aiProvider: provider,
      apiKey: provider && provider !== 'ollama' && provider !== 'custom' ? apiKey || null : null,
      apiEndpoint: provider === 'ollama' ? ollamaEndpoint : provider === 'custom' ? customEndpoint : null,
      fastModel: defaults.fastModel,
      powerfulModel: defaults.powerfulModel,
    })
  }

  function handleSkip() {
    updateSettings({ aiProvider: null })
    onNext()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900">{intl.formatMessage({ id: 'onboarding.ai.title' })}</h2>
        <p className="text-gray-600 mt-2">{intl.formatMessage({ id: 'onboarding.ai.description' })}</p>
      </div>

      {/* Provider Selection Grid */}
      <div className="w-full grid grid-cols-1 gap-3">
        {(['anthropic', 'openai', 'openrouter', 'deepseek', 'ollama', 'custom', null] as ProviderType[]).map(p => (
          <button
            key={p ?? 'skip'}
            onClick={() => {
              setProvider(p)
              setStatus('idle')
            }}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              provider === p
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-gray-900">{(p ? PROVIDER_INFO[p] : SKIP_PROVIDER_INFO).label}</div>
            <div className="text-sm text-gray-600">{(p ? PROVIDER_INFO[p] : SKIP_PROVIDER_INFO).description}</div>
          </button>
        ))}
      </div>

      {/* Provider-Specific Input */}
      {provider && provider !== 'ollama' && provider !== 'custom' && (
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Optional: use your own key for this browser session"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-gray-500 mt-1">
            Server keys are used by default when configured. Your key is not saved across reloads.
          </p>
        </div>
      )}

      {/* Ollama Endpoint */}
      {provider === 'ollama' && (
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">Ollama Endpoint</label>
          <input
            type="text"
            value={ollamaEndpoint}
            onChange={e => setOllamaEndpoint(e.target.value)}
            placeholder="http://localhost:11434"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-gray-500 mt-1">Make sure Ollama is running: <code className="bg-gray-100 px-1">ollama serve</code></p>
        </div>
      )}

      {/* Custom Endpoint */}
      {provider === 'custom' && (
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">Custom Endpoint URL</label>
          <input
            type="text"
            value={customEndpoint}
            onChange={e => setCustomEndpoint(e.target.value)}
            placeholder="https://my-llm.example.com/v1/chat"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-gray-500 mt-1">Must be OpenAI-compatible API endpoint</p>
        </div>
      )}

      {/* Status Messages */}
      {status === 'ok' && (
        <div className="w-full bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          ✓ {intl.formatMessage({ id: 'onboarding.ai.test_success' })}
        </div>
      )}
      {status === 'fail' && (
        <div className="w-full bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          ✗ {intl.formatMessage({ id: 'onboarding.ai.test_fail' })}
        </div>
      )}

      {/* Advanced Settings Toggle */}
      {provider && provider !== null && (
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          {showAdvanced ? '▼ Hide' : '▶ Show'} default model configuration
        </button>
      )}

      {/* Default Models (Advanced) */}
      {showAdvanced && provider && provider !== null && (
        <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="text-sm">
            <div className="font-semibold text-gray-900">Default models for {PROVIDER_INFO[provider].label}:</div>
            <div className="text-gray-600 mt-2">
              <div>Fast: <code className="bg-white px-2 py-1 rounded text-xs font-mono">{PROVIDER_DEFAULTS[provider].fastModel}</code></div>
              <div>Powerful: <code className="bg-white px-2 py-1 rounded text-xs font-mono">{PROVIDER_DEFAULTS[provider].powerfulModel}</code></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">You can customize these later in Settings after onboarding</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 w-full">
        {provider && provider !== null ? (
          <button
            onClick={testConnection}
            disabled={status === 'testing' || (provider === 'custom' && !customEndpoint) || (provider === 'ollama' && !ollamaEndpoint)}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'testing' ? 'Testing Connection…' : 'Test & Continue'}
          </button>
        ) : (
          <button
            onClick={() => { updateSettings({ aiProvider: null }); onNext() }}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Continue to Next Step
          </button>
        )}

        <button
          onClick={handleSkip}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          {provider ? 'Skip this for now' : 'Already have Settings configured?'}
        </button>
      </div>
    </div>
  )
}
