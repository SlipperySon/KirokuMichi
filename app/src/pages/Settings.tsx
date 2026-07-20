import { useState } from 'react'
import { useIntl } from 'react-intl'
import { useAppStore } from '../store'
import { useTheme } from '../hooks/useTheme'
import { Navigation } from '../components/Navigation'
import { KeyboardShortcutsPanel } from '../components/KeyboardShortcutsPanel'
import { toast } from '../components/toastStore'

type ProviderType = 'anthropic' | 'openai' | 'openrouter' | 'deepseek' | 'ollama' | 'custom' | null
type ConfigurableProvider = Exclude<ProviderType, null>

const PROVIDER_INFO: Record<ConfigurableProvider, { label: string; description: string }> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    description: 'Direct access to Claude models.'
  },
  openai: {
    label: 'OpenAI (GPT)',
    description: 'Direct access to GPT models.'
  },
  openrouter: {
    label: 'OpenRouter',
    description: '100+ models (Claude, GPT, Llama, Mistral). Single API key, no vendor lock-in.'
  },
  deepseek: {
    label: 'DeepSeek',
    description: 'Direct access to DeepSeek models using a DeepSeek API key.'
  },
  ollama: {
    label: 'Ollama (Local)',
    description: 'Run models locally. Free, no API key needed, no internet required.'
  },
  custom: {
    label: 'Custom Provider',
    description: 'Self-hosted or proprietary endpoint. Must be OpenAI-compatible.'
  }
}

const PROVIDER_DEFAULTS: Record<ConfigurableProvider, { fastModel: string; powerfulModel: string }> = {
  anthropic: { fastModel: 'claude-haiku-4-5-20251001', powerfulModel: 'claude-sonnet-4-6' },
  openai: { fastModel: 'gpt-3.5-turbo', powerfulModel: 'gpt-4' },
  openrouter: { fastModel: 'mistralai/mistral-7b-instruct', powerfulModel: 'anthropic/claude-3-sonnet' },
  deepseek: { fastModel: 'deepseek-v4-flash', powerfulModel: 'deepseek-v4-pro' },
  ollama: { fastModel: 'llama2', powerfulModel: 'llama2' },
  custom: { fastModel: 'your-model-name', powerfulModel: 'your-model-name' },
}

export function Settings() {
  const intl = useIntl()
  const settings = useAppStore(s => s.settings)
  const updateSettings = useAppStore(s => s.updateSettings)
  const activeUserId = useAppStore(s => s.activeUserId)
  const { theme, setTheme } = useTheme()

  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleProviderChange = (provider: ProviderType) => {
    const defaults = provider ? PROVIDER_DEFAULTS[provider] : null
    updateSettings({
      aiProvider: provider,
      ...(defaults ? defaults : {}),
    })
    setTestResult(null)
  }

  const handleEndpointChange = (endpoint: string) => {
    updateSettings({ apiEndpoint: endpoint })
  }

  const handleApiKeyChange = (key: string) => {
    updateSettings({ apiKey: key || null })
  }

  const handleFastModelChange = (model: string) => {
    updateSettings({ fastModel: model })
  }

  const handlePowerfulModelChange = (model: string) => {
    updateSettings({ powerfulModel: model })
  }

  const refreshSessionToken = async () => {
    const response = await fetch('/api/session', { method: 'POST', credentials: 'include' })
    if (!response.ok) throw new Error('Could not refresh session token')
    const data = await response.json() as { token: string }
    updateSettings({ sessionToken: data.token })
    return data.token
  }

  const requestTestConnection = (token: string, signal: AbortSignal) => fetch('/api/ai/complete', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-session-token': token
    },
    signal,
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
      system: 'You are a helpful assistant.',
      tier: 'fast',
      provider: settings.aiProvider,
      apiKey: settings.apiKey,
      apiEndpoint: settings.apiEndpoint,
      fastModel: settings.fastModel,
      powerfulModel: settings.powerfulModel,
      maxTokens: 16
    })
  })

  const testConnection = async () => {
    if (!settings.aiProvider || (settings.aiProvider === 'ollama' || settings.aiProvider === 'custom') && !settings.apiEndpoint) {
      setTestResult({ ok: false, message: 'Please enter a provider endpoint' })
      toast.error('Please enter a provider endpoint')
      return
    }

    setTestLoading(true)
    setTestResult(null)

    try {
      let token = settings.sessionToken
      if (!token) {
        token = await refreshSessionToken()
      }

      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 90000)
      let response = await requestTestConnection(token, controller.signal)
      if (response.status === 401) {
        token = await refreshSessionToken()
        response = await requestTestConnection(token, controller.signal)
      }
      window.clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json() as { text: string }
        setTestResult({
          ok: true,
          message: `✓ Connected! Response: "${data.text.substring(0, 50)}${data.text.length > 50 ? '...' : ''}"`
        })
        toast.success('AI provider connected')
      } else {
        const error = await response.json() as { error: string }
        setTestResult({
          ok: false,
          message: `✗ Error: ${error.error || 'Unknown error'}`
        })
        toast.error(error.error || 'AI provider test failed')
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === 'AbortError'
        ? '✗ Connection timed out after 90 seconds. Check the model availability or try again.'
        : `✗ Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      setTestResult({ ok: false, message })
      toast.error(message.replace(/^✗\s*/, ''))
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <Navigation />
      <div className="p-8 flex-1">
        <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Settings</h1>
          <p className="text-gray-400">Configure your learning preferences and AI provider</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* AI Provider Section */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4 text-center">AI Provider</h2>
            <p className="text-sm text-gray-400 mb-6 text-center">
              {intl.formatMessage({ id: 'settings.ai_provider_hint' })}
            </p>

            {/* Provider Selection */}
            <div className="space-y-3 mb-6">
              {(['anthropic', 'openai', 'openrouter', 'deepseek', 'ollama', 'custom'] as const).map(provider => (
                <label key={provider} className="relative flex items-center justify-center p-4 border rounded-lg cursor-pointer hover:bg-gray-800 transition text-center" style={{
                  borderColor: settings.aiProvider === provider ? '#3b82f6' : '#374151',
                  backgroundColor: settings.aiProvider === provider ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                }}>
                  <input
                    type="radio"
                    name="provider"
                    checked={settings.aiProvider === provider}
                    onChange={() => handleProviderChange(provider)}
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                  />
                  <div className="px-8">
                    <div className="font-semibold text-gray-100">{PROVIDER_INFO[provider].label}</div>
                    <div className="text-sm text-gray-400 mt-1">{PROVIDER_INFO[provider].description}</div>
                  </div>
                </label>
              ))}
            </div>

            {settings.aiProvider && settings.aiProvider !== 'ollama' && settings.aiProvider !== 'custom' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  {intl.formatMessage({ id: 'settings.api_key' })}
                </label>
                <input
                  type="password"
                  value={settings.apiKey || ''}
                  onChange={e => handleApiKeyChange(e.target.value)}
                  placeholder="Optional: use your own key for this browser session"
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Server keys are used by default when configured. Your key is session-only and is not saved across reloads.
                </p>
              </div>
            )}

            {/* Ollama Endpoint Input */}
            {settings.aiProvider === 'ollama' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  Ollama Endpoint
                </label>
                <input
                  type="text"
                  value={settings.apiEndpoint || ''}
                  onChange={e => handleEndpointChange(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Make sure Ollama is running: <code className="bg-gray-100 px-2 py-1 rounded">ollama serve</code>
                </p>
              </div>
            )}

            {/* Custom Endpoint Input */}
            {settings.aiProvider === 'custom' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  {intl.formatMessage({ id: 'settings.api_endpoint' })}
                </label>
                <input
                  type="text"
                  value={settings.apiEndpoint || ''}
                  onChange={e => handleEndpointChange(e.target.value)}
                  placeholder="https://my-llm.example.com/v1/chat"
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {intl.formatMessage({ id: 'settings.api_endpoint_hint' })}
                </p>
              </div>
            )}

            {/* Test Connection Button */}
            {settings.aiProvider && (
              <div className="mb-6">
                <button
                  onClick={testConnection}
                  disabled={testLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition"
                >
                  {testLoading ? 'Testing...' : 'Test Connection'}
                </button>
                {testResult && (
                  <div className={`mt-3 p-3 rounded-lg ${testResult.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {testResult.message}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Model Configuration */}
          {settings.aiProvider && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-100 mb-4 text-center">Model Configuration</h2>

              <div className="space-y-6">
                {/* Fast Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                    {intl.formatMessage({ id: 'settings.fast_model' })}
                  </label>
                  <input
                    type="text"
                    value={settings.fastModel}
                    onChange={e => handleFastModelChange(e.target.value)}
                    placeholder="e.g. gpt-3.5-turbo, claude-haiku-4-5-20251001, llama2"
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {intl.formatMessage({ id: 'settings.fast_model_hint' })}
                  </p>
                </div>

                {/* Powerful Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                    {intl.formatMessage({ id: 'settings.powerful_model' })}
                  </label>
                  <input
                    type="text"
                    value={settings.powerfulModel}
                    onChange={e => handlePowerfulModelChange(e.target.value)}
                    placeholder="e.g. gpt-4, claude-sonnet-4-6, llama2-70b"
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {intl.formatMessage({ id: 'settings.powerful_model_hint' })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Learning Preferences */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4 text-center">Learning Preferences</h2>

            <div className="space-y-6">
              {/* SRS Algorithm */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  {intl.formatMessage({ id: 'settings.scheduler' })}
                </label>
                <select
                  value={settings.schedulerAlgorithm}
                  onChange={e => updateSettings({ schedulerAlgorithm: e.target.value as 'fsrs' | 'sm2' })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fsrs">FSRS (Free Spaced Repetition Scheduler)</option>
                  <option value="sm2">SM-2 (SuperMemo 2)</option>
                </select>
              </div>

              {/* JLPT Target */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  {intl.formatMessage({ id: 'settings.jlpt_target' })}
                </label>
                <select
                  value={settings.jlptTarget}
                  onChange={e => updateSettings({ jlptTarget: e.target.value as 'N5' | 'N4' | 'N3' | 'N2' | 'N1' })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="N5">N5 (Beginner)</option>
                  <option value="N4">N4 (Elementary)</option>
                  <option value="N3">N3 (Intermediate)</option>
                  <option value="N2">N2 (Advanced)</option>
                  <option value="N1">N1 (Proficient)</option>
                </select>
              </div>

              {/* Daily Card Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  {intl.formatMessage({ id: 'settings.daily_limit' })}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.dailyCardLimit}
                  onChange={e => updateSettings({ dailyCardLimit: parseInt(e.target.value) || 20 })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Daily Goal */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  Daily goal (cards)
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={settings.dailyGoal}
                  onChange={e => updateSettings({ dailyGoal: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Daily ring fills as you review · streak freeze tokens auto-award at 7/14/30 days
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-700 p-3 cursor-pointer hover:bg-gray-800/60">
                <input
                  type="checkbox"
                  checked={settings.includeExtraInToday ?? false}
                  onChange={e => updateSettings({ includeExtraInToday: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-200 text-left">Include Extra Anki decks in Today</span>
                  <span className="block text-xs text-gray-500 mt-1 text-left">
                    Off by default. Imported .apkg dues stay under Review → Extra unless enabled.
                  </span>
                </span>
              </label>

              {/* Hover Delay */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  {intl.formatMessage({ id: 'settings.hover_delay' })}
                </label>
                <input
                  type="number"
                  min="100"
                  max="5000"
                  step="100"
                  value={settings.hoverDelayMs}
                  onChange={e => updateSettings({ hoverDelayMs: parseInt(e.target.value) || 2000 })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">Milliseconds before showing answer on card hover</p>
              </div>

              {/* Furigana Toggle */}
              <label className="relative flex items-center justify-center p-3 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 cursor-pointer hover:bg-gray-700 text-center">
                <input
                  type="checkbox"
                  checked={settings.furiganaEnabled}
                  onChange={e => updateSettings({ furiganaEnabled: e.target.checked })}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
                />
                <div className="px-8">
                  <div className="font-medium text-gray-100">Show furigana by default</div>
                  <div className="text-xs text-gray-400">Reading pronunciation above kanji</div>
                </div>
              </label>

              {/* Romaji Toggle */}
              <label className="relative flex items-center justify-center p-3 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 cursor-pointer hover:bg-gray-700 text-center">
                <input
                  type="checkbox"
                  checked={settings.romajiEnabled}
                  onChange={e => updateSettings({ romajiEnabled: e.target.checked })}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
                />
                <div className="px-8">
                  <div className="font-medium text-gray-100">Show rōmaji</div>
                  <div className="text-xs text-gray-400">Roman character spelling</div>
                </div>
              </label>
            </div>
          </div>

          {/* Theme Settings */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div>
                <p className="font-semibold text-gray-100">Theme</p>
                <p className="text-xs text-gray-400 mt-1">Choose between dark and light mode</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🌙 Dark
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    theme === 'light'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  ☀️ Light
                </button>
              </div>
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <KeyboardShortcutsPanel />
          </div>

          {/* Advanced Settings */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="mx-auto flex items-center space-x-2 text-gray-100 hover:text-indigo-400 transition"
            >
              <span className="text-lg">{showAdvanced ? '▼' : '▶'}</span>
              <span className="font-semibold">Advanced Settings</span>
            </button>

            {showAdvanced && (
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 text-center">Active User ID</label>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-center">
                    {activeUserId || 'Not set'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    localStorage.removeItem('kiroku-michi-app')
                    window.location.reload()
                  }}
                  className="block mx-auto px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  Clear All Data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
