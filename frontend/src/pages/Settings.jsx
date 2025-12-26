import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import { ThemeContext } from '../contexts/ThemeContext'
import {
  Palette, Bell, Sun, Moon, Check, RefreshCw, Download
} from 'lucide-react'

// Reduzido de 10 para 5 cores
const colorOptions = [
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#10b981' },
  { name: 'Roxo', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Laranja', value: '#f97316' }
]

export default function Settings() {
  const { theme, setTheme, primaryColor, setPrimaryColor, colors, isDark } = useContext(ThemeContext)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings')
      setSettings(data.settings)
    } catch (error) {
      console.error('Erro ao buscar configurações:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    showMessage('Tema alterado!', 'success')
  }

  const handleColorChange = (color) => {
    setPrimaryColor(color)
    showMessage('Cor alterada!', 'success')
  }

  const handleNotificationChange = async (field, value) => {
    const newNotifications = { ...settings.notifications, [field]: value }
    setSettings({ ...settings, notifications: newNotifications })
    try {
      await api.put('/settings/notifications', { [field]: value })
    } catch (error) {
      console.error('Erro ao salvar:', error)
    }
  }

  const exportData = async () => {
    try {
      const { data } = await api.post('/profile/export-data')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `moneytrack-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      showMessage('Dados exportados!', 'success')
    } catch (error) {
      console.error('Erro ao exportar:', error)
      showMessage('Erro ao exportar dados', 'error')
    }
  }

  const showMessage = (text, type) => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={32} />
        <p>Carregando...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: colors.text, marginBottom: '24px' }}>
        Configurações
      </h1>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: message.type === 'success' ? '#16a34a' : '#dc2626',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Check size={18} />
          {message.text}
        </div>
      )}

      {/* Aparência */}
      <div style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '16px',
        border: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Palette size={20} color={primaryColor} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: colors.text }}>Aparência</h2>
        </div>

        {/* Tema */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '14px', fontWeight: '500', color: colors.textSecondary, marginBottom: '12px' }}>
            Tema
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            {['light', 'dark', 'system'].map(t => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                style={{
                  flex: 1,
                  padding: '16px',
                  borderRadius: '12px',
                  border: theme === t ? `2px solid ${primaryColor}` : `2px solid ${colors.border}`,
                  background: t === 'dark' ? '#1e293b' : colors.backgroundCard,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: t === 'light' ? '#fef3c7' : t === 'dark' ? '#334155' : 'linear-gradient(135deg, #fef3c7 50%, #334155 50%)',
                  margin: '0 auto 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {t === 'light' ? <Sun size={18} style={{ color: '#f59e0b' }} /> :
                   t === 'dark' ? <Moon size={18} style={{ color: '#94a3b8' }} /> :
                   <RefreshCw size={18} style={{ color: '#64748b' }} />}
                </div>
                <p style={{ fontWeight: '500', color: t === 'dark' ? '#f1f5f9' : colors.text, margin: 0, fontSize: '14px' }}>
                  {t === 'light' ? 'Claro' : t === 'dark' ? 'Escuro' : 'Sistema'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Cor Principal */}
        <div>
          <p style={{ fontSize: '14px', fontWeight: '500', color: colors.textSecondary, marginBottom: '12px' }}>
            Cor Principal
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            {colorOptions.map(color => (
              <button
                key={color.value}
                onClick={() => handleColorChange(color.value)}
                title={color.name}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: color.value,
                  border: primaryColor === color.value ? '4px solid #1e293b' : '4px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {primaryColor === color.value && <Check size={18} style={{ color: '#fff' }} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notificações - Simplificado para apenas 2 opções */}
      <div style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '16px',
        border: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Bell size={20} color={primaryColor} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: colors.text }}>Notificações</h2>
        </div>

        {[
          { id: 'billReminders', label: 'Lembretes de Contas', desc: 'Notificar antes do vencimento' },
          { id: 'budgetAlerts', label: 'Alertas de Orçamento', desc: 'Aviso ao se aproximar do limite' }
        ].map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: `1px solid ${colors.border}`
            }}
          >
            <div>
              <p style={{ fontWeight: '500', color: colors.text, margin: 0 }}>{item.label}</p>
              <p style={{ fontSize: '13px', color: colors.textSecondary, margin: 0 }}>{item.desc}</p>
            </div>
            <label style={{ position: 'relative', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings?.notifications?.[item.id] ?? true}
                onChange={(e) => handleNotificationChange(item.id, e.target.checked)}
                style={{ opacity: 0, position: 'absolute' }}
              />
              <div style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                background: settings?.notifications?.[item.id] ? primaryColor : (isDark ? '#4b5563' : '#e2e8f0'),
                transition: 'background 0.2s',
                position: 'relative'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: settings?.notifications?.[item.id] ? '22px' : '2px',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>
            </label>
          </div>
        ))}
      </div>

      {/* Exportar Dados */}
      <div style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: '12px',
        padding: '24px',
        border: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Download size={20} color={primaryColor} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: colors.text }}>Exportar Dados</h2>
        </div>
        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '16px' }}>
          Baixe todos os seus dados em formato JSON
        </p>
        <button
          onClick={exportData}
          style={{
            padding: '10px 20px',
            background: primaryColor,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Download size={16} />
          Exportar Tudo
        </button>
      </div>
    </div>
  )
}
