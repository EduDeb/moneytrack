import { createContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

export const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved || 'light'
  })

  const [primaryColor, setPrimaryColorState] = useState(() => {
    const saved = localStorage.getItem('primaryColor')
    return saved || '#3b82f6'
  })

  const [isLoaded, setIsLoaded] = useState(false)

  // Carregar configurações do servidor ao iniciar
  useEffect(() => {
    const loadSettings = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const { data } = await api.get('/settings')
          if (data.settings) {
            if (data.settings.theme) {
              setThemeState(data.settings.theme)
              localStorage.setItem('theme', data.settings.theme)
            }
            if (data.settings.primaryColor) {
              setPrimaryColorState(data.settings.primaryColor)
              localStorage.setItem('primaryColor', data.settings.primaryColor)
            }
          }
        } catch (error) {
          console.log('Usando configurações locais')
        }
      }
      setIsLoaded(true)
    }
    loadSettings()
  }, [])

  // Salvar no backend quando mudar
  const saveToBackend = useCallback(async (updates) => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        await api.put('/settings', updates)
      } catch (error) {
        console.error('Erro ao salvar configurações:', error)
      }
    }
  }, [])

  // Wrapper para setTheme que salva automaticamente
  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
    saveToBackend({ theme: newTheme })
  }, [saveToBackend])

  // Wrapper para setPrimaryColor que salva automaticamente
  const setPrimaryColor = useCallback((newColor) => {
    setPrimaryColorState(newColor)
    localStorage.setItem('primaryColor', newColor)
    saveToBackend({ primaryColor: newColor })
  }, [saveToBackend])

  // Aplicar tema visualmente
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark')
      document.body.style.background = '#0f172a'
      document.body.style.color = '#f1f5f9'
    } else {
      root.classList.remove('dark')
      document.body.style.background = '#f1f5f9'
      document.body.style.color = '#1e293b'
    }
  }, [theme])

  // Aplicar cor primária visualmente
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', primaryColor)
  }, [primaryColor])

  // Observar mudanças no sistema
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e) => {
        const root = document.documentElement
        if (e.matches) {
          root.classList.add('dark')
          document.body.style.background = '#0f172a'
        } else {
          root.classList.remove('dark')
          document.body.style.background = '#f1f5f9'
        }
      }
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme])

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const colors = {
    background: isDark ? '#0f172a' : '#f1f5f9',
    backgroundCard: isDark ? '#1e293b' : '#ffffff',
    backgroundSecondary: isDark ? '#1e293b' : '#f8fafc',
    text: isDark ? '#f1f5f9' : '#1e293b',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#e2e8f0',
    primary: primaryColor,
    primaryLight: `${primaryColor}20`,
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b'
  }

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      primaryColor,
      setPrimaryColor,
      isDark,
      colors,
      isLoaded
    }}>
      {children}
    </ThemeContext.Provider>
  )
}
