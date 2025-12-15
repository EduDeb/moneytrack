import { useState, useEffect, useContext, useMemo } from 'react'
import api from '../services/api'
import { Plus, Trash2, Edit2, X, Target, AlertTriangle, CheckCircle } from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'
import { useCategories } from '../contexts/CategoriesContext'
import MonthSelector from '../components/MonthSelector'
import SortToggle from '../components/SortToggle'

function Budget() {
  const { colors, isDark } = useContext(ThemeContext)
  const { expenseCategories: categories, categoryMap, getCategoryLabel } = useCategories()
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [budgetStatus, setBudgetStatus] = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState(null)
  const [form, setForm] = useState({ category: '', limit: '' })
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' = mais gasto, 'asc' = menos gasto

  const handleMonthChange = (month, year) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }

  useEffect(() => {
    fetchBudgetStatus()
  }, [selectedMonth, selectedYear])

  const fetchBudgetStatus = async () => {
    try {
      const response = await api.get(`/budget/status?month=${selectedMonth}&year=${selectedYear}`)
      setBudgetStatus(response.data.budgets)
      setSummary(response.data.summary)
    } catch (error) {
      console.error('Erro ao carregar orçamento:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingBudget) {
        // Editing existing budget
        await api.put(`/budget/${editingBudget._id}`, {
          limit: parseFloat(form.limit)
        })
      } else {
        // Creating new budget
        await api.post('/budget', {
          category: form.category,
          limit: parseFloat(form.limit),
          month: selectedMonth,
          year: selectedYear
        })
      }
      setShowModal(false)
      setEditingBudget(null)
      setForm({ category: '', limit: '' })
      fetchBudgetStatus()
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error)
    }
  }

  const openEditModal = (budget) => {
    setEditingBudget(budget)
    setForm({ category: budget.category, limit: budget.limit.toString() })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja remover este orçamento?')) return
    try {
      await api.delete(`/budget/${id}`)
      fetchBudgetStatus()
    } catch (error) {
      console.error('Erro ao remover orçamento:', error)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  // Categorias que ainda não tem orçamento
  const availableCategories = categories.filter(
    c => !budgetStatus.find(b => b.category === c.value)
  )

  return (
    <div>
      {/* Header com título e seletor de mês */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>Orçamento Mensal</h1>
          <p style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '4px' }}>
            Defina limites de gastos por categoria
          </p>
        </div>
        <MonthSelector
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onChange={handleMonthChange}
        />
        {availableCategories.length > 0 && (
          <button
            onClick={() => { setForm({ category: availableCategories[0].value, limit: '' }); setShowModal(true) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Plus size={18} />
            Definir Limite
          </button>
        )}
      </div>

      {/* Resumo Geral */}
      <div style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '14px', color: colors.textSecondary }}>Orçamento Total</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: colors.text }}>
              {formatCurrency(summary.totalBudget)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', color: colors.textSecondary }}>Disponível</p>
            <p style={{
              fontSize: '28px',
              fontWeight: '700',
              color: (summary.totalRemaining || 0) >= 0 ? '#22c55e' : '#ef4444'
            }}>
              {formatCurrency(summary.totalRemaining)}
            </p>
          </div>
        </div>

        {/* Barra de progresso geral */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: colors.textSecondary }}>
              Gasto: {formatCurrency(summary.totalSpent)}
            </span>
            <span style={{
              fontSize: '13px',
              fontWeight: '600',
              color: (summary.overallPercentage || 0) >= 100 ? '#ef4444' : (summary.overallPercentage || 0) >= 80 ? '#f59e0b' : '#22c55e'
            }}>
              {(summary.overallPercentage || 0).toFixed(0)}%
            </span>
          </div>
          <div style={{
            height: '12px',
            backgroundColor: isDark ? colors.border : '#f3f4f6',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(summary.overallPercentage || 0, 100)}%`,
              backgroundColor: (summary.overallPercentage || 0) >= 100 ? '#ef4444' : (summary.overallPercentage || 0) >= 80 ? '#f59e0b' : '#22c55e',
              borderRadius: '6px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Contador e Ordenação */}
      {budgetStatus.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
            {budgetStatus.length} orçamento(s) definido(s)
          </span>
          <SortToggle
            sortOrder={sortOrder}
            onToggle={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            label="Gasto"
          />
        </div>
      )}

      {/* Lista de Orçamentos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>Carregando...</div>
      ) : budgetStatus.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: colors.backgroundCard,
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: `1px solid ${colors.border}`
        }}>
          <Target size={48} color={colors.textSecondary} style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: '16px', color: colors.textSecondary, marginBottom: '8px' }}>Nenhum orçamento definido</p>
          <p style={{ fontSize: '14px', color: colors.textSecondary }}>
            Defina limites de gastos para controlar suas despesas
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...budgetStatus].sort((a, b) => sortOrder === 'desc' ? b.spent - a.spent : a.spent - b.spent).map((budget) => {
            const cat = categoryMap[budget.category] || { label: budget.category, name: budget.category, color: '#6b7280' }
            const StatusIcon = budget.status === 'exceeded' ? AlertTriangle : budget.status === 'warning' ? AlertTriangle : CheckCircle
            const statusColor = budget.status === 'exceeded' ? '#ef4444' : budget.status === 'warning' ? '#f59e0b' : '#22c55e'

            return (
              <div
                key={budget._id}
                style={{
                  backgroundColor: colors.backgroundCard,
                  borderRadius: '12px',
                  padding: '16px 20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: `1px solid ${colors.border}`,
                  borderLeft: `4px solid ${cat.color}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: `${cat.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <StatusIcon size={20} color={statusColor} />
                    </div>
                    <div>
                      <h3 style={{ fontWeight: '600', color: colors.text }}>{cat.label || cat.name}</h3>
                      <p style={{ fontSize: '12px', color: colors.textSecondary }}>
                        Limite: {formatCurrency(budget.limit)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => openEditModal(budget)}
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      title="Editar limite"
                    >
                      <Edit2 size={16} color="#3b82f6" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget._id)}
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#fef2f2',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      title="Remover orçamento"
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  </div>
                </div>

                {/* Info de gastos */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                    Gasto: {formatCurrency(budget.spent)}
                  </span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: budget.remaining >= 0 ? '#22c55e' : '#ef4444'
                  }}>
                    {budget.remaining >= 0 ? `Sobra: ${formatCurrency(budget.remaining)}` : `Excedido: ${formatCurrency(Math.abs(budget.remaining))}`}
                  </span>
                </div>

                {/* Barra de progresso */}
                <div style={{
                  height: '8px',
                  backgroundColor: isDark ? colors.border : '#f3f4f6',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(budget.percentage, 100)}%`,
                    backgroundColor: statusColor,
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                <div style={{ textAlign: 'right', marginTop: '4px' }}>
                  <span style={{ fontSize: '12px', color: statusColor, fontWeight: '500' }}>
                    {budget.percentage.toFixed(0)}% utilizado
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: colors.backgroundCard,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '380px',
            padding: '24px',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                {editingBudget ? 'Editar Limite' : 'Definir Limite'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingBudget(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
                  Categoria
                </label>
                {editingBudget ? (
                  <div style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    fontSize: '14px',
                    backgroundColor: isDark ? colors.border : '#f3f4f6',
                    color: colors.text
                  }}>
                    {categoryMap[form.category]?.label || categoryMap[form.category]?.name || form.category}
                  </div>
                ) : (
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      fontSize: '14px',
                      backgroundColor: colors.backgroundCard,
                      color: colors.text
                    }}
                  >
                    {availableCategories.map(c => (
                      <option key={c.value} value={c.value}>{c.label || c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
                  Limite Mensal (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max="999999999.99"
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: e.target.value })}
                  placeholder="0,00"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    fontSize: '14px',
                    backgroundColor: colors.backgroundCard,
                    color: colors.text
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingBudget(null) }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.backgroundCard,
                    color: colors.textSecondary,
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Budget
