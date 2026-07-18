import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setBetaAccess } from '../betaAccess'
import { toast } from '../components/toastStore'
import { useAppStore } from '../store'

export function BetaLogin() {
  const navigate = useNavigate()
  const setSessionToken = useAppStore(s => s.setSessionToken)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/beta/status', { credentials: 'include' })
      .then(response => response.json() as Promise<{ enabled: boolean }>)
      .then(data => {
        if (cancelled) return
        setEnabled(data.enabled)
        if (!data.enabled) {
          setBetaAccess('open')
          navigate('/', { replace: true })
        }
      })
      .catch(() => {
        if (!cancelled) setEnabled(true)
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  async function submit() {
    setLoading(true)
    try {
      const response = await fetch('/api/beta/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error || 'Invalid beta invite code')
      }
      setBetaAccess('granted')

      // Mint AI session while the HttpOnly beta grant cookie is fresh.
      const sessionResponse = await fetch('/api/session', {
        method: 'POST',
        credentials: 'include',
      })
      if (sessionResponse.ok) {
        const data = await sessionResponse.json() as { token: string }
        setSessionToken(data.token)
      }

      toast.success('Beta access unlocked')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unlock beta access')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">KirokuMichi Beta</h1>
          <p className="text-sm text-slate-400">Enter your invite code to continue.</p>
        </div>
        <div className="space-y-3">
          <input
            value={code}
            onChange={event => setCode(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && code.trim()) void submit()
            }}
            autoFocus
            disabled={loading || enabled === null}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-center font-mono text-sm outline-none focus:border-indigo-400"
            placeholder={enabled === null ? 'Checking access...' : 'Invite code'}
          />
          <button
            onClick={() => void submit()}
            disabled={loading || !code.trim() || enabled === null}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Continue'}
          </button>
        </div>
      </div>
    </main>
  )
}
