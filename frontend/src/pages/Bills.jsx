import { useState, useEffect, useContext, useRef, useMemo } from 'react'
import api from '../services/api'
import { Plus, Trash2, Edit2, X, Check, Home, Zap, Droplets, Wifi, Phone, Tv, Shield, CreditCard, Banknote, MoreHorizontal, Calendar, RefreshCw, Upload, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'
import MonthSelector from '../components/MonthSelector'
import SortToggle from '../components/SortToggle'

const categoryConfig = {
  moradia: { label: 'Moradia', icon: Home, color: '#8b5cf6' },
  energia: { label: 'Energia', icon: Zap, color: '#f59e0b' },
  agua: { label: 'Água', icon: Droplets, color: '#3b82f6' },
  internet: { label: 'Internet', icon: Wifi, color: '#06b6d4' },
  telefone: { label: 'Telefone', icon: Phone, color: '#10b981' },
  streaming: { label: 'Streaming', icon: Tv, color: '#ec4899' },
  seguro: { label: 'Seguro', icon: Shield, color: '#6366f1' },
  cartao: { label: 'Cartão', icon: CreditCard, color: '#ef4444' },
  emprestimo: { label: 'Empréstimo', icon: Banknote, color: '#f97316' },
  outros: { label: 'Outros', icon: MoreHorizontal, color: '#6b7280' }
}

const urgencyColors = {
  overdue: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626', label: 'Atrasada' },
  today: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626', label: 'Vence hoje' },
  soon: { bg: '#fffbeb', border: '#f59e0b', text: '#d97706', label: 'Próximos 3 dias' },
  upcoming: { bg: '#f0fdf4', border: '#22c55e', text: '#16a34a', label: 'Esta semana' },
  next_week: { bg: '#eff6ff', border: '#3b82f6', text: '#2563eb', label: 'Próxima semana' },
  normal: { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', label: '' },
  paid: { bg: '#f0fdf4', border: '#22c55e', text: '#16a34a', label: 'Paga' }
}

function Bills() {
  const { colors, isDark } = useContext(ThemeContext)
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [bills, setBills] = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBill, setEditingBill] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' = vencimento próximo, 'desc' = vencimento distante

  const [form, setForm] = useState({
    name: '',
    category: 'outros',
    amount: '',
    dueDay: '',
    isRecurring: true,
    notes: ''
  })

  // Import states
  const [showImportModal, setShowImportModal] = useState(false)
  const [importStep, setImportStep] = useState('upload') // 'upload', 'preview', 'importing', 'done'
  const [importedBills, setImportedBills] = useState([])
  const [selectedBills, setSelectedBills] = useState([])
  const [importError, setImportError] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [importText, setImportText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef(null)

  const handleMonthChange = (month, year) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    const fetchBillsInternal = async () => {
      try {
        const params = new URLSearchParams()
        params.append('month', selectedMonth)
        params.append('year', selectedYear)
        if (filter !== 'all') params.append('status', filter)
        const response = await api.get(`/bills?${params}`, { signal: abortController.signal })
        if (isMounted) {
          setBills(response.data.bills)
        }
      } catch (error) {
        if (error.name !== 'AbortError' && isMounted) {
          console.error('Erro ao carregar contas:', error)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    const fetchSummaryInternal = async () => {
      try {
        const response = await api.get(`/bills/summary?month=${selectedMonth}&year=${selectedYear}`, { signal: abortController.signal })
        if (isMounted) {
          setSummary(response.data)
        }
      } catch (error) {
        if (error.name !== 'AbortError' && isMounted) {
          console.error('Erro ao carregar resumo:', error)
        }
      }
    }

    fetchBillsInternal()
    fetchSummaryInternal()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [filter, selectedMonth, selectedYear])

  const fetchBills = async () => {
    try {
      const params = new URLSearchParams()
      params.append('month', selectedMonth)
      params.append('year', selectedYear)
      if (filter !== 'all') params.append('status', filter)
      const response = await api.get(`/bills?${params}`)
      setBills(response.data.bills)
    } catch (error) {
      console.error('Erro ao carregar contas:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async () => {
    try {
      const response = await api.get(`/bills/summary?month=${selectedMonth}&year=${selectedYear}`)
      setSummary(response.data)
    } catch (error) {
      console.error('Erro ao carregar resumo:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingBill) {
        // Usar endpoint correto baseado na origem do item
        if (editingBill.isFromRecurring) {
          // Para recorrências vindas de Contas a Pagar, criar override apenas para este mês
          // Isso NÃO afeta os outros meses
          const overrideData = {
            month: selectedMonth,
            year: selectedYear,
            amount: parseFloat(form.amount),
            name: form.name
          }
          await api.put(`/bills/${editingBill.recurringId || editingBill._id}/override`, overrideData)
        } else {
          await api.put(`/bills/${editingBill._id}`, form)
        }
      } else {
        await api.post('/bills', form)
      }
      setShowModal(false)
      setEditingBill(null)
      resetForm()
      fetchBills()
      fetchSummary()
    } catch (error) {
      console.error('Erro ao salvar conta:', error)
    }
  }

  const handlePay = async (bill) => {
    if (!confirm(`Confirma pagamento de ${formatCurrency(bill.amount)} para "${bill.name}"?`)) return
    try {
      await api.post(`/bills/${bill._id}/pay`, {
        isFromRecurring: bill.isFromRecurring || false,
        month: selectedMonth,
        year: selectedYear
      })
      fetchBills()
      fetchSummary()
    } catch (error) {
      console.error('Erro ao pagar conta:', error)
      alert(error.response?.data?.message || 'Erro ao pagar conta')
    }
  }

  const handleDelete = async (bill) => {
    const confirmMsg = bill.isFromRecurring
      ? 'Tem certeza que deseja excluir esta conta recorrente? Ela será removida de todos os meses.'
      : 'Tem certeza que deseja excluir esta conta?'

    if (!confirm(confirmMsg)) return
    try {
      // Usar endpoint correto baseado na origem do item
      const endpoint = bill.isFromRecurring ? `/recurring/${bill._id}` : `/bills/${bill._id}`
      await api.delete(endpoint)
      fetchBills()
      fetchSummary()
    } catch (error) {
      console.error('Erro ao excluir conta:', error)
    }
  }

  const openEditModal = (bill) => {
    setEditingBill(bill)
    setForm({
      name: bill.name,
      category: bill.category,
      amount: bill.amount.toString(),
      dueDay: bill.dueDay.toString(),
      isRecurring: bill.isRecurring,
      notes: bill.notes || ''
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setForm({
      name: '',
      category: 'outros',
      amount: '',
      dueDay: '',
      isRecurring: true,
      notes: ''
    })
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // Get urgency colors that adapt to dark mode
  const getUrgencyColors = (urgency) => {
    const base = urgencyColors[urgency] || urgencyColors.normal
    if (isDark) {
      return {
        ...base,
        bg: urgency === 'normal' ? colors.backgroundCard : `${base.border}15`
      }
    }
    return base
  }

  // Import Functions
  const resetImport = () => {
    setImportStep('upload')
    setImportedBills([])
    setSelectedBills([])
    setImportError(null)
    setImportResult(null)
    setImportText('')
    setIsProcessing(false)
  }

  const openImportModal = () => {
    resetImport()
    setShowImportModal(true)
  }

  const closeImportModal = () => {
    setShowImportModal(false)
    resetImport()
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    console.log('[PDF Import] Arquivo selecionado:', file)

    if (!file) {
      console.log('[PDF Import] Nenhum arquivo selecionado')
      return
    }

    // Verifica se é PDF pelo tipo ou pela extensão
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    console.log('[PDF Import] É PDF:', isPDF, 'Tipo:', file.type, 'Nome:', file.name)

    if (!isPDF) {
      setImportError('Apenas arquivos PDF são permitidos')
      return
    }

    setIsProcessing(true)
    setImportError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      console.log('[PDF Import] Enviando para o servidor...')
      const response = await api.post('/import/pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      console.log('[PDF Import] Resposta do servidor:', response.data)

      if (response.data.bills && response.data.bills.length > 0) {
        setImportedBills(response.data.bills)
        setSelectedBills(response.data.bills.map((_, i) => i))
        setImportStep('preview')
      } else {
        setImportError('Nenhuma conta encontrada no PDF. Tente copiar e colar o texto.')
      }
    } catch (error) {
      console.error('[PDF Import] Erro:', error)
      console.error('[PDF Import] Resposta de erro:', error.response?.data)
      setImportError(error.response?.data?.message || 'Erro ao processar arquivo. Verifique o console.')
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleTextImport = async () => {
    if (!importText.trim()) {
      setImportError('Cole o texto das contas para importar')
      return
    }

    setIsProcessing(true)
    setImportError(null)

    try {
      const response = await api.post('/import/text', { text: importText })

      if (response.data.bills && response.data.bills.length > 0) {
        setImportedBills(response.data.bills)
        setSelectedBills(response.data.bills.map((_, i) => i))
        setImportStep('preview')
      } else {
        setImportError('Nenhuma conta encontrada no texto. Verifique o formato.')
      }
    } catch (error) {
      console.error('Erro ao processar texto:', error)
      setImportError(error.response?.data?.message || 'Erro ao processar texto')
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleBillSelection = (index) => {
    setSelectedBills(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const toggleAllBills = () => {
    if (selectedBills.length === importedBills.length) {
      setSelectedBills([])
    } else {
      setSelectedBills(importedBills.map((_, i) => i))
    }
  }

  const updateImportedBill = (index, field, value) => {
    setImportedBills(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const confirmImport = async () => {
    const billsToImport = selectedBills.map(index => importedBills[index])

    if (billsToImport.length === 0) {
      setImportError('Selecione pelo menos uma conta para importar')
      return
    }

    setImportStep('importing')

    try {
      const response = await api.post('/import/confirm', { bills: billsToImport })

      setImportResult({
        success: true,
        created: response.data.created,
        errors: response.data.errors,
        errorDetails: response.data.errorDetails
      })
      setImportStep('done')

      // Refresh bills list
      fetchBills()
      fetchSummary()
    } catch (error) {
      console.error('Erro ao importar:', error)
      setImportError(error.response?.data?.message || 'Erro ao importar contas')
      setImportStep('preview')
    }
  }

  return (
    <div>
      {/* Header com título e seletor de mês */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>Contas a Pagar</h1>
        <MonthSelector
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onChange={handleMonthChange}
        />
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={openImportModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: isDark ? '#374151' : '#f3f4f6',
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Upload size={18} />
            Importar PDF
          </button>
          <button
            onClick={() => { resetForm(); setEditingBill(null); setShowModal(true) }}
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
            Nova Conta
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
          <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Total do Mês</p>
          <p style={{ fontSize: '20px', fontWeight: '700', color: colors.text }}>{formatCurrency(summary.total || 0)}</p>
        </div>
        <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
          <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Pendente</p>
          <p style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(summary.pending || 0)}</p>
        </div>
        <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
          <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Pago</p>
          <p style={{ fontSize: '20px', fontWeight: '700', color: '#22c55e' }}>{formatCurrency(summary.paid || 0)}</p>
        </div>
        <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', border: `1px solid ${colors.border}` }}>
          <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Atrasadas</p>
          <p style={{ fontSize: '20px', fontWeight: '700', color: summary.overdueCount > 0 ? '#ef4444' : '#22c55e' }}>{summary.overdueCount || 0}</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { value: 'all', label: 'Todas' },
          { value: 'pending', label: 'Pendentes' },
          { value: 'paid', label: 'Pagas' }
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: filter === f.value ? '#3b82f6' : (isDark ? colors.border : '#e5e7eb'),
              color: filter === f.value ? 'white' : colors.textSecondary,
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Contador e Ordenação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
          {bills.length} conta(s) encontrada(s)
        </span>
        <SortToggle
          sortOrder={sortOrder}
          onToggle={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          label="Vencimento"
        />
      </div>

      {/* Lista de Contas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>Carregando...</div>
      ) : bills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary, backgroundColor: colors.backgroundCard, borderRadius: '12px', border: `1px solid ${colors.border}` }}>
          Nenhuma conta cadastrada
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...bills].sort((a, b) => sortOrder === 'asc' ? a.dueDay - b.dueDay : b.dueDay - a.dueDay).map((bill) => {
            const cat = categoryConfig[bill.category] || categoryConfig.outros
            const urgency = getUrgencyColors(bill.urgency)
            const Icon = cat.icon

            return (
              <div
                key={bill._id}
                style={{
                  backgroundColor: urgency.bg,
                  borderRadius: '12px',
                  padding: '16px',
                  borderLeft: `4px solid ${urgency.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                {/* Ícone */}
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  backgroundColor: `${cat.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon size={22} color={cat.color} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontWeight: '600', color: colors.text }}>{bill.name}</h3>
                    {bill.isRecurring && <RefreshCw size={14} color={colors.textSecondary} />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <Calendar size={14} color={colors.textSecondary} />
                    <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                      Dia {bill.dueDay}
                    </span>
                    {bill.urgency !== 'normal' && bill.urgency !== 'paid' && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: urgency.border,
                        color: 'white',
                        fontWeight: '500'
                      }}>
                        {urgency.label}
                      </span>
                    )}
                    {bill.isPaid && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: '#22c55e',
                        color: 'white',
                        fontWeight: '500'
                      }}>
                        Paga
                      </span>
                    )}
                  </div>
                </div>

                {/* Valor */}
                <div style={{ textAlign: 'right', minWidth: '100px' }}>
                  <p style={{ fontSize: '18px', fontWeight: '700', color: bill.isPaid ? '#22c55e' : colors.text }}>
                    {formatCurrency(bill.amount)}
                  </p>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!bill.isPaid && (
                    <button
                      onClick={() => handlePay(bill)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        backgroundColor: '#22c55e',
                        color: 'white',
                        border: 'none',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Check size={16} />
                      Pagar
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(bill)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? colors.border : '#f3f4f6',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit2 size={16} color={colors.textSecondary} />
                  </button>
                  <button
                    onClick={() => handleDelete(bill)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </button>
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
            maxWidth: '420px',
            padding: '24px',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                {editingBill ? 'Editar Conta' : 'Nova Conta'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                  Nome da Conta
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Netflix, Aluguel, Luz..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.backgroundCard,
                    color: colors.text,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                  Categoria
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {Object.entries(categoryConfig).map(([key, config]) => {
                    const Icon = config.icon
                    const isSelected = form.category === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm({ ...form, category: key })}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${config.color}` : `2px solid ${colors.border}`,
                          backgroundColor: isSelected ? `${config.color}15` : colors.backgroundCard,
                          cursor: 'pointer'
                        }}
                      >
                        <Icon size={18} color={isSelected ? config.color : colors.textSecondary} />
                        <span style={{ fontSize: '9px', marginTop: '2px', color: isSelected ? config.color : colors.textSecondary }}>
                          {config.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0,00"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.backgroundCard,
                      color: colors.text,
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                    Dia do Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.dueDay}
                    onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                    placeholder="15"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.backgroundCard,
                      color: colors.text,
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '14px', color: colors.text }}>Conta recorrente (mensal)</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  {editingBill ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
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
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px',
            border: `1px solid ${colors.border}`
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} />
                Importar Contas
              </h2>
              <button onClick={closeImportModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            {/* Step: Upload */}
            {importStep === 'upload' && (
              <div>
                {/* PDF Upload */}
                <div
                  style={{
                    border: `2px dashed ${isProcessing ? '#3b82f6' : colors.border}`,
                    borderRadius: '12px',
                    padding: '32px',
                    textAlign: 'center',
                    marginBottom: '20px',
                    cursor: isProcessing ? 'wait' : 'pointer',
                    transition: 'border-color 0.2s',
                    backgroundColor: isProcessing ? (isDark ? '#1e3a5f' : '#eff6ff') : 'transparent'
                  }}
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  {isProcessing ? (
                    <>
                      <Loader size={40} color="#3b82f6" style={{ marginBottom: '12px', animation: 'spin 1s linear infinite' }} />
                      <p style={{ color: colors.text, fontWeight: '500', marginBottom: '4px' }}>
                        Processando PDF...
                      </p>
                      <p style={{ color: colors.textSecondary, fontSize: '13px' }}>
                        Extraindo contas automaticamente
                      </p>
                      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </>
                  ) : (
                    <>
                      <Upload size={40} color={colors.textSecondary} style={{ marginBottom: '12px' }} />
                      <p style={{ color: colors.text, fontWeight: '500', marginBottom: '4px' }}>
                        Arraste o PDF aqui
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          fileInputRef.current?.click()
                        }}
                        style={{
                          marginTop: '12px',
                          padding: '10px 24px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Selecionar Arquivo
                      </button>
                      <p style={{ color: colors.textSecondary, fontSize: '12px', marginTop: '8px' }}>
                        Formatos aceitos: PDF
                      </p>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
                  <span style={{ color: colors.textSecondary, fontSize: '13px' }}>ou cole o texto</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
                </div>

                {/* Text Input */}
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Cole aqui a lista de contas do seu relatório...

Exemplo:
Energia - R$ 150,00 - Venc: 15/01
Internet - R$ 99,90 - Dia 10
Netflix - R$ 55,90"
                  style={{
                    width: '100%',
                    minHeight: '150px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.backgroundCard,
                    color: colors.text,
                    fontSize: '14px',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />

                {/* Error */}
                {importError && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '8px',
                    marginTop: '16px'
                  }}>
                    <AlertCircle size={18} color="#ef4444" />
                    <span style={{ color: '#dc2626', fontSize: '14px' }}>{importError}</span>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={closeImportModal}
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
                    onClick={handleTextImport}
                    disabled={isProcessing || !importText.trim()}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: (isProcessing || !importText.trim()) ? '#9ca3af' : '#3b82f6',
                      color: 'white',
                      fontWeight: '500',
                      cursor: (isProcessing || !importText.trim()) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isProcessing && <Loader size={16} className="animate-spin" />}
                    Processar Texto
                  </button>
                </div>
              </div>
            )}

            {/* Step: Preview */}
            {importStep === 'preview' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ color: colors.textSecondary, fontSize: '14px' }}>
                    {importedBills.length} conta(s) encontrada(s)
                  </p>
                  <button
                    onClick={toggleAllBills}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedBills.length === importedBills.length ? 'Desmarcar todas' : 'Selecionar todas'}
                  </button>
                </div>

                {/* Bills List */}
                <div style={{ maxHeight: '400px', overflow: 'auto', marginBottom: '16px' }}>
                  {importedBills.map((bill, index) => {
                    const isSelected = selectedBills.includes(index)
                    const cat = categoryConfig[bill.category] || categoryConfig.outros
                    const CatIcon = cat.icon

                    return (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          padding: '12px',
                          borderRadius: '8px',
                          backgroundColor: isSelected ? (isDark ? '#1e3a5f' : '#eff6ff') : colors.backgroundSecondary,
                          marginBottom: '8px',
                          border: `1px solid ${isSelected ? '#3b82f6' : colors.border}`
                        }}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleBillSelection(index)}
                          style={{ width: '18px', height: '18px', marginTop: '4px', cursor: 'pointer' }}
                        />

                        {/* Content */}
                        <div style={{ flex: 1 }}>
                          {/* Name */}
                          <input
                            type="text"
                            value={bill.name}
                            onChange={(e) => updateImportedBill(index, 'name', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${colors.border}`,
                              backgroundColor: colors.backgroundCard,
                              color: colors.text,
                              fontSize: '14px',
                              fontWeight: '500',
                              marginBottom: '8px',
                              boxSizing: 'border-box'
                            }}
                          />

                          {/* Details Row */}
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Category */}
                            <select
                              value={bill.category}
                              onChange={(e) => updateImportedBill(index, 'category', e.target.value)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: `1px solid ${colors.border}`,
                                backgroundColor: colors.backgroundCard,
                                color: colors.text,
                                fontSize: '12px'
                              }}
                            >
                              {Object.entries(categoryConfig).map(([key, config]) => (
                                <option key={key} value={key}>{config.label}</option>
                              ))}
                            </select>

                            {/* Amount */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: colors.textSecondary, fontSize: '12px' }}>R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={bill.amount || ''}
                                onChange={(e) => updateImportedBill(index, 'amount', parseFloat(e.target.value) || 0)}
                                style={{
                                  width: '80px',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: `1px solid ${colors.border}`,
                                  backgroundColor: colors.backgroundCard,
                                  color: colors.text,
                                  fontSize: '12px'
                                }}
                              />
                            </div>

                            {/* Due Day */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: colors.textSecondary, fontSize: '12px' }}>Dia</span>
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={bill.dueDay || ''}
                                onChange={(e) => updateImportedBill(index, 'dueDay', parseInt(e.target.value) || null)}
                                style={{
                                  width: '50px',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: `1px solid ${colors.border}`,
                                  backgroundColor: colors.backgroundCard,
                                  color: colors.text,
                                  fontSize: '12px'
                                }}
                              />
                            </div>
                          </div>

                          {/* Confidence Indicator */}
                          {bill.confidence < 60 && (
                            <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={12} />
                              Verifique os dados - baixa confiança na leitura
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Error */}
                {importError && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}>
                    <AlertCircle size={18} color="#ef4444" />
                    <span style={{ color: '#dc2626', fontSize: '14px' }}>{importError}</span>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={resetImport}
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
                    Voltar
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={selectedBills.length === 0}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: selectedBills.length === 0 ? '#9ca3af' : '#22c55e',
                      color: 'white',
                      fontWeight: '500',
                      cursor: selectedBills.length === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Importar {selectedBills.length} conta(s)
                  </button>
                </div>
              </div>
            )}

            {/* Step: Importing */}
            {importStep === 'importing' && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Loader size={48} color="#3b82f6" className="animate-spin" style={{ marginBottom: '16px', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: colors.text, fontWeight: '500' }}>Importando contas...</p>
                <p style={{ color: colors.textSecondary, fontSize: '14px', marginTop: '8px' }}>
                  Aguarde enquanto processamos suas contas
                </p>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* Step: Done */}
            {importStep === 'done' && importResult && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <CheckCircle size={32} color="#22c55e" />
                </div>

                <h3 style={{ color: colors.text, fontWeight: '600', marginBottom: '8px' }}>
                  Importação Concluída!
                </h3>

                <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '16px' }}>
                  {importResult.created} conta(s) importada(s) com sucesso
                  {importResult.errors > 0 && ` (${importResult.errors} erro(s))`}
                </p>

                {/* Error Details */}
                {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                  <div style={{
                    textAlign: 'left',
                    backgroundColor: '#fef2f2',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px'
                  }}>
                    <p style={{ color: '#dc2626', fontWeight: '500', fontSize: '13px', marginBottom: '8px' }}>
                      Alguns itens não foram importados:
                    </p>
                    {importResult.errorDetails.map((err, i) => (
                      <p key={i} style={{ color: '#b91c1c', fontSize: '12px', marginBottom: '4px' }}>
                        • {err.bill}: {err.error}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  onClick={closeImportModal}
                  style={{
                    padding: '12px 32px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Bills
