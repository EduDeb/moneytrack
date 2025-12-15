import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import { Plus, Trash2, Edit2, X, DollarSign, CheckCircle } from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'

const debtTypes = [
  { value: 'emprestimo', label: 'Empréstimo' },
  { value: 'financiamento', label: 'Financiamento' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cheque_especial', label: 'Cheque Especial' },
  { value: 'outro', label: 'Outro' }
]

const typeLabels = Object.fromEntries(debtTypes.map(t => [t.value, t.label]))

function Debts() {
  const { colors, isDark } = useContext(ThemeContext)
  const [debts, setDebts] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingDebt, setEditingDebt] = useState(null)
  const [payingDebt, setPayingDebt] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  const [form, setForm] = useState({
    name: '',
    type: 'emprestimo',
    totalAmount: '',
    remainingAmount: '',
    interestRate: '',
    installments: '',
    installmentAmount: '',
    dueDay: '',
    creditor: '',
    notes: ''
  })

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.backgroundCard,
    color: colors.text,
    fontSize: '14px',
    boxSizing: 'border-box'
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [debtsRes, summaryRes] = await Promise.all([
        api.get('/debts'),
        api.get('/debts/summary')
      ])
      setDebts(debtsRes.data)
      setSummary(summaryRes.data)
    } catch (error) {
      console.error('Erro ao carregar dívidas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const data = {
      ...form,
      totalAmount: parseFloat(form.totalAmount),
      remainingAmount: parseFloat(form.remainingAmount) || parseFloat(form.totalAmount),
      interestRate: parseFloat(form.interestRate) || 0,
      installments: parseInt(form.installments) || 1,
      installmentAmount: parseFloat(form.installmentAmount) || 0,
      dueDay: parseInt(form.dueDay) || null
    }

    try {
      if (editingDebt) {
        await api.put(`/debts/${editingDebt._id}`, data)
      } else {
        await api.post('/debts', data)
      }

      setShowModal(false)
      setEditingDebt(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Erro ao salvar dívida:', error)
    }
  }

  const handlePayment = async (e) => {
    e.preventDefault()

    try {
      await api.post(`/debts/${payingDebt._id}/payment`, {
        amount: parseFloat(paymentAmount)
      })

      setShowPaymentModal(false)
      setPayingDebt(null)
      setPaymentAmount('')
      fetchData()
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta dívida?')) return

    try {
      await api.delete(`/debts/${id}`)
      fetchData()
    } catch (error) {
      console.error('Erro ao excluir dívida:', error)
    }
  }

  const openEditModal = (debt) => {
    setEditingDebt(debt)
    setForm({
      name: debt.name,
      type: debt.type,
      totalAmount: debt.totalAmount.toString(),
      remainingAmount: debt.remainingAmount.toString(),
      interestRate: debt.interestRate?.toString() || '',
      installments: debt.installments?.toString() || '',
      installmentAmount: debt.installmentAmount?.toString() || '',
      dueDay: debt.dueDay?.toString() || '',
      creditor: debt.creditor || '',
      notes: debt.notes || ''
    })
    setShowModal(true)
  }

  const openPaymentModal = (debt) => {
    setPayingDebt(debt)
    setPaymentAmount(debt.installmentAmount?.toString() || '')
    setShowPaymentModal(true)
  }

  const resetForm = () => {
    setForm({
      name: '',
      type: 'emprestimo',
      totalAmount: '',
      remainingAmount: '',
      interestRate: '',
      installments: '',
      installmentAmount: '',
      dueDay: '',
      creditor: '',
      notes: ''
    })
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const getProgressBarColor = (progress) => {
    if (progress >= 75) return '#22c55e'
    if (progress >= 50) return '#eab308'
    return '#ef4444'
  }

  const getStatusStyle = (status) => {
    if (status === 'paid') {
      return {
        backgroundColor: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7',
        color: '#22c55e'
      }
    }
    if (status === 'overdue') {
      return {
        backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#fef2f2',
        color: '#ef4444'
      }
    }
    return {
      backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
      color: '#3b82f6'
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>Dívidas</h1>
        <button
          onClick={() => { resetForm(); setEditingDebt(null); setShowModal(true) }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
            backgroundColor: '#3b82f6', color: 'white', border: 'none',
            borderRadius: '8px', fontWeight: '500', cursor: 'pointer'
          }}
        >
          <Plus size={18} />
          Nova Dívida
        </button>
      </div>

      {/* Resumo */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '4px' }}>Total Original</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: colors.text }}>{formatCurrency(summary.totalOriginal)}</p>
          </div>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '4px' }}>Saldo Devedor</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(summary.totalDebt)}</p>
          </div>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '4px' }}>Parcelas Mensais</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: '#f97316' }}>{formatCurrency(summary.monthlyPayment)}</p>
          </div>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '4px' }}>Dívidas Ativas</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: colors.text }}>{summary.activeCount}</p>
            <p style={{ fontSize: '12px', color: '#22c55e' }}>{summary.paidCount} quitadas</p>
          </div>
        </div>
      )}

      {/* Lista de Dívidas */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {loading ? (
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '32px', border: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'center' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : debts.length === 0 ? (
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '32px', border: `1px solid ${colors.border}`, textAlign: 'center', color: colors.textSecondary }}>
            Nenhuma dívida cadastrada
          </div>
        ) : (
          debts.map((debt) => {
            const progress = ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100
            const statusStyle = getStatusStyle(debt.status)

            return (
              <div key={debt._id} style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <h3 style={{ fontWeight: '600', fontSize: '18px', color: colors.text }}>{debt.name}</h3>
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        ...statusStyle
                      }}>
                        {debt.status === 'paid' ? 'Quitada' : debt.status === 'overdue' ? 'Atrasada' : typeLabels[debt.type]}
                      </span>
                    </div>

                    {debt.creditor && (
                      <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '8px' }}>Credor: {debt.creditor}</p>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', marginBottom: '12px' }}>
                      <div>
                        <span style={{ color: colors.textSecondary }}>Total:</span>{' '}
                        <span style={{ fontWeight: '500', color: colors.text }}>{formatCurrency(debt.totalAmount)}</span>
                      </div>
                      <div>
                        <span style={{ color: colors.textSecondary }}>Restante:</span>{' '}
                        <span style={{ fontWeight: '500', color: '#ef4444' }}>{formatCurrency(debt.remainingAmount)}</span>
                      </div>
                      {debt.installmentAmount > 0 && (
                        <div>
                          <span style={{ color: colors.textSecondary }}>Parcela:</span>{' '}
                          <span style={{ fontWeight: '500', color: colors.text }}>{formatCurrency(debt.installmentAmount)}</span>
                        </div>
                      )}
                      {debt.dueDay && (
                        <div>
                          <span style={{ color: colors.textSecondary }}>Vencimento:</span>{' '}
                          <span style={{ fontWeight: '500', color: colors.text }}>Dia {debt.dueDay}</span>
                        </div>
                      )}
                    </div>

                    {/* Barra de progresso */}
                    <div style={{ width: '100%', backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb', borderRadius: '9999px', height: '8px' }}>
                      <div
                        style={{
                          height: '8px',
                          borderRadius: '9999px',
                          transition: 'all 0.3s',
                          backgroundColor: getProgressBarColor(progress),
                          width: `${progress}%`
                        }}
                      />
                    </div>
                    <p style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>{progress.toFixed(1)}% pago</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {debt.status !== 'paid' && (
                      <button
                        onClick={() => openPaymentModal(debt)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px',
                          backgroundColor: '#22c55e', color: 'white', border: 'none',
                          borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
                        }}
                      >
                        <DollarSign size={16} />
                        Pagar
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(debt)}
                      style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, borderRadius: '8px' }}
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(debt._id)}
                      style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, borderRadius: '8px' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal de Nova/Editar Dívida */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '24px', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                {editingDebt ? 'Editar Dívida' : 'Nova Dívida'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.textSecondary }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Nome da Dívida</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                  placeholder="Ex: Financiamento do carro"
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  style={inputStyle}
                >
                  {debtTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Valor Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.totalAmount}
                    onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Saldo Devedor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.remainingAmount}
                    onChange={(e) => setForm({ ...form, remainingAmount: e.target.value })}
                    style={inputStyle}
                    placeholder="Igual ao total se nova"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Taxa de Juros (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                    style={inputStyle}
                    placeholder="Mensal"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Nº de Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    value={form.installments}
                    onChange={(e) => setForm({ ...form, installments: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Valor da Parcela (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.installmentAmount}
                    onChange={(e) => setForm({ ...form, installmentAmount: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Dia de Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.dueDay}
                    onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                    style={inputStyle}
                    placeholder="1-31"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Credor (opcional)</label>
                <input
                  type="text"
                  value={form.creditor}
                  onChange={(e) => setForm({ ...form, creditor: e.target.value })}
                  style={inputStyle}
                  placeholder="Ex: Banco do Brasil"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Observações (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
                  rows={2}
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
                  {editingDebt ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Pagamento */}
      {showPaymentModal && payingDebt && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '16px', width: '100%', maxWidth: '380px', padding: '24px', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>Registrar Pagamento</h2>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.textSecondary }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: colors.text, marginBottom: '16px' }}>
              Dívida: <span style={{ fontWeight: '500' }}>{payingDebt.name}</span>
            </p>
            <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '16px' }}>
              Saldo atual: {formatCurrency(payingDebt.remainingAmount)}
            </p>

            <form onSubmit={handlePayment}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Valor do Pagamento (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payingDebt.remainingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
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
                    border: 'none', backgroundColor: '#22c55e',
                    color: 'white', fontWeight: '500', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  <CheckCircle size={18} />
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Debts
