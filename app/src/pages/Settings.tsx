import { useState } from 'react'
import { useIntl } from 'react-intl'
import { useAppStore } from '../store'
import { useTheme } from '../hooks/useTheme'
import { Navigation } from '../components/Navigation'

type ProviderType = 'anthropic' | 'openai' | 'openrouter' | 'ollama' | 'custom' | null

const PROVIDER_INFO: Record<ProviderType, { label: string; description: string }> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    description: 'Direct access to Claude models. Requires ANTHROPIC_API_KEY.'
  },
  openai: {
    label: 'OpenAI (GPT)',
    description: 'Direct access to GPT models. Requires OPENAI_API_KEY.'
  },
  openrouter: {
    label: 'OpenRouter',
    description: '100+ models (Claude, GPT, Llama, Mistral). Single API key, no vendor lock-in.'
  },
  ollama: {
    label: 'Ollama (Local)',
    description: 'Run models locally. Free, no API key needed, no internet required.'
  },
  custom: {
    label: 'Custom Provider',
    description: 'Self-hosted or proprietary endpoint. Must be OpenAI-compatible.'
  },
  null: {
    label: 'None',
    description: 'No AI provider configured.'
  }
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
    updateSettings({ aiProvider: provider })
    setTestResult(null)
  }

  const handleApiKeyChange = (key: string) => {
    updateSettings({ apiKey: key })
  }

  const handleEndpointChange = (endpoint: string) => {
    updateSettings({ apiEndpoint: endpoint })
  }

  const handleFastModelChange = (model: string) => {
    updateSettings({ fastModel: model })
  }

  const handlePowerfulModelChange = (model: string) => {
    updateSettings({ powerfulModel: model })
  }

  const testConnection = async () => {
    if (!settings.aiProvider || settings.aiProvider === 'ollama' && !settings.apiEndpoint) {
      if (settings.aiProvider === 'ollama') {
        setTestResult({ ok: false, message: 'Please enter Ollama endpoint' })
      } else {
        setTestResult({ ok: false, message: 'Please configure API key' })
      }
      return
    }

    setTestLoading(true)
    setTestResult(null)

    try {
      const token = settings.sessionToken
      if (!token) {
        setTestResult({ ok: false, message: 'No session token. Please refresh and try again.' })
        setTestLoading(false)
        return
      }

      const response = await fetch('/api/ai/complete', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-session-token': token
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
          system: 'You are a helpful assistant.',
          tier: 'fast',
          provider: settings.aiProvider,
          fastModel: settings.fastModel,
          powerfulModel: settings.powerfulModel
        })
      })

      if (response.ok) {
        const data = await response.json() as { text: string }
        setTestResult({
          ok: true,
          message: `✓ Connected! Response: "${data.text.substring(0, 50)}${data.text.length > 50 ? '...' : ''}"`
        })
      } else {
        const error = await response.json() as { error: string }
        setTestResult({
          ok: false,
          message: `✗ Error: ${error.error || 'Unknown error'}`
        })
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: `✗ Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      })
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Settings</h1>
          <p className="text-gray-400">Configure your learning preferences and AI provider</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* AI Provider Section */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">AI Provider</h2>
            <p className="text-sm text-gray-400 mb-6">
              {intl.formatMessage({ id: 'settings.ai_provider_hint' })}
            </p>

            {/* Provider Selection */}
            <div className="space-y-3 mb-6">
              {(['anthropic', 'openai', 'openrouter', 'ollama', 'custom'] as const).map(provider => (
                <label key={provider} className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-800 transition" style={{
                  borderColor: settings.aiProvider === provider ? '#3b82f6' : '#374151',
                  backgroundColor: settings.aiProvider === provider ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                }}>
                  <input
                    type="radio"
                    name="provider"
                    checked={settings.aiProvider === provider}
                    onChange={() => handleProviderChange(provider)}
                    className="mt-1 mr-4"
                  />
                  <div>
                    <div className="font-semibold text-gray-100">{PROVIDER_INFO[provider].label}</div>
                    <div className="text-sm text-gray-400 mt-1">{PROVIDER_INFO[provider].description}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* API Key Input */}
            {settings.aiProvider && settings.aiProvider !== 'ollama' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {intl.formatMessage({ id: 'settings.api_key' })}
                </label>
                <input
                  type="password"
                  value={settings.apiKey || ''}
                  onChange={e => handleApiKeyChange(e.target.value)}
                  placeholder={
                    settings.aiProvider === 'anthropic' ? 'sk-ant-...' :
                    settings.aiProvider === 'openai' ? 'sk-...' :
                    settings.aiProvider === 'openrouter' ? 'sk-or-...' :
                    'your-api-key'
                  }
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {intl.formatMessage({ id: 'settings.api_key_hint' })}
                </p>
              </div>
            )}

            {/* Ollama Endpoint Input */}
            {settings.aiProvider === 'ollama' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ollama Endpoint
                </label>
                <input
                  type="text"
                  value={settings.apiEndpoint || ''}
                  onChange={e => handleEndpointChange(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Make sure Ollama is running: <code className="bg-gray-100 px-2 py-1 rounded">ollama serve</code>
                </p>
              </div>
            )}

            {/* Custom Endpoint Input */}
            {settings.aiProvider === 'custom' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {intl.formatMessage({ id: 'settings.api_endpoint' })}
                </label>
                <input
                  type="text"
                  value={settings.apiEndpoint || ''}
                  onChange={e => handleEndpointChange(e.target.value)}
                  placeholder="https://my-llm.example.com/v1/chat"
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <h2 className="text-xl font-semibold text-gray-100 mb-4">Model Configuration</h2>

              <div className="space-y-6">
                {/* Fast Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {intl.formatMessage({ id: 'settings.fast_model' })}
                  </label>
                  <input
                    type="text"
                    value={settings.fastModel}
                    onChange={e => handleFastModelChange(e.target.value)}
                    placeholder="e.g. gpt-3.5-turbo, claude-haiku-4-5-20251001, llama2"
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {intl.formatMessage({ id: 'settings.fast_model_hint' })}
                  </p>
                </div>

                {/* Powerful Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {intl.formatMessage({ id: 'settings.powerful_model' })}
                  </label>
                  <input
                    type="text"
                    value={settings.powerfulModel}
                    onChange={e => handlePowerfulModelChange(e.target.value)}
                    placeholder="e.g. gpt-4, claude-sonnet-4-6, llama2-70b"
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Learning Preferences</h2>

            <div className="space-y-6">
              {/* SRS Algorithm */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {intl.formatMessage({ id: 'settings.scheduler' })}
                </label>
                <select
                  value={settings.schedulerAlgorithm}
                  onChange={e => updateSettings({ schedulerAlgorithm: e.target.value as 'fsrs' | 'sm2' })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fsrs">FSRS (Free Spaced Repetition Scheduler)</option>
                  <option value="sm2">SM-2 (SuperMemo 2)</option>
                </select>
              </div>

              {/* JLPT Target */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {intl.formatMessage({ id: 'settings.jlpt_target' })}
                </label>
                <select
                  value={settings.jlptTarget}
                  onChange={e => updateSettings({ jlptTarget: e.target.value as 'N5' | 'N4' | 'N3' | 'N2' | 'N1' })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {intl.formatMessage({ id: 'settings.daily_limit' })}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.dailyCardLimit}
                  onChange={e => updateSettings({ dailyCardLimit: parseInt(e.target.value) || 20 })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Hover Delay */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {intl.formatMessage({ id: 'settings.hover_delay' })}
                </label>
                <input
                  type="number"
                  min="100"
                  max="5000"
                  step="100"
                  value={settings.hoverDelayMs}
                  onChange={e => updateSettings({ hoverDelayMs: parseInt(e.target.value) || 2000 })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">Milliseconds before showing answer on card hover</p>
              </div>

              {/* Furigana Toggle */}
              <label className="flex items-center space-x-3 p-3 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 cursor-pointer hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={settings.furiganaEnabled}
                  onChange={e => updateSettings({ furiganaEnabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-gray-100">Show furigana by default</div>
                  <div className="text-xs text-gray-400">Reading pronunciation above kanji</div>
                </div>
              </label>

              {/* Romaji Toggle */}
              <label className="flex items-center space-x-3 p-3 border border-gray-600 rounded-lg bg-gray-800 text-gray-100 cursor-pointer hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={settings.romajiEnabled}
                  onChange={e => updateSettings({ romajiEnabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-gray-100">Show rōmaji</div>
                  <div className="text-xs text-gray-400">Roman character spelling</div>
                </div>
              </label>
            </div>
          </div>

          {/* Theme Settings */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
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

          {/* Advanced Settings */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-gray-100 hover:text-indigo-400 transition"
            >
              <span className="text-lg">{showAdvanced ? '▼' : '▶'}</span>
              <span className="font-semibold">Advanced Settings</span>
            </button>

            {showAdvanced && (
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Session Token</label>
                  <input
                    type="text"
                    value={settings.sessionToken || ''}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs font-mono text-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    This token is generated automatically. Do not share it.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Active User ID</label>
                  <div className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300">
                    {activeUserId || 'Not set'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    localStorage.removeItem('kiroku-michi-app')
                    window.location.reload()
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
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
