import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import { ThemeContext } from '../contexts/ThemeContext'
import {
  Settings as SettingsIcon, Palette, Bell, Globe, Shield, Database,
  Sun, Moon, Check, ChevronRight, RefreshCw, Eye, EyeOff
} from 'lucide-react'

const colorOptions = [
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#10b981' },
  { name: 'Roxo', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Laranja', value: '#f97316' },
  { name: 'Vermelho', value: '#ef4444' },
  { name: 'Amarelo', value: '#eab308' },
  { name: 'Ciano', value: '#06b6d4' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Esmeralda', value: '#34d399' }
]

const currencies = [
  { code: 'BRL', name: 'Real Brasileiro', symbol: 'R$' },
  { code: 'USD', name: 'Dólar Americano', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£' }
]

const dateFormats = [
  { value: 'DD/MM/YYYY', label: '31/12/2024' },
  { value: 'MM/DD/YYYY', label: '12/31/2024' },
  { value: 'YYYY-MM-DD', label: '2024-12-31' }
]

export default function Settings() {
  const { theme, setTheme, primaryColor, setPrimaryColor } = useContext(ThemeContext)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('appearance')
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

  const updateSettings = async (updates) => {
    setSaving(true)
    try {
      const { data } = await api.put('/settings', updates)
      setSettings(data.settings)
      showMessage('Configurações salvas!', 'success')
    } catch (error) {
      console.error('Erro ao salvar:', error)
      showMessage('Erro ao salvar configurações', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme) // ThemeContext já salva automaticamente no backend
    showMessage('Tema alterado!', 'success')
  }

  const handleColorChange = (color) => {
    setPrimaryColor(color) // ThemeContext já salva automaticamente no backend
    showMessage('Cor alterada!', 'success')
  }

  const handleNotificationChange = async (field, value) => {
    const newNotifications = { ...settings.notifications, [field]: value }
    setSettings({ ...settings, notifications: newNotifications })
    await api.put('/settings/notifications', { [field]: value })
  }

  const resetSettings = async () => {
    if (window.confirm('Tem certeza que deseja restaurar as configurações padrão?')) {
      try {
        const { data } = await api.post('/settings/reset')
        setSettings(data.settings)
        setTheme('light')
        setPrimaryColor('#3b82f6')
        showMessage('Configurações restauradas!', 'success')
      } catch (error) {
        console.error('Erro ao restaurar:', error)
      }
    }
  }

  const showMessage = (text, type) => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  const sections = [
    { id: 'appearance', label: 'Aparência', icon: Palette },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'regional', label: 'Regional', icon: Globe },
    { id: 'privacy', label: 'Privacidade', icon: Shield },
    { id: 'data', label: 'Dados', icon: Database }
  ]

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={32} />
        <p>Carregando configurações...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
          Configurações
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Personalize sua experiência no MoneyTrack
        </p>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: message.type === 'success' ? '#16a34a' : '#dc2626',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Check size={18} />
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
        {/* Sidebar */}
        <div style={{
          background: '#fff',
          borderRadius: '1rem',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          height: 'fit-content'
        }}>
          {sections.map(section => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  border: 'none',
                  background: activeSection === section.id ? `${primaryColor}10` : 'transparent',
                  borderLeft: activeSection === section.id ? `3px solid ${primaryColor}` : '3px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={20} style={{ color: activeSection === section.id ? primaryColor : '#64748b' }} />
                <span style={{
                  fontWeight: activeSection === section.id ? '600' : '400',
                  color: activeSection === section.id ? '#1e293b' : '#64748b'
                }}>
                  {section.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{
          background: '#fff',
          borderRadius: '1rem',
          border: '1px solid #e2e8f0',
          padding: '1.5rem'
        }}>
          {/* Aparência */}
          {activeSection === 'appearance' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1e293b' }}>
                Aparência
              </h2>

              {/* Tema */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '1rem' }}>
                  Tema
                </h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {['light', 'dark', 'system'].map(t => (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t)}
                      style={{
                        flex: 1,
                        padding: '1.5rem',
                        borderRadius: '0.75rem',
                        border: theme === t ? `2px solid ${primaryColor}` : '2px solid #e2e8f0',
                        background: t === 'dark' ? '#1e293b' : '#fff',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: t === 'light' ? '#fef3c7' : t === 'dark' ? '#334155' : 'linear-gradient(135deg, #fef3c7 50%, #334155 50%)',
                        margin: '0 auto 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {t === 'light' ? <Sun size={20} style={{ color: '#f59e0b' }} /> :
                         t === 'dark' ? <Moon size={20} style={{ color: '#94a3b8' }} /> :
                         <SettingsIcon size={20} style={{ color: '#64748b' }} />}
                      </div>
                      <p style={{
                        fontWeight: '500',
                        color: t === 'dark' ? '#f1f5f9' : '#1e293b',
                        margin: 0
                      }}>
                        {t === 'light' ? 'Claro' : t === 'dark' ? 'Escuro' : 'Sistema'}
                      </p>
                      {theme === t && (
                        <div style={{
                          position: 'absolute',
                          top: '0.5rem',
                          right: '0.5rem',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: primaryColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Check size={12} style={{ color: '#fff' }} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor Principal */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '1rem' }}>
                  Cor Principal
                </h3>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {colorOptions.map(color => (
                    <button
                      key={color.value}
                      onClick={() => handleColorChange(color.value)}
                      title={color.name}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: color.value,
                        border: primaryColor === color.value ? '4px solid #1e293b' : '4px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.2s'
                      }}
                    >
                      {primaryColor === color.value && (
                        <Check size={20} style={{ color: '#fff' }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '1rem' }}>
                  Pré-visualização
                </h3>
                <div style={{
                  padding: '1.5rem',
                  borderRadius: '0.75rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <button style={{
                      padding: '0.5rem 1rem',
                      background: primaryColor,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontWeight: '500'
                    }}>
                      Botão Primário
                    </button>
                    <button style={{
                      padding: '0.5rem 1rem',
                      background: 'transparent',
                      color: primaryColor,
                      border: `2px solid ${primaryColor}`,
                      borderRadius: '0.5rem',
                      fontWeight: '500'
                    }}>
                      Botão Secundário
                    </button>
                  </div>
                  <div style={{
                    padding: '1rem',
                    background: `${primaryColor}15`,
                    borderRadius: '0.5rem',
                    borderLeft: `4px solid ${primaryColor}`
                  }}>
                    <p style={{ margin: 0, color: '#1e293b' }}>
                      Exemplo de destaque com a cor selecionada
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notificações */}
          {activeSection === 'notifications' && settings && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1e293b' }}>
                Notificações
              </h2>

              {[
                { id: 'email', label: 'Notificações por Email', desc: 'Receba atualizações importantes por email' },
                { id: 'push', label: 'Notificações Push', desc: 'Receba alertas no navegador' },
                { id: 'billReminders', label: 'Lembretes de Contas', desc: 'Seja notificado antes do vencimento' },
                { id: 'goalAlerts', label: 'Alertas de Metas', desc: 'Acompanhe o progresso das suas metas' },
                { id: 'weeklyReport', label: 'Relatório Semanal', desc: 'Resumo semanal das suas finanças' },
                { id: 'monthlyReport', label: 'Relatório Mensal', desc: 'Análise completa do mês' },
                { id: 'budgetAlerts', label: 'Alertas de Orçamento', desc: 'Aviso quando se aproximar do limite' }
              ].map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  <div>
                    <p style={{ fontWeight: '500', color: '#1e293b', margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>{item.desc}</p>
                  </div>
                  <label style={{ position: 'relative', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.notifications?.[item.id] ?? true}
                      onChange={(e) => handleNotificationChange(item.id, e.target.checked)}
                      style={{ opacity: 0, position: 'absolute' }}
                    />
                    <div style={{
                      width: '48px',
                      height: '28px',
                      borderRadius: '14px',
                      background: settings.notifications?.[item.id] ? primaryColor : '#e2e8f0',
                      transition: 'background 0.2s',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: '3px',
                        left: settings.notifications?.[item.id] ? '23px' : '3px',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* Regional */}
          {activeSection === 'regional' && settings && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1e293b' }}>
                Configurações Regionais
              </h2>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Moeda
                </label>
                <select
                  value={settings.currency || 'BRL'}
                  onChange={(e) => updateSettings({ currency: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: '#fff'
                  }}
                >
                  {currencies.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} - {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Formato de Data
                </label>
                <select
                  value={settings.dateFormat || 'DD/MM/YYYY'}
                  onChange={(e) => updateSettings({ dateFormat: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: '#fff'
                  }}
                >
                  {dateFormats.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Início da Semana
                </label>
                <select
                  value={settings.startOfWeek || 'sunday'}
                  onChange={(e) => updateSettings({ startOfWeek: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: '#fff'
                  }}
                >
                  <option value="sunday">Domingo</option>
                  <option value="monday">Segunda-feira</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Mês de Início do Ano Fiscal
                </label>
                <select
                  value={settings.fiscalYearStart || 1}
                  onChange={(e) => updateSettings({ fiscalYearStart: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: '#fff'
                  }}
                >
                  {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Privacidade */}
          {activeSection === 'privacy' && settings && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1e293b' }}>
                Privacidade e Segurança
              </h2>

              {[
                { id: 'hideBalances', label: 'Ocultar Saldos por Padrão', desc: 'Valores ficam ocultos até clicar' },
                { id: 'requirePasswordOnOpen', label: 'Senha ao Abrir', desc: 'Pedir senha ao abrir o app' },
                { id: 'autoLock', label: 'Bloqueio Automático', desc: 'Bloquear após período de inatividade' }
              ].map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  <div>
                    <p style={{ fontWeight: '500', color: '#1e293b', margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>{item.desc}</p>
                  </div>
                  <label style={{ position: 'relative', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.privacy?.[item.id] ?? false}
                      onChange={(e) => {
                        const newPrivacy = { ...settings.privacy, [item.id]: e.target.checked }
                        setSettings({ ...settings, privacy: newPrivacy })
                        updateSettings({ privacy: newPrivacy })
                      }}
                      style={{ opacity: 0, position: 'absolute' }}
                    />
                    <div style={{
                      width: '48px',
                      height: '28px',
                      borderRadius: '14px',
                      background: settings.privacy?.[item.id] ? primaryColor : '#e2e8f0',
                      transition: 'background 0.2s',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: '3px',
                        left: settings.privacy?.[item.id] ? '23px' : '3px',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* Dados */}
          {activeSection === 'data' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1e293b' }}>
                Gerenciamento de Dados
              </h2>

              <div style={{
                padding: '1.25rem',
                background: '#f8fafc',
                borderRadius: '0.75rem',
                marginBottom: '1rem'
              }}>
                <h3 style={{ fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>
                  Exportar Dados
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
                  Faça download de todos os seus dados em formato JSON
                </p>
                <button
                  onClick={async () => {
                    try {
                      const { data } = await api.post('/profile/export-data')
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `moneytrack-backup-${new Date().toISOString().split('T')[0]}.json`
                      a.click()
                      showMessage('Dados exportados com sucesso!', 'success')
                    } catch (error) {
                      console.error('Erro ao exportar:', error)
                    }
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: primaryColor,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Exportar Tudo
                </button>
              </div>

              <div style={{
                padding: '1.25rem',
                background: '#fef2f2',
                borderRadius: '0.75rem',
                border: '1px solid #fecaca'
              }}>
                <h3 style={{ fontWeight: '600', color: '#dc2626', marginBottom: '0.5rem' }}>
                  Restaurar Configurações
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#7f1d1d', marginBottom: '1rem' }}>
                  Isso irá resetar todas as configurações para os valores padrão
                </p>
                <button
                  onClick={resetSettings}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Restaurar Padrão
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
