import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import { Plus, Trash2, Edit2, X, TrendingUp, TrendingDown } from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'

const investmentTypes = [
  { value: 'acao', label: 'Ação' },
  { value: 'fii', label: 'FII' },
  { value: 'criptomoeda', label: 'Criptomoeda' },
  { value: 'renda_fixa', label: 'Renda Fixa' },
  { value: 'tesouro', label: 'Tesouro Direto' },
  { value: 'fundo', label: 'Fundo de Investimento' },
  { value: 'outro', label: 'Outro' }
]

const typeLabels = Object.fromEntries(investmentTypes.map(t => [t.value, t.label]))

function Investments() {
  const { colors, isDark } = useContext(ThemeContext)
  const [investments, setInvestments] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState(null)

  const [form, setForm] = useState({
    type: 'acao',
    name: '',
    ticker: '',
    quantity: '',
    purchasePrice: '',
    currentPrice: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [invRes, summaryRes] = await Promise.all([
        api.get('/investments'),
        api.get('/investments/summary')
      ])
      setInvestments(invRes.data)
      setSummary(summaryRes.data)
    } catch (error) {
      console.error('Erro ao carregar investimentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const data = {
      ...form,
      quantity: parseFloat(form.quantity),
      purchasePrice: parseFloat(form.purchasePrice),
      currentPrice: parseFloat(form.currentPrice) || parseFloat(form.purchasePrice)
    }

    try {
      if (editingInvestment) {
        await api.put(`/investments/${editingInvestment._id}`, data)
      } else {
        await api.post('/investments', data)
      }

      setShowModal(false)
      setEditingInvestment(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Erro ao salvar investimento:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este investimento?')) return

    try {
      await api.delete(`/investments/${id}`)
      fetchData()
    } catch (error) {
      console.error('Erro ao excluir investimento:', error)
    }
  }

  const openEditModal = (inv) => {
    setEditingInvestment(inv)
    setForm({
      type: inv.type,
      name: inv.name,
      ticker: inv.ticker || '',
      quantity: inv.quantity.toString(),
      purchasePrice: inv.purchasePrice.toString(),
      currentPrice: inv.currentPrice.toString(),
      purchaseDate: inv.purchaseDate.split('T')[0],
      notes: inv.notes || ''
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setForm({
      type: 'acao',
      name: '',
      ticker: '',
      quantity: '',
      purchasePrice: '',
      currentPrice: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      notes: ''
    })
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const calculateProfit = (inv) => {
    const invested = inv.quantity * inv.purchasePrice
    const current = inv.quantity * inv.currentPrice
    return current - invested
  }

  const calculateProfitPercentage = (inv) => {
    const invested = inv.quantity * inv.purchasePrice
    if (invested === 0) return 0
    const profit = calculateProfit(inv)
    return (profit / invested) * 100
  }

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

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>Investimentos</h1>
        <button
          onClick={() => { resetForm(); setEditingInvestment(null); setShowModal(true) }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
            backgroundColor: '#3b82f6', color: 'white', border: 'none',
            borderRadius: '8px', fontWeight: '500', cursor: 'pointer'
          }}
        >
          <Plus size={18} />
          Novo Investimento
        </button>
      </div>

      {/* Resumo */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Total Investido</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: colors.text }}>{formatCurrency(summary.totalInvested)}</p>
          </div>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Valor Atual</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: '#8b5cf6' }}>{formatCurrency(summary.currentValue)}</p>
          </div>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Lucro/Prejuízo</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: summary.profit >= 0 ? '#22c55e' : '#ef4444' }}>
              {summary.profit >= 0 ? '+' : ''}{formatCurrency(summary.profit)}
            </p>
          </div>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Rentabilidade</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: summary.profitPercentage >= 0 ? '#22c55e' : '#ef4444' }}>
              {summary.profitPercentage >= 0 ? '+' : ''}{summary.profitPercentage.toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      {/* Lista de Investimentos */}
      <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : investments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: colors.textSecondary }}>
            Nenhum investimento cadastrado
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Ativo</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Tipo</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Qtd</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>PM</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Atual</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Lucro</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  const profit = calculateProfit(inv)
                  const profitPct = calculateProfitPercentage(inv)

                  return (
                    <tr key={inv._id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div>
                          <p style={{ fontWeight: '500', color: colors.text }}>{inv.name}</p>
                          {inv.ticker && <p style={{ fontSize: '12px', color: colors.textSecondary }}>{inv.ticker}</p>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          fontSize: '12px', padding: '4px 8px', borderRadius: '12px',
                          backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
                          color: '#3b82f6'
                        }}>
                          {typeLabels[inv.type]}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: colors.text }}>{inv.quantity}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: colors.text }}>{formatCurrency(inv.purchasePrice)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: colors.text }}>{formatCurrency(inv.currentPrice)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', color: profit >= 0 ? '#22c55e' : '#ef4444' }}>
                          {profit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          <span style={{ fontWeight: '500' }}>{profitPct.toFixed(2)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <button
                          onClick={() => openEditModal(inv)}
                          style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(inv._id)}
                          style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, marginLeft: '8px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '24px', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                {editingInvestment ? 'Editar Investimento' : 'Novo Investimento'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: colors.textSecondary }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  style={inputStyle}
                >
                  {investmentTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Nome do Ativo</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                  placeholder="Ex: Petrobras"
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Ticker (opcional)</label>
                <input
                  type="text"
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                  style={inputStyle}
                  placeholder="Ex: PETR4"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Quantidade</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Preço Médio (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.purchasePrice}
                    onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Preço Atual (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.currentPrice}
                  onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
                  style={inputStyle}
                  placeholder="Deixe em branco para usar o preço de compra"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Data de Compra</label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Observações (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
                  rows={2}
                  placeholder="Anotações sobre o investimento"
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
                  {editingInvestment ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Investments
