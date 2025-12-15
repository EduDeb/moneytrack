import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import { ThemeContext } from '../contexts/ThemeContext'
import {
  User, Mail, Phone, Calendar, Camera, Edit2, Lock, Shield,
  TrendingUp, Wallet, Target, RefreshCw, LogOut, Trash2,
  Award, Clock, BarChart3
} from 'lucide-react'

export default function Profile() {
  const { primaryColor, colors } = useContext(ThemeContext)
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [message, setMessage] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    birthDate: ''
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    fetchProfile()
    fetchStats()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/profile')
      setProfile(data.user)
      setFormData({
        name: data.user.name || '',
        phone: data.user.phone || '',
        birthDate: data.user.birthDate?.split('T')[0] || ''
      })
    } catch (error) {
      console.error('Erro ao buscar perfil:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/profile/stats')
      setStats(data)
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    try {
      const { data } = await api.put('/profile', formData)
      setProfile(data.user)
      setEditMode(false)
      showMessage('Perfil atualizado com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao atualizar:', error)
      showMessage('Erro ao atualizar perfil', 'error')
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('As senhas não coincidem', 'error')
      return
    }
    try {
      await api.put('/profile/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
      setShowPasswordModal(false)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      showMessage('Senha alterada com sucesso!', 'success')
    } catch (error) {
      showMessage(error.response?.data?.message || 'Erro ao alterar senha', 'error')
    }
  }

  const handleDeleteAccount = async (password, confirmation) => {
    try {
      await api.delete('/profile/account', { data: { password, confirmation } })
      localStorage.removeItem('token')
      window.location.href = '/login'
    } catch (error) {
      showMessage(error.response?.data?.message || 'Erro ao excluir conta', 'error')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  const showMessage = (text, type) => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={32} />
        <p>Carregando perfil...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Message */}
      {message && (
        <div style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: message.type === 'success' ? '#16a34a' : '#dc2626'
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1.5rem' }}>
        {/* Sidebar Perfil */}
        <div>
          <div style={{
            background: '#fff',
            borderRadius: '1rem',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            {/* Header com gradiente */}
            <div style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
              padding: '2rem',
              textAlign: 'center'
            }}>
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: '#fff',
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '4px solid rgba(255,255,255,0.3)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={48} style={{ color: primaryColor }} />
                )}
                <button
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(0,0,0,0.5)',
                    border: 'none',
                    padding: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  <Camera size={16} style={{ color: '#fff' }} />
                </button>
              </div>
              <h2 style={{ color: '#fff', margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
                {profile?.name}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
                {profile?.email}
              </p>
              <span style={{
                display: 'inline-block',
                marginTop: '0.75rem',
                padding: '0.25rem 0.75rem',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '9999px',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: '500'
              }}>
                Plano {profile?.plan === 'premium' ? 'Premium' : profile?.plan === 'business' ? 'Business' : 'Gratuito'}
              </span>
            </div>

            {/* Informações */}
            <div style={{ padding: '1.5rem' }}>
              {editMode ? (
                <form onSubmit={handleUpdateProfile}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                      Nome
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                      Data de Nascimento
                    </label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: 'none',
                        borderRadius: '0.5rem',
                        background: primaryColor,
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Salvar
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <Mail size={18} style={{ color: '#64748b' }} />
                      <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Email</p>
                        <p style={{ margin: 0, color: '#1e293b' }}>{profile?.email}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <Phone size={18} style={{ color: '#64748b' }} />
                      <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Telefone</p>
                        <p style={{ margin: 0, color: '#1e293b' }}>{profile?.phone || 'Não informado'}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <Calendar size={18} style={{ color: '#64748b' }} />
                      <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Nascimento</p>
                        <p style={{ margin: 0, color: '#1e293b' }}>
                          {profile?.birthDate ? formatDate(profile.birthDate) : 'Não informado'}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Clock size={18} style={{ color: '#64748b' }} />
                      <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Membro desde</p>
                        <p style={{ margin: 0, color: '#1e293b' }}>{formatDate(profile?.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setEditMode(true)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      background: '#fff',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    <Edit2 size={16} />
                    Editar Perfil
                  </button>
                </>
              )}
            </div>

            {/* Ações */}
            <div style={{ padding: '0 1.5rem 1.5rem' }}>
              <button
                onClick={() => setShowPasswordModal(true)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  background: '#fff',
                  cursor: 'pointer',
                  marginBottom: '0.5rem'
                }}
              >
                <Lock size={18} style={{ color: '#64748b' }} />
                <span>Alterar Senha</span>
              </button>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  border: '1px solid #fecaca',
                  borderRadius: '0.5rem',
                  background: '#fef2f2',
                  cursor: 'pointer',
                  color: '#dc2626'
                }}
              >
                <LogOut size={18} />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>

        {/* Estatísticas e Atividade */}
        <div>
          {/* Cards de Resumo */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              background: '#fff',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.75rem',
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                <TrendingUp size={24} style={{ color: '#16a34a' }} />
              </div>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>Total de Receitas</p>
              <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#16a34a', margin: '0.25rem 0 0' }}>
                {formatCurrency(stats?.totals?.income)}
              </p>
            </div>

            <div style={{
              background: '#fff',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.75rem',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                <Wallet size={24} style={{ color: '#dc2626' }} />
              </div>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>Total de Despesas</p>
              <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626', margin: '0.25rem 0 0' }}>
                {formatCurrency(stats?.totals?.expense)}
              </p>
            </div>

            <div style={{
              background: '#fff',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.75rem',
                background: `${primaryColor}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                <BarChart3 size={24} style={{ color: primaryColor }} />
              </div>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>Saldo Acumulado</p>
              <p style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: (stats?.totals?.balance || 0) >= 0 ? '#16a34a' : '#dc2626',
                margin: '0.25rem 0 0'
              }}>
                {formatCurrency(stats?.totals?.balance)}
              </p>
            </div>
          </div>

          {/* Conquistas */}
          <div style={{
            background: '#fff',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
              Conquistas
            </h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {[
                { icon: Award, label: 'Primeira Transação', unlocked: (stats?.totals?.transactions || 0) >= 1 },
                { icon: Target, label: '100 Transações', unlocked: (stats?.totals?.transactions || 0) >= 100 },
                { icon: TrendingUp, label: 'Saldo Positivo', unlocked: (stats?.totals?.balance || 0) > 0 },
                { icon: Wallet, label: 'Múltiplas Contas', unlocked: (stats?.totals?.accounts || 0) >= 2 },
                { icon: Clock, label: '30 Dias de Uso', unlocked: (stats?.timeline?.accountAge || 0) >= 30 }
              ].map((badge, index) => {
                const Icon = badge.icon
                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      background: badge.unlocked ? `${primaryColor}10` : '#f8fafc',
                      opacity: badge.unlocked ? 1 : 0.5,
                      minWidth: '100px'
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: badge.unlocked ? primaryColor : '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <Icon size={24} style={{ color: badge.unlocked ? '#fff' : '#94a3b8' }} />
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      textAlign: 'center',
                      color: badge.unlocked ? '#1e293b' : '#94a3b8'
                    }}>
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Categorias */}
          {stats?.topCategories && stats.topCategories.length > 0 && (
            <div style={{
              background: '#fff',
              borderRadius: '1rem',
              padding: '1.5rem',
              border: '1px solid #e2e8f0',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
                Principais Categorias de Despesa
              </h3>
              <div>
                {stats.topCategories.slice(0, 5).map((cat, index) => {
                  const maxTotal = stats.topCategories[0]?.total || 1
                  const percentage = (cat.total / maxTotal) * 100

                  return (
                    <div key={cat._id} style={{ marginBottom: index < 4 ? '0.75rem' : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#1e293b' }}>{cat._id}</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>
                          {formatCurrency(cat.total)}
                        </span>
                      </div>
                      <div style={{
                        height: '8px',
                        background: '#f1f5f9',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${percentage}%`,
                          background: primaryColor,
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Zona de Perigo */}
          <div style={{
            background: '#fef2f2',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #fecaca'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#dc2626', marginBottom: '0.5rem' }}>
              Zona de Perigo
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#7f1d1d', marginBottom: '1rem' }}>
              Ações irreversíveis que afetam permanentemente sua conta
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                padding: '0.75rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: '1px solid #dc2626',
                borderRadius: '0.5rem',
                background: '#fff',
                color: '#dc2626',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              <Trash2 size={18} />
              Excluir Minha Conta
            </button>
          </div>
        </div>
      </div>

      {/* Modal Alterar Senha */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '400px'
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Alterar Senha</h2>
            </div>
            <form onSubmit={handleChangePassword} style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Senha Atual
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '0.5rem',
                    background: primaryColor,
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Alterar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Excluir Conta */}
      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onDelete={handleDeleteAccount}
        />
      )}
    </div>
  )
}

function DeleteAccountModal({ onClose, onDelete }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onDelete(password, confirmation)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '1rem',
        width: '100%',
        maxWidth: '450px'
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #fecaca',
          background: '#fef2f2',
          borderRadius: '1rem 1rem 0 0'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#dc2626' }}>
            Excluir Conta Permanentemente
          </h2>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>
            Esta ação é <strong>irreversível</strong>. Todos os seus dados serão permanentemente excluídos.
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
              Digite sua senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
              Digite "EXCLUIR MINHA CONTA" para confirmar
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={confirmation !== 'EXCLUIR MINHA CONTA'}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '0.5rem',
                background: confirmation === 'EXCLUIR MINHA CONTA' ? '#dc2626' : '#fecaca',
                color: '#fff',
                cursor: confirmation === 'EXCLUIR MINHA CONTA' ? 'pointer' : 'not-allowed',
                fontWeight: '500'
              }}
            >
              Excluir Permanentemente
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
