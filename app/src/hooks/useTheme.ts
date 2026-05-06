import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    // Load theme preference from localStorage, default to dark
    const saved = localStorage.getItem('kiroku-michi-theme') as Theme | null
    const initial = saved || 'dark'
    setThemeState(initial)
    applyTheme(initial)
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('kiroku-michi-theme', t)
    applyTheme(t)
  }

  return { theme, setTheme }
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
    document.body.classList.remove('light')
  } else {
    document.documentElement.classList.remove('dark')
    document.body.classList.add('light')
  }
}
