import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import { ThemeContext } from '../contexts/ThemeContext'
import {
  Wallet, CreditCard, PiggyBank, Banknote, TrendingUp, Building2,
  Plus, Edit2, Trash2, ArrowRightLeft, Eye, EyeOff, MoreVertical,
  ChevronDown, RefreshCw, Wrench
} from 'lucide-react'
import toast from 'react-hot-toast'

const accountIcons = {
  Wallet: Wallet,
  CreditCard: CreditCard,
  PiggyBank: PiggyBank,
  Banknote: Banknote,
  TrendingUp: TrendingUp,
  Building2: Building2
}

const accountTypeLabels = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  credit_card: 'Cartão de Crédito',
  cash: 'Dinheiro',
  investment: 'Investimento',
  other: 'Outro'
}

const accountColors = [
  '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f97316',
  '#ef4444', '#eab308', '#06b6d4', '#6366f1', '#84cc16'
]

export default function Accounts() {
  const { colors, isDark } = useContext(ThemeContext)
  const [accounts, setAccounts] = useState([])
  const [totals, setTotals] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showBalances, setShowBalances] = useState(true)
  const [editingAccount, setEditingAccount] = useState(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking',
    institution: '',
    initialBalance: 0,
    color: '#3b82f6',
    icon: 'Wallet',
    creditLimit: 0,
    closingDay: '',
    dueDay: ''
  })
  const [transferData, setTransferData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: 0,
    description: ''
  })
  const [fixingTransactions, setFixingTransactions] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAccounts()
  }, [includeInactive])

  const handleFixTransactions = async () => {
    if (!confirm('Isso vai vincular TODAS as suas transações ao "Banco Principal". Deseja continuar?')) return

    setFixingTransactions(true)
    try {
      const { data } = await api.post('/transactions/fix-account-refs')
      toast.success(`Corrigido! ${data.linkedNoAccount + data.linkedWrongAccount} transações vinculadas ao Banco Principal`)
      fetchAccounts() // Recarregar saldos
    } catch (error) {
      console.error('Erro ao corrigir transações:', error)
      toast.error(error.response?.data?.message || 'Erro ao corrigir transações')
    } finally {
      setFixingTransactions(false)
    }
  }

  const fetchAccounts = async () => {
    try {
      const { data } = await api.get(`/accounts/summary`)
      setAccounts(data.accounts || [])
      setTotals(data.totals || {})
    } catch (error) {
      console.error('Erro ao buscar contas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validação para cartão de crédito
    if (formData.type === 'credit_card') {
      if (formData.creditLimit <= 0) {
        toast.error('Limite do cartão deve ser maior que zero')
        return
      }
      if (formData.closingDay && (formData.closingDay < 1 || formData.closingDay > 31)) {
        toast.error('Dia de fechamento deve ser entre 1 e 31')
        return
      }
      if (formData.dueDay && (formData.dueDay < 1 || formData.dueDay > 31)) {
        toast.error('Dia de vencimento deve ser entre 1 e 31')
        return
      }
    }

    setSubmitting(true)
    try {
      if (editingAccount) {
        await api.put(`/accounts/${editingAccount._id}`, formData)
        toast.success('Conta atualizada com sucesso')
      } else {
        await api.post('/accounts', formData)
        toast.success('Conta criada com sucesso')
      }
      setShowModal(false)
      resetForm()
      fetchAccounts()
    } catch (error) {
      console.error('Erro ao salvar conta:', error)
      toast.error(error.response?.data?.message || 'Erro ao salvar conta')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTransfer = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/accounts/transfer', transferData)
      toast.success('Transferência realizada com sucesso')
      setShowTransferModal(false)
      setTransferData({ fromAccountId: '', toAccountId: '', amount: 0, description: '' })
      fetchAccounts()
    } catch (error) {
      console.error('Erro na transferência:', error)
      toast.error(error.response?.data?.message || 'Erro ao realizar transferência')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja desativar esta conta?')) {
      try {
        await api.delete(`/accounts/${id}`)
        toast.success('Conta desativada com sucesso')
        fetchAccounts()
      } catch (error) {
        console.error('Erro ao desativar conta:', error)
        toast.error(error.response?.data?.message || 'Erro ao desativar conta')
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'checking',
      institution: '',
      initialBalance: 0,
      color: '#3b82f6',
      icon: 'Wallet',
      creditLimit: 0,
      closingDay: '',
      dueDay: ''
    })
    setEditingAccount(null)
  }

  const openEditModal = (account) => {
    setEditingAccount(account)
    setFormData({
      name: account.name,
      type: account.type,
      institution: account.institution || '',
      initialBalance: account.initialBalance,
      color: account.color,
      icon: account.icon,
      creditLimit: account.creditLimit || 0,
      closingDay: account.closingDay || '',
      dueDay: account.dueDay || ''
    })
    setShowModal(true)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const getIconComponent = (iconName) => {
    const IconComponent = accountIcons[iconName] || Wallet
    return IconComponent
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={32} />
        <p>Carregando contas...</p>
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
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: colors.text, margin: 0 }}>
            Contas Bancárias
          </h1>
          <p style={{ color: colors.textSecondary, marginTop: '0.25rem' }}>
            Gerencie suas contas e cartões
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowBalances(!showBalances)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${colors.border}`,
              borderRadius: '0.5rem',
              background: colors.backgroundCard,
              color: colors.text,
              cursor: 'pointer'
            }}
          >
            {showBalances ? <EyeOff size={18} /> : <Eye size={18} />}
            {showBalances ? 'Ocultar' : 'Mostrar'}
          </button>
          <button
            onClick={handleFixTransactions}
            disabled={fixingTransactions}
            title="Vincular todas transações ao Banco Principal"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${colors.border}`,
              borderRadius: '0.5rem',
              background: colors.backgroundCard,
              color: colors.text,
              cursor: fixingTransactions ? 'wait' : 'pointer',
              opacity: fixingTransactions ? 0.7 : 1
            }}
          >
            <Wrench size={18} className={fixingTransactions ? 'animate-spin' : ''} />
            {fixingTransactions ? 'Corrigindo...' : 'Corrigir Saldos'}
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${colors.border}`,
              borderRadius: '0.5rem',
              background: colors.backgroundCard,
              color: colors.text,
              cursor: 'pointer'
            }}
          >
            <ArrowRightLeft size={18} />
            Transferir
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: colors.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            <Plus size={18} />
            Nova Conta
          </button>
        </div>
      </div>

      {/* Totais */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: '1rem',
          padding: '1.25rem',
          color: '#fff'
        }}>
          <p style={{ opacity: 0.9, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Saldo Total</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>
            {showBalances ? formatCurrency(totals.balance) : '••••••'}
          </p>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          borderRadius: '1rem',
          padding: '1.25rem',
          color: '#fff'
        }}>
          <p style={{ opacity: 0.9, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Limite Disponível</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>
            {showBalances ? formatCurrency(totals.creditAvailable) : '••••••'}
          </p>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          borderRadius: '1rem',
          padding: '1.25rem',
          color: '#fff'
        }}>
          <p style={{ opacity: 0.9, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Fatura Atual</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>
            {showBalances ? formatCurrency(totals.creditUsed) : '••••••'}
          </p>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: '1rem',
          padding: '1.25rem',
          color: '#fff'
        }}>
          <p style={{ opacity: 0.9, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Patrimônio Líquido</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>
            {showBalances ? formatCurrency(totals.netWorth) : '••••••'}
          </p>
        </div>
      </div>

      {/* Lista de Contas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1rem'
      }}>
        {accounts.map(account => {
          const IconComponent = getIconComponent(account.icon)
          const isCreditCard = account.type === 'credit_card'

          return (
            <div
              key={account._id}
              style={{
                background: colors.backgroundCard,
                borderRadius: '1rem',
                padding: '1.5rem',
                border: `1px solid ${colors.border}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Barra de cor */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: account.color
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '0.75rem',
                    background: `${account.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <IconComponent size={24} style={{ color: account.color }} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: '600', color: colors.text, margin: 0 }}>
                      {account.name}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: colors.textSecondary, margin: 0 }}>
                      {accountTypeLabels[account.type]}
                      {account.institution && ` • ${account.institution}`}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    onClick={() => openEditModal(account)}
                    style={{
                      padding: '0.5rem',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      borderRadius: '0.375rem'
                    }}
                  >
                    <Edit2 size={16} style={{ color: colors.textSecondary }} />
                  </button>
                  <button
                    onClick={() => handleDelete(account._id)}
                    style={{
                      padding: '0.5rem',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      borderRadius: '0.375rem'
                    }}
                  >
                    <Trash2 size={16} style={{ color: '#ef4444' }} />
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <p style={{ fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '0.25rem' }}>
                  {isCreditCard ? 'Fatura Atual' : 'Saldo Atual'}
                </p>
                <p style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: account.balance < 0 ? '#ef4444' : colors.text
                }}>
                  {showBalances ? formatCurrency(Math.abs(account.balance)) : '••••••'}
                </p>
              </div>

              {isCreditCard && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    color: colors.textSecondary,
                    marginBottom: '0.5rem'
                  }}>
                    <span>Limite utilizado</span>
                    <span>
                      {showBalances
                        ? `${formatCurrency(Math.abs(account.balance))} / ${formatCurrency(account.creditLimit)}`
                        : '••••••'
                      }
                    </span>
                  </div>
                  <div style={{
                    height: '6px',
                    background: colors.border,
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min((Math.abs(account.balance) / (account.creditLimit || 1)) * 100, 100)}%`,
                      background: Math.abs(account.balance) > account.creditLimit * 0.8 ? '#ef4444' : account.color,
                      borderRadius: '3px',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  {account.closingDay && account.dueDay && (
                    <p style={{ fontSize: '0.75rem', color: colors.textSecondary, marginTop: '0.75rem' }}>
                      Fecha dia {account.closingDay} • Vence dia {account.dueDay}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Card para adicionar nova conta */}
        <div
          onClick={() => { resetForm(); setShowModal(true) }}
          style={{
            background: isDark ? colors.backgroundSecondary : '#f8fafc',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: `2px dashed ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: colors.border,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <Plus size={24} style={{ color: colors.textSecondary }} />
          </div>
          <p style={{ color: colors.textSecondary, fontWeight: '500' }}>Adicionar Conta</p>
        </div>
      </div>

      {/* Modal Nova/Editar Conta */}
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
                {editingAccount ? 'Editar Conta' : 'Nova Conta'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Nome da Conta *
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
                  placeholder="Ex: Nubank, Itaú, etc."
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
                    {Object.entries(accountTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                    Instituição
                  </label>
                  <input
                    type="text"
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: colors.backgroundSecondary,
                      color: colors.text
                    }}
                    placeholder="Nome do banco"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Saldo Inicial
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.initialBalance}
                  onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })}
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

              {formData.type === 'credit_card' && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                      Limite do Cartão
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                        Dia de Fechamento
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={formData.closingDay}
                        onChange={(e) => setFormData({ ...formData, closingDay: parseInt(e.target.value) || '' })}
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
                        Dia de Vencimento
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={formData.dueDay}
                        onChange={(e) => setFormData({ ...formData, dueDay: parseInt(e.target.value) || '' })}
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
                </>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Cor
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {accountColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: color,
                        border: formData.color === color ? `3px solid ${colors.text}` : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Ícone
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {Object.entries(accountIcons).map(([name, Icon]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: name })}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '0.5rem',
                        background: formData.icon === name ? formData.color : colors.backgroundSecondary,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Icon size={20} style={{ color: formData.icon === name ? '#fff' : colors.textSecondary }} />
                    </button>
                  ))}
                </div>
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
                  disabled={submitting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '0.5rem',
                    background: colors.primary,
                    color: '#fff',
                    cursor: submitting ? 'wait' : 'pointer',
                    fontWeight: '500',
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? 'Salvando...' : (editingAccount ? 'Salvar' : 'Criar Conta')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transferência */}
      {showTransferModal && (
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
            maxWidth: '450px',
            color: colors.text
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: `1px solid ${colors.border}`
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: colors.text }}>
                Transferência entre Contas
              </h2>
            </div>

            <form onSubmit={handleTransfer} style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  De (Origem)
                </label>
                <select
                  value={transferData.fromAccountId}
                  onChange={(e) => setTransferData({ ...transferData, fromAccountId: e.target.value })}
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
                  <option value="">Selecione a conta</option>
                  {accounts.filter(a => a.type !== 'credit_card').map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Para (Destino)
                </label>
                <select
                  value={transferData.toAccountId}
                  onChange={(e) => setTransferData({ ...transferData, toAccountId: e.target.value })}
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
                  <option value="">Selecione a conta</option>
                  {accounts.filter(a => a._id !== transferData.fromAccountId).map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Valor
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={transferData.amount}
                  onChange={(e) => setTransferData({ ...transferData, amount: parseFloat(e.target.value) || 0 })}
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

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: colors.textSecondary }}>
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={transferData.description}
                  onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: colors.backgroundSecondary,
                    color: colors.text
                  }}
                  placeholder="Ex: Reserva de emergência"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
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
                  disabled={submitting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '0.5rem',
                    background: colors.primary,
                    color: '#fff',
                    cursor: submitting ? 'wait' : 'pointer',
                    fontWeight: '500',
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? 'Transferindo...' : 'Transferir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
