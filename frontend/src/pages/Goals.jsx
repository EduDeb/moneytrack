import { useState, useEffect, useContext, useMemo } from 'react'
import api from '../services/api'
import {
  Target, Plus, Trash2, Edit2, X, PiggyBank, TrendingDown, TrendingUp,
  Banknote, CreditCard, Calendar, DollarSign, Check
} from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'
import SortToggle from '../components/SortToggle'

const goalTypes = [
  { value: 'savings', label: 'Poupança', icon: PiggyBank, color: '#22c55e', description: 'Juntar dinheiro para um objetivo' },
  { value: 'expense_limit', label: 'Limite de Gastos', icon: TrendingDown, color: '#ef4444', description: 'Controlar gastos em uma categoria' },
  { value: 'income', label: 'Meta de Renda', icon: TrendingUp, color: '#3b82f6', description: 'Alcançar um valor de receita' },
  { value: 'investment', label: 'Investimento', icon: Banknote, color: '#8b5cf6', description: 'Investir um valor específico' },
  { value: 'debt_payment', label: 'Quitar Dívida', icon: CreditCard, color: '#f97316', description: 'Pagar uma dívida específica' }
]

const colorOptions = ['#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16']

function Goals() {
  const { colors, isDark } = useContext(ThemeContext)
  const [goals, setGoals] = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' = maior progresso, 'asc' = menor progresso

  const [form, setForm] = useState({
    name: '',
    type: 'savings',
    targetAmount: '',
    currentAmount: '',
    deadline: '',
    color: '#22c55e',
    notes: ''
  })

  useEffect(() => {
    fetchGoals()
  }, [])

  const fetchGoals = async () => {
    try {
      const [goalsRes, summaryRes] = await Promise.all([
        api.get('/goals'),
        api.get('/goals/summary')
      ])
      setGoals(goalsRes.data.goals)
      setSummary(summaryRes.data)
    } catch (error) {
      console.error('Erro ao carregar metas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingGoal) {
        await api.put(`/goals/${editingGoal._id}`, {
          ...form,
          targetAmount: parseFloat(form.targetAmount),
          currentAmount: parseFloat(form.currentAmount) || 0
        })
      } else {
        await api.post('/goals', {
          ...form,
          targetAmount: parseFloat(form.targetAmount),
          currentAmount: parseFloat(form.currentAmount) || 0
        })
      }
      setShowModal(false)
      setEditingGoal(null)
      resetForm()
      fetchGoals()
    } catch (error) {
      console.error('Erro ao salvar meta:', error)
    }
  }

  const handleDeposit = async () => {
    if (!depositAmount || !selectedGoal) return
    try {
      await api.post(`/goals/${selectedGoal._id}/deposit`, {
        amount: parseFloat(depositAmount)
      })
      setShowDepositModal(false)
      setSelectedGoal(null)
      setDepositAmount('')
      fetchGoals()
    } catch (error) {
      console.error('Erro ao depositar:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return
    try {
      await api.delete(`/goals/${id}`)
      fetchGoals()
    } catch (error) {
      console.error('Erro ao excluir meta:', error)
    }
  }

  const openEditModal = (goal) => {
    setEditingGoal(goal)
    setForm({
      name: goal.name,
      type: goal.type,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      deadline: goal.deadline ? goal.deadline.split('T')[0] : '',
      color: goal.color || '#22c55e',
      notes: goal.notes || ''
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setForm({
      name: '',
      type: 'savings',
      targetAmount: '',
      currentAmount: '',
      deadline: '',
      color: '#22c55e',
      notes: ''
    })
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const getGoalType = (type) => goalTypes.find(t => t.value === type) || goalTypes[0]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>Metas Financeiras</h1>
          <p style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '4px' }}>
            Defina e acompanhe seus objetivos
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingGoal(null); setShowModal(true) }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
            backgroundColor: '#3b82f6', color: 'white', border: 'none',
            borderRadius: '8px', fontWeight: '500', cursor: 'pointer'
          }}
        >
          <Plus size={18} />
          Nova Meta
        </button>
      </div>

      {/* Resumo */}
      <div style={{
        backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px',
        marginBottom: '24px', border: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>
          <div>
            <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Metas Ativas</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: colors.text }}>{summary.totalGoals || 0}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Total Alvo</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: '#3b82f6' }}>{formatCurrency(summary.totalTarget)}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Total Acumulado</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: '#22c55e' }}>{formatCurrency(summary.totalCurrent)}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Progresso Geral</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: '#8b5cf6' }}>{(summary.totalProgress || 0).toFixed(0)}%</p>
          </div>
        </div>
      </div>

      {/* Contador e Ordenação */}
      {goals.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
            {goals.length} meta(s) definida(s)
          </span>
          <SortToggle
            sortOrder={sortOrder}
            onToggle={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            label="Progresso"
          />
        </div>
      )}

      {/* Lista de Metas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>Carregando...</div>
      ) : goals.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px', backgroundColor: colors.backgroundCard,
          borderRadius: '12px', border: `1px solid ${colors.border}`
        }}>
          <Target size={48} color={colors.textSecondary} style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: '16px', color: colors.textSecondary, marginBottom: '8px' }}>Nenhuma meta definida</p>
          <p style={{ fontSize: '14px', color: colors.textSecondary }}>
            Crie sua primeira meta para começar a acompanhar seus objetivos
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {[...goals].sort((a, b) => sortOrder === 'desc' ? (b.progress || 0) - (a.progress || 0) : (a.progress || 0) - (b.progress || 0)).map((goal) => {
            const typeConfig = getGoalType(goal.type)
            const Icon = typeConfig.icon
            const progress = goal.progress || 0
            const isCompleted = goal.status === 'completed' || progress >= 100

            return (
              <div
                key={goal._id}
                style={{
                  backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px',
                  border: `1px solid ${colors.border}`,
                  borderTop: `4px solid ${goal.color || typeConfig.color}`,
                  opacity: isCompleted ? 0.8 : 1
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '10px',
                      backgroundColor: `${goal.color || typeConfig.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Icon size={22} color={goal.color || typeConfig.color} />
                    </div>
                    <div>
                      <h3 style={{ fontWeight: '600', color: colors.text }}>{goal.name}</h3>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                        backgroundColor: isCompleted ? (isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7') : (isDark ? colors.border : '#f3f4f6'),
                        color: isCompleted ? '#16a34a' : colors.textSecondary
                      }}>
                        {isCompleted ? 'Concluída' : typeConfig.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => openEditModal(goal)}
                      style={{ padding: '6px', borderRadius: '6px', backgroundColor: isDark ? colors.border : '#f3f4f6', border: 'none', cursor: 'pointer' }}
                    >
                      <Edit2 size={14} color={colors.textSecondary} />
                    </button>
                    <button
                      onClick={() => handleDelete(goal._id)}
                      style={{ padding: '6px', borderRadius: '6px', backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', border: 'none', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </button>
                  </div>
                </div>

                {/* Valores */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px', fontWeight: '700', color: goal.color || typeConfig.color }}>
                      {formatCurrency(goal.currentAmount)}
                    </span>
                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>
                      de {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>

                  {/* Barra de progresso */}
                  <div style={{ height: '10px', backgroundColor: isDark ? colors.border : '#f3f4f6', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(progress, 100)}%`,
                      backgroundColor: goal.color || typeConfig.color,
                      borderRadius: '5px', transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                      Falta: {formatCurrency(goal.remaining)}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: goal.color || typeConfig.color }}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Prazo */}
                {goal.deadline && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textSecondary, marginBottom: '12px' }}>
                    <Calendar size={14} />
                    <span>
                      Prazo: {(() => { const d = goal.deadline.split('T')[0].split('-'); return `${d[2]}/${d[1]}/${d[0]}`; })()}
                      {goal.daysRemaining !== null && (
                        <span style={{ color: goal.daysRemaining < 30 ? '#f59e0b' : colors.textSecondary }}>
                          {' '}({goal.daysRemaining > 0 ? `${goal.daysRemaining} dias restantes` : 'Prazo esgotado'})
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* Botão de depósito */}
                {!isCompleted && (
                  <button
                    onClick={() => { setSelectedGoal(goal); setShowDepositModal(true) }}
                    style={{
                      width: '100%', padding: '10px', borderRadius: '8px',
                      backgroundColor: `${goal.color || typeConfig.color}15`,
                      color: goal.color || typeConfig.color,
                      border: `1px solid ${goal.color || typeConfig.color}40`,
                      fontWeight: '500', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                  >
                    <DollarSign size={16} />
                    Adicionar Valor
                  </button>
                )}

                {isCompleted && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', backgroundColor: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7', borderRadius: '8px', color: '#16a34a', fontWeight: '500'
                  }}>
                    <Check size={16} />
                    Meta Alcançada!
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Nova/Editar Meta */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px'
        }}>
          <div style={{
            backgroundColor: colors.backgroundCard, borderRadius: '16px', width: '100%',
            maxWidth: '480px', padding: '24px', maxHeight: '90vh', overflowY: 'auto',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                {editingGoal ? 'Editar Meta' : 'Nova Meta'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Nome */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                  Nome da Meta
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Viagem para Europa, Reserva de emergência..."
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Tipo */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                  Tipo de Meta
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {goalTypes.slice(0, 4).map((type) => {
                    const Icon = type.icon
                    const isSelected = form.type === type.value
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setForm({ ...form, type: type.value, color: type.color })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px',
                          borderRadius: '8px', border: isSelected ? `2px solid ${type.color}` : `2px solid ${colors.border}`,
                          backgroundColor: isSelected ? `${type.color}10` : colors.backgroundCard, cursor: 'pointer', textAlign: 'left'
                        }}
                      >
                        <Icon size={18} color={isSelected ? type.color : colors.textSecondary} />
                        <span style={{ fontSize: '13px', color: isSelected ? type.color : colors.textSecondary, fontWeight: isSelected ? '500' : '400' }}>
                          {type.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Valores */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                    Valor Alvo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.targetAmount}
                    onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                    placeholder="0,00"
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                    Valor Atual (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.currentAmount}
                    onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
                    placeholder="0,00"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Prazo */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                  Prazo (opcional)
                </label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Cor */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                  Cor
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {colorOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        backgroundColor: c, border: form.color === c ? `3px solid ${colors.text}` : '3px solid transparent',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.textSecondary, fontWeight: '500', cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px',
                    border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: '500', cursor: 'pointer'
                  }}
                >
                  {editingGoal ? 'Salvar' : 'Criar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Depósito */}
      {showDepositModal && selectedGoal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px'
        }}>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '16px', width: '100%', maxWidth: '360px', padding: '24px', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>Adicionar Valor</h2>
              <button onClick={() => setShowDepositModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '16px' }}>
              Meta: <strong style={{ color: colors.text }}>{selectedGoal.name}</strong>
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                Valor a adicionar (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0,00"
                autoFocus
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '16px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDepositModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.textSecondary, fontWeight: '500', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeposit}
                disabled={!depositAmount}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: 'none', backgroundColor: '#22c55e', color: 'white',
                  fontWeight: '500', cursor: depositAmount ? 'pointer' : 'not-allowed',
                  opacity: depositAmount ? 1 : 0.5
                }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Goals
