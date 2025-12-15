import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { ThemeContext } from '../contexts/ThemeContext'
import {
  RefreshCw, Plus, Edit2, Trash2, Calendar, ArrowUpCircle, ArrowDownCircle,
  Play, Pause, AlertCircle, CheckCircle, Clock, CreditCard, ChevronRight, Wallet
} from 'lucide-react'

const frequencyLabels = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  yearly: 'Anual'
}

export default function Recurring() {
  const navigate = useNavigate()
  const { colors, isDark } = useContext(ThemeContext)
  const [recurrences, setRecurrences] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showInstallmentModal, setShowInstallmentModal] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'upcoming', 'installments'
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense',
    category: '',
    amount: '',
    account: '',
    frequency: 'monthly',
    dayOfMonth: new Date().getDate(),
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    notifyDaysBefore: 3
  })
  const [formError, setFormError] = useState('')
  const [installmentData, setInstallmentData] = useState({
    name: '',
    category: '',
    amount: 0,
    account: '',
    totalInstallments: 12,
    startDate: new Date().toISOString().split('T')[0],
    generateAll: false
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [recRes, upcomingRes, accRes, catRes] = await Promise.all([
        api.get('/recurring?isActive=all'),
        api.get('/recurring/upcoming?days=30'),
        api.get('/accounts'),
        api.get('/categories')
      ])
      setRecurrences(recRes.data.recurrences || [])
      setUpcoming(upcomingRes.data.recurrences || [])
      setAccounts(accRes.data.accounts || [])
      setCategories(catRes.data.categories || [])
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    // Validação local
    const amount = parseFloat(formData.amount)
    if (!amount || amount < 0.01) {
      setFormError('Valor deve ser maior que R$ 0,00')
      return
    }
    if (!formData.category) {
      setFormError('Selecione uma categoria')
      return
    }

    try {
      const dataToSend = {
        ...formData,
        amount,
        // Não enviar account se estiver vazio (evita erro de ObjectId inválido)
        account: formData.account || undefined
      }
      if (editingItem) {
        await api.put(`/recurring/${editingItem._id}`, dataToSend)
      } else {
        await api.post('/recurring', dataToSend)
      }
      setShowModal(false)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Erro ao salvar recorrência'
      setFormError(errorMsg)
    }
  }

  const handleInstallmentSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/recurring/installment', installmentData)
      setShowInstallmentModal(false)
      setInstallmentData({
        name: '',
        category: '',
        amount: 0,
        account: '',
        totalInstallments: 12,
        startDate: new Date().toISOString().split('T')[0],
        generateAll: false
      })
      fetchData()
    } catch (error) {
      console.error('Erro ao criar parcelamento:', error)
    }
  }

  const handleGenerate = async (id) => {
    try {
      await api.post(`/recurring/${id}/generate`)
      fetchData()
    } catch (error) {
      console.error('Erro ao gerar transação:', error)
    }
  }

  const handleToggleActive = async (item) => {
    try {
      await api.put(`/recurring/${item._id}`, { isActive: !item.isActive })
      fetchData()
    } catch (error) {
      console.error('Erro ao alterar status:', error)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja desativar esta recorrência?')) {
      try {
        await api.delete(`/recurring/${id}`)
        fetchData()
      } catch (error) {
        console.error('Erro ao excluir:', error)
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'expense',
      category: '',
      amount: '',
      account: '',
      frequency: 'monthly',
      dayOfMonth: new Date().getDate(),
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      notifyDaysBefore: 3
    })
    setEditingItem(null)
    setFormError('')
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      type: item.type,
      category: item.category,
      amount: item.amount,
      account: item.account?._id || '',
      frequency: item.frequency,
      dayOfMonth: item.dayOfMonth || new Date().getDate(),
      startDate: item.startDate?.split('T')[0] || '',
      endDate: item.endDate?.split('T')[0] || '',
      notifyDaysBefore: item.notifyDaysBefore || 3
    })
    setShowModal(true)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    // Corrige problema de timezone - extrai apenas a parte da data sem conversão
    const date = dateStr.split('T')[0]
    const [year, month, day] = date.split('-')
    return `${day}/${month}/${year}`
  }

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const date = new Date(dateStr)
    date.setHours(0, 0, 0, 0)
    const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24))
    return diff
  }

  const installments = recurrences.filter(r => r.isInstallment)
  const regularRecurrences = recurrences.filter(r => !r.isInstallment)

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={32} />
        <p>Carregando...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
            Recorrências e Parcelamentos
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
            Gerencie transações automáticas e parcelas
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowInstallmentModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: '1px solid #8b5cf6',
              borderRadius: '0.5rem',
              background: '#fff',
              color: '#8b5cf6',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            <CreditCard size={18} />
            Novo Parcelamento
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            <Plus size={18} />
            Nova Recorrência
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '0.5rem'
      }}>
        {[
          { id: 'all', label: 'Todas', count: regularRecurrences.length },
          { id: 'upcoming', label: 'Próximas', count: upcoming.length },
          { id: 'installments', label: 'Parcelamentos', count: installments.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#64748b',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {tab.label}
            <span style={{
              background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.75rem'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Cards de Próximas a Vencer */}
      {activeTab === 'upcoming' && upcoming.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
            Próximos 30 dias
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem'
          }}>
            {upcoming.map(item => {
              const daysUntil = getDaysUntil(item.nextDueDate)
              const isUrgent = daysUntil !== null && daysUntil <= 3
              const isOverdue = daysUntil !== null && daysUntil < 0

              return (
                <div
                  key={item._id}
                  style={{
                    background: '#fff',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    border: `1px solid ${isOverdue ? '#fecaca' : isUrgent ? '#fed7aa' : '#e2e8f0'}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '0.5rem',
                        background: item.type === 'income' ? '#dcfce7' : '#fee2e2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {item.type === 'income'
                          ? <ArrowUpCircle size={20} style={{ color: '#16a34a' }} />
                          : <ArrowDownCircle size={20} style={{ color: '#dc2626' }} />
                        }
                      </div>
                      <div>
                        <h3 style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '0.9375rem' }}>
                          {item.name}
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                          {item.category}
                        </p>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      background: isOverdue ? '#fee2e2' : isUrgent ? '#ffedd5' : '#e0f2fe',
                      color: isOverdue ? '#dc2626' : isUrgent ? '#ea580c' : '#0369a1'
                    }}>
                      {isOverdue ? `${Math.abs(daysUntil)} dias atrás` : daysUntil === 0 ? 'Hoje' : `${daysUntil} dias`}
                    </span>
                  </div>

                  <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Valor</p>
                      <p style={{
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        color: item.type === 'income' ? '#16a34a' : '#dc2626',
                        margin: 0
                      }}>
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleGenerate(item._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.5rem 1rem',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}
                    >
                      <CheckCircle size={16} />
                      Registrar
                    </button>
                  </div>

                  {item.isInstallment && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem',
                      background: '#f8fafc',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      color: '#64748b'
                    }}>
                      Parcela {item.currentInstallment} de {item.totalInstallments}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista de Recorrências */}
      {(activeTab === 'all' || activeTab === 'installments') && (
        <div style={{
          background: '#fff',
          borderRadius: '1rem',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#64748b' }}>
                  Nome
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#64748b' }}>
                  Tipo
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: '#64748b' }}>
                  Frequência
                </th>
                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', fontSize: '0.875rem', color: '#64748b' }}>
                  Valor
                </th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', fontSize: '0.875rem', color: '#64748b' }}>
                  Próxima Data
                </th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', fontSize: '0.875rem', color: '#64748b' }}>
                  Status
                </th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', fontSize: '0.875rem', color: '#64748b' }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'installments' ? installments : regularRecurrences).map((item, index) => (
                <tr
                  key={item._id}
                  style={{
                    borderTop: index > 0 ? '1px solid #e2e8f0' : 'none',
                    opacity: item.isActive ? 1 : 0.5
                  }}
                >
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '0.5rem',
                        background: item.type === 'income' ? '#dcfce7' : '#fee2e2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {item.type === 'income'
                          ? <ArrowUpCircle size={18} style={{ color: '#16a34a' }} />
                          : <ArrowDownCircle size={18} style={{ color: '#dc2626' }} />
                        }
                      </div>
                      <div>
                        <p style={{ fontWeight: '600', color: '#1e293b', margin: 0 }}>
                          {item.name}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                          {item.category}
                          {item.isInstallment && ` • ${item.currentInstallment}/${item.totalInstallments}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      background: item.type === 'income' ? '#dcfce7' : '#fee2e2',
                      color: item.type === 'income' ? '#16a34a' : '#dc2626'
                    }}>
                      {item.type === 'income' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>
                    {frequencyLabels[item.frequency]}
                    {item.dayOfMonth && ` (dia ${item.dayOfMonth})`}
                  </td>
                  <td style={{
                    padding: '1rem',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: item.type === 'income' ? '#16a34a' : '#dc2626'
                  }}>
                    {formatCurrency(item.amount)}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                    {formatDate(item.nextDueDate)}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button
                      onClick={() => handleToggleActive(item)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        border: 'none',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        background: item.isActive ? '#dcfce7' : '#f1f5f9',
                        color: item.isActive ? '#16a34a' : '#64748b'
                      }}
                    >
                      {item.isActive ? <Play size={12} /> : <Pause size={12} />}
                      {item.isActive ? 'Ativo' : 'Pausado'}
                    </button>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem' }}>
                      {item.isActive && (
                        <button
                          onClick={() => handleGenerate(item._id)}
                          title="Gerar transação"
                          style={{
                            padding: '0.5rem',
                            border: 'none',
                            background: '#dcfce7',
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                          }}
                        >
                          <CheckCircle size={16} style={{ color: '#16a34a' }} />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(item)}
                        style={{
                          padding: '0.5rem',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                        <Edit2 size={16} style={{ color: '#64748b' }} />
                      </button>
                      <button
                        onClick={() => handleDelete(item._id)}
                        style={{
                          padding: '0.5rem',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={16} style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(activeTab === 'installments' ? installments : regularRecurrences).length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <Clock size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>Nenhuma {activeTab === 'installments' ? 'parcela' : 'recorrência'} encontrada</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Nova/Editar Recorrência */}
      {showModal && (
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
            background: colors.backgroundCard,
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
            color: colors.text
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: `1px solid ${colors.border}`
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: colors.text }}>
                {editingItem ? 'Editar Recorrência' : 'Nova Recorrência'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              {formError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '0.5rem',
                  color: '#dc2626',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  {formError}
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: colors.backgroundSecondary,
                    color: colors.text
                  }}
                  placeholder="Ex: Aluguel, Salário, etc."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Tipo
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text
                    }}
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text
                    }}
                  >
                    <option value="">Selecione...</option>
                    {categories.filter(c => c.type === formData.type || c.type === 'both').map(cat => (
                      <option key={cat._id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Valor *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0,00"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Conta <span style={{ fontWeight: '400', fontSize: '0.75rem' }}>(opcional)</span>
                  </label>
                  {accounts.length > 0 ? (
                    <select
                      value={formData.account}
                      onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        background: colors.backgroundSecondary,
                        color: colors.text
                      }}
                    >
                      <option value="">Nenhuma</option>
                      {accounts.map(acc => (
                        <option key={acc._id} value={acc._id}>{acc.name}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false)
                        navigate('/accounts')
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px dashed ${colors.border}`,
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        background: colors.backgroundSecondary,
                        color: colors.primary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <Wallet size={16} />
                      Criar primeira conta
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Frequência
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text
                    }}
                  >
                    {Object.entries(frequencyLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                {formData.frequency === 'monthly' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                      Dia do Mês
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.dayOfMonth}
                      onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) || 1 })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        background: colors.backgroundSecondary,
                        color: colors.text
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Data Início
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text,
                      colorScheme: isDark ? 'dark' : 'light'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Data Fim (opcional)
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text,
                      colorScheme: isDark ? 'dark' : 'light'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Notificar quantos dias antes?
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={formData.notifyDaysBefore}
                  onChange={(e) => setFormData({ ...formData, notifyDaysBefore: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: colors.backgroundSecondary,
                    color: colors.text
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm() }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '0.5rem',
                    background: colors.backgroundSecondary,
                    color: colors.text,
                    cursor: 'pointer',
                    fontWeight: '500'
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
                    background: colors.primary,
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {editingItem ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Parcelamento */}
      {showInstallmentModal && (
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
            background: colors.backgroundCard,
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
            color: colors.text
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: `1px solid ${colors.border}`
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: colors.text }}>
                Novo Parcelamento
              </h2>
            </div>

            <form onSubmit={handleInstallmentSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Descrição *
                </label>
                <input
                  type="text"
                  value={installmentData.name}
                  onChange={(e) => setInstallmentData({ ...installmentData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: colors.backgroundSecondary,
                    color: colors.text
                  }}
                  placeholder="Ex: TV 50 polegadas"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Valor Total *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={installmentData.amount}
                    onChange={(e) => setInstallmentData({ ...installmentData, amount: parseFloat(e.target.value) || 0 })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Parcelas
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="48"
                    value={installmentData.totalInstallments}
                    onChange={(e) => setInstallmentData({ ...installmentData, totalInstallments: parseInt(e.target.value) || 2 })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text
                    }}
                  />
                </div>
              </div>

              {installmentData.amount > 0 && installmentData.totalInstallments > 0 && (
                <div style={{
                  padding: '1rem',
                  background: colors.backgroundSecondary,
                  borderRadius: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: colors.textSecondary }}>
                    Valor por parcela: <strong style={{ color: colors.text }}>
                      {formatCurrency(installmentData.amount / installmentData.totalInstallments)}
                    </strong>
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Categoria
                  </label>
                  <select
                    value={installmentData.category}
                    onChange={(e) => setInstallmentData({ ...installmentData, category: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text
                    }}
                  >
                    <option value="">Selecione...</option>
                    {categories.filter(c => c.type === 'expense' || c.type === 'both').map(cat => (
                      <option key={cat._id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Conta/Cartão
                  </label>
                  <select
                    value={installmentData.account}
                    onChange={(e) => setInstallmentData({ ...installmentData, account: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text
                    }}
                  >
                    <option value="">Selecione...</option>
                    {accounts.map(acc => (
                      <option key={acc._id} value={acc._id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Data da Primeira Parcela
                </label>
                <input
                  type="date"
                  value={installmentData.startDate}
                  onChange={(e) => setInstallmentData({ ...installmentData, startDate: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: colors.backgroundSecondary,
                    color: colors.text,
                    colorScheme: isDark ? 'dark' : 'light'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  color: colors.text
                }}>
                  <input
                    type="checkbox"
                    checked={installmentData.generateAll}
                    onChange={(e) => setInstallmentData({ ...installmentData, generateAll: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Gerar todas as parcelas agora (pendentes)</span>
                </label>
                <p style={{ fontSize: '0.75rem', color: colors.textSecondary, marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                  Se desmarcar, será criada uma recorrência mensal
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowInstallmentModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '0.5rem',
                    background: colors.backgroundSecondary,
                    color: colors.text,
                    cursor: 'pointer',
                    fontWeight: '500'
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
                    background: '#8b5cf6',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Criar Parcelamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
