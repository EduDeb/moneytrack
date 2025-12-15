import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import { Plus, Trash2, Edit2, X, Filter } from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'

const categories = {
  income: [
    { value: 'salario', label: 'Salário' },
    { value: 'freelance', label: 'Freelance' },
    { value: 'investimentos', label: 'Investimentos' },
    { value: 'outros_receita', label: 'Outros' }
  ],
  expense: [
    { value: 'alimentacao', label: 'Alimentação' },
    { value: 'transporte', label: 'Transporte' },
    { value: 'moradia', label: 'Moradia' },
    { value: 'saude', label: 'Saúde' },
    { value: 'educacao', label: 'Educação' },
    { value: 'lazer', label: 'Lazer' },
    { value: 'compras', label: 'Compras' },
    { value: 'contas', label: 'Contas' },
    { value: 'outros_despesa', label: 'Outros' }
  ]
}

const categoryLabels = Object.fromEntries(
  [...categories.income, ...categories.expense].map(c => [c.value, c.label])
)

function Transactions() {
  const { colors, isDark } = useContext(ThemeContext)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [filter, setFilter] = useState({ type: '', category: '' })

  const [form, setForm] = useState({
    type: 'expense',
    category: 'alimentacao',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchTransactions()
  }, [filter])

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams()
      if (filter.type) params.append('type', filter.type)
      if (filter.category) params.append('category', filter.category)

      const response = await api.get(`/transactions?${params}`)
      setTransactions(response.data.transactions)
    } catch (error) {
      console.error('Erro ao carregar transações:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      if (editingTransaction) {
        await api.put(`/transactions/${editingTransaction._id}`, form)
      } else {
        await api.post('/transactions', form)
      }

      setShowModal(false)
      setEditingTransaction(null)
      resetForm()
      fetchTransactions()
    } catch (error) {
      console.error('Erro ao salvar transação:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return

    try {
      await api.delete(`/transactions/${id}`)
      fetchTransactions()
    } catch (error) {
      console.error('Erro ao excluir transação:', error)
    }
  }

  const openEditModal = (transaction) => {
    setEditingTransaction(transaction)
    setForm({
      type: transaction.type,
      category: transaction.category,
      description: transaction.description,
      amount: transaction.amount.toString(),
      date: transaction.date.split('T')[0] // Extrai apenas YYYY-MM-DD sem conversão de timezone
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setForm({
      type: 'expense',
      category: 'alimentacao',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0]
    })
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString) => {
    // Corrige problema de timezone - extrai apenas a parte da data
    const date = dateString.split('T')[0]
    const [year, month, day] = date.split('-')
    return `${day}/${month}/${year}`
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>Transações</h1>
        <button
          onClick={() => { resetForm(); setEditingTransaction(null); setShowModal(true) }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
            backgroundColor: '#3b82f6', color: 'white', border: 'none',
            borderRadius: '8px', fontWeight: '500', cursor: 'pointer'
          }}
        >
          <Plus size={18} />
          Nova Transação
        </button>
      </div>

      {/* Filtros */}
      <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', marginBottom: '24px', border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
          <Filter size={18} color={colors.textSecondary} />
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            style={{
              padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
              backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '14px'
            }}
          >
            <option value="">Todos os tipos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </select>
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            style={{
              padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
              backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '14px'
            }}
          >
            <option value="">Todas as categorias</option>
            {[...categories.income, ...categories.expense].map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Transações */}
      <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: colors.textSecondary }}>
            Nenhuma transação encontrada
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Data</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Descrição</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Categoria</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Valor</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t._id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '12px 8px', fontSize: '14px', color: colors.text }}>{formatDate(t.date)}</td>
                    <td style={{ padding: '12px 8px', color: colors.text }}>{t.description}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        fontSize: '12px', padding: '4px 8px', borderRadius: '12px',
                        backgroundColor: t.type === 'income' ? (isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7') : (isDark ? 'rgba(239,68,68,0.2)' : '#fef2f2'),
                        color: t.type === 'income' ? '#22c55e' : '#ef4444'
                      }}>
                        {categoryLabels[t.category] || t.category}
                      </span>
                    </td>
                    <td style={{
                      padding: '12px 8px', textAlign: 'right', fontWeight: '500',
                      color: t.type === 'income' ? '#22c55e' : '#ef4444'
                    }}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button
                        onClick={() => openEditModal(t)}
                        style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(t._id)}
                        style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, marginLeft: '8px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '24px', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.textSecondary }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Tipo</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'expense', category: 'alimentacao' })}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                      border: form.type === 'expense' ? '2px solid #ef4444' : `1px solid ${colors.border}`,
                      backgroundColor: form.type === 'expense' ? (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2') : colors.backgroundCard,
                      color: form.type === 'expense' ? '#ef4444' : colors.textSecondary
                    }}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'income', category: 'salario' })}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                      border: form.type === 'income' ? '2px solid #22c55e' : `1px solid ${colors.border}`,
                      backgroundColor: form.type === 'income' ? (isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4') : colors.backgroundCard,
                      color: form.type === 'income' ? '#22c55e' : colors.textSecondary
                    }}
                  >
                    Receita
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard,
                    color: colors.text, fontSize: '14px'
                  }}
                >
                  {categories[form.type].map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Descrição</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex: Almoço no restaurante"
                  required
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard,
                    color: colors.text, fontSize: '14px', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0,00"
                  required
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard,
                    color: colors.text, fontSize: '14px', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Data</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard,
                    color: colors.text, fontSize: '14px', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard,
                    color: colors.textSecondary, fontWeight: '500', cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px',
                    border: 'none', backgroundColor: '#3b82f6',
                    color: 'white', fontWeight: '500', cursor: 'pointer'
                  }}
                >
                  {editingTransaction ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transactions
