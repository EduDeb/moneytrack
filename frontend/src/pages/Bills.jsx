import { useState, useEffect, useContext, useRef, useMemo } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, X, Check, Home, Zap, Droplets, Wifi, Phone, Tv, Shield, CreditCard, Banknote, MoreHorizontal, Calendar, RefreshCw, Upload, FileText, AlertCircle, CheckCircle, Loader, CheckSquare, Square, XCircle, SkipForward, Percent, DollarSign, Info, Undo2 } from 'lucide-react'
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

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

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

  // Seleção múltipla
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState([])
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)

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

  // Modal de ações da conta
  const [showActionModal, setShowActionModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [actionType, setActionType] = useState(null) // 'discount', 'partial', 'skip'
  const [discountAmount, setDiscountAmount] = useState('')
  const [partialAmount, setPartialAmount] = useState('')
  const [actionNotes, setActionNotes] = useState('')
  const [isProcessingAction, setIsProcessingAction] = useState(false)

  // Modal de exclusão (para escolher: só este mês ou todos)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

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
      await fetchBills()
      await fetchSummary()
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
      await fetchBills()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao pagar conta:', error)
      toast.error(error.response?.data?.message || 'Erro ao pagar conta')
    }
  }

  const handleDelete = async (bill) => {
    // Para contas recorrentes, abrir modal de opções
    if (bill.isFromRecurring) {
      setSelectedBill(bill)
      setShowDeleteModal(true)
      return
    }

    // Para contas não-recorrentes, excluir diretamente
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return
    try {
      await api.delete(`/bills/${bill._id}`)
      await fetchBills()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao excluir conta:', error)
    }
  }

  // Excluir apenas deste mês (usar skip)
  const handleDeleteThisMonth = async () => {
    if (!selectedBill) return
    try {
      await api.post(`/bills/${selectedBill._id}/skip`, {
        month: selectedMonth,
        year: selectedYear,
        notes: 'Excluído deste mês'
      })
      setShowDeleteModal(false)
      setSelectedBill(null)
      await fetchBills()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao excluir deste mês:', error)
      toast.error(error.response?.data?.message || 'Erro ao excluir')
    }
  }

  // Excluir de todos os meses (deletar recorrência)
  const handleDeleteAllMonths = async () => {
    if (!selectedBill) return
    if (!confirm('ATENÇÃO: Isso vai excluir esta conta de TODOS os meses futuros. Continuar?')) return
    try {
      await api.delete(`/recurring/${selectedBill._id}`)
      setShowDeleteModal(false)
      setSelectedBill(null)
      await fetchBills()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao excluir recorrência:', error)
      toast.error(error.response?.data?.message || 'Erro ao excluir')
    }
  }

  // Abrir modal de ações
  const openActionModal = (bill) => {
    setSelectedBill(bill)
    setActionType(null)
    setDiscountAmount('')
    setPartialAmount('')
    setActionNotes('')
    setShowActionModal(true)
  }

  // Pular mês (skip) - não apaga a recorrência, só marca como pulada neste mês
  const handleSkipMonth = async () => {
    if (!selectedBill) return
    setIsProcessingAction(true)
    try {
      await api.post(`/bills/${selectedBill._id}/skip`, {
        month: selectedMonth,
        year: selectedYear,
        notes: actionNotes || 'Mês pulado'
      })
      setShowActionModal(false)
      await fetchBills()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao pular mês:', error)
      toast.error(error.response?.data?.message || 'Erro ao pular mês')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Pagar com desconto
  const handlePayWithDiscount = async () => {
    if (!selectedBill || !discountAmount) return
    setIsProcessingAction(true)
    try {
      await api.post(`/bills/${selectedBill._id}/pay-with-discount`, {
        month: selectedMonth,
        year: selectedYear,
        discountAmount: parseFloat(discountAmount),
        notes: actionNotes || `Desconto de R$ ${parseFloat(discountAmount).toFixed(2)}`
      })
      setShowActionModal(false)
      await fetchBills()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao pagar com desconto:', error)
      toast.error(error.response?.data?.message || 'Erro ao pagar com desconto')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Pagamento parcial
  const handlePartialPayment = async () => {
    if (!selectedBill || !partialAmount) return
    setIsProcessingAction(true)
    try {
      await api.post(`/bills/${selectedBill._id}/pay-partial`, {
        month: selectedMonth,
        year: selectedYear,
        paidAmount: parseFloat(partialAmount),
        notes: actionNotes
      })
      setShowActionModal(false)
      await fetchBills()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao registrar pagamento parcial:', error)
      toast.error(error.response?.data?.message || 'Erro ao registrar pagamento parcial')
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Desfazer override (restaurar valor original)
  const handleUndoOverride = async () => {
    if (!selectedBill) return
    setIsProcessingAction(true)
    try {
      await api.delete(`/bills/${selectedBill._id}/override`, {
        data: {
          month: selectedMonth,
          year: selectedYear
        }
      })
      setShowActionModal(false)
      await fetchBills()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao desfazer alteração:', error)
      toast.error(error.response?.data?.message || 'Erro ao desfazer alteração')
    } finally {
      setIsProcessingAction(false)
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
      await fetchBills()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao importar:', error)
      setImportError(error.response?.data?.message || 'Erro ao importar contas')
      setImportStep('preview')
    }
  }

  // Funções de seleção múltipla
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    setSelectedItems([])
  }

  const toggleItemSelection = (billId) => {
    setSelectedItems(prev =>
      prev.includes(billId)
        ? prev.filter(id => id !== billId)
        : [...prev, billId]
    )
  }

  const selectAllItems = () => {
    const filteredBills = getFilteredBills()
    if (selectedItems.length === filteredBills.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredBills.map(b => b._id))
    }
  }

  const getFilteredBills = () => {
    let filtered = bills
    if (filter === 'paid') {
      filtered = bills.filter(b => b.isPaid)
    } else if (filter === 'pending') {
      filtered = bills.filter(b => !b.isPaid)
    }
    return [...filtered].sort((a, b) => sortOrder === 'asc' ? a.dueDay - b.dueDay : b.dueDay - a.dueDay)
  }

  // Pagar todas selecionadas
  const handlePaySelected = async () => {
    if (selectedItems.length === 0) return

    const pendingBills = bills.filter(b => selectedItems.includes(b._id) && !b.isPaid)
    if (pendingBills.length === 0) {
      toast.error('Nenhuma conta pendente selecionada')
      return
    }

    const total = pendingBills.reduce((sum, b) => sum + b.amount, 0)
    if (!confirm(`Confirma pagamento de ${pendingBills.length} conta(s) no valor total de ${formatCurrency(total)}?`)) return

    setIsProcessingBatch(true)
    let successCount = 0
    let errorCount = 0

    for (const bill of pendingBills) {
      try {
        await api.post(`/bills/${bill._id}/pay`, {
          isFromRecurring: bill.isFromRecurring || false,
          month: selectedMonth,
          year: selectedYear
        })
        successCount++
      } catch (error) {
        console.error(`Erro ao pagar ${bill.name}:`, error)
        errorCount++
      }
    }

    setIsProcessingBatch(false)
    setSelectedItems([])
    setSelectionMode(false)
    await fetchBills()
    await fetchSummary()

    if (errorCount > 0) {
      toast.error(`${successCount} paga(s), ${errorCount} erro(s)`)
    } else if (successCount > 0) {
      toast.success(`${successCount} conta(s) paga(s) com sucesso!`)
    }
  }

  // Cancelar pagamento (desfazer) - criar endpoint se necessário
  const handleUnpaySelected = async () => {
    if (selectedItems.length === 0) return

    const paidBills = bills.filter(b => selectedItems.includes(b._id) && b.isPaid)
    if (paidBills.length === 0) {
      toast.error('Nenhuma conta paga selecionada')
      return
    }

    if (!confirm(`Deseja cancelar o pagamento de ${paidBills.length} conta(s)?`)) return

    setIsProcessingBatch(true)
    let successCount = 0
    let errorCount = 0

    for (const bill of paidBills) {
      try {
        await api.post(`/bills/${bill._id}/unpay`, {
          isFromRecurring: bill.isFromRecurring || false,
          month: selectedMonth,
          year: selectedYear
        })
        successCount++
      } catch (error) {
        console.error(`Erro ao cancelar pagamento de ${bill.name}:`, error)
        errorCount++
      }
    }

    setIsProcessingBatch(false)
    setSelectedItems([])
    setSelectionMode(false)
    await fetchBills()
    await fetchSummary()

    if (errorCount > 0) {
      toast.error(`${successCount} cancelado(s), ${errorCount} erro(s)`)
    } else if (successCount > 0) {
      toast.success(`${successCount} pagamento(s) cancelado(s)!`)
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

      {/* Filtros e Seleção Múltipla */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { value: 'all', label: 'Todas' },
            { value: 'pending', label: 'Pendentes' },
            { value: 'paid', label: 'Pagas' }
          ].map(f => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setSelectedItems([]) }}
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

        {/* Botão de seleção múltipla */}
        <button
          onClick={toggleSelectionMode}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '20px',
            border: `1px solid ${selectionMode ? '#3b82f6' : colors.border}`,
            backgroundColor: selectionMode ? '#3b82f6' : 'transparent',
            color: selectionMode ? 'white' : colors.textSecondary,
            fontWeight: '500',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          {selectionMode ? <XCircle size={16} /> : <CheckSquare size={16} />}
          {selectionMode ? 'Cancelar' : 'Selecionar'}
        </button>
      </div>

      {/* Barra de ações de seleção múltipla */}
      {selectionMode && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
          padding: '12px 16px',
          backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
          borderRadius: '12px',
          border: '1px solid #3b82f6',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={selectAllItems}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.backgroundCard,
              color: colors.text,
              fontWeight: '500',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {selectedItems.length === getFilteredBills().length ? <Square size={16} /> : <CheckSquare size={16} />}
            {selectedItems.length === getFilteredBills().length ? 'Desmarcar Todas' : 'Selecionar Todas'}
          </button>

          <span style={{ color: colors.text, fontSize: '13px', fontWeight: '500' }}>
            {selectedItems.length} selecionada(s)
          </span>

          <div style={{ flex: 1 }} />

          {filter !== 'paid' && (
            <button
              onClick={handlePaySelected}
              disabled={selectedItems.length === 0 || isProcessingBatch}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: selectedItems.length === 0 ? '#9ca3af' : '#22c55e',
                color: 'white',
                fontWeight: '500',
                cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              {isProcessingBatch ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
              Pagar Selecionadas
            </button>
          )}

          {filter !== 'pending' && (
            <button
              onClick={handleUnpaySelected}
              disabled={selectedItems.length === 0 || isProcessingBatch}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: selectedItems.length === 0 ? '#9ca3af' : '#f59e0b',
                color: 'white',
                fontWeight: '500',
                cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              {isProcessingBatch ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={16} />}
              Cancelar Pagamento
            </button>
          )}
        </div>
      )}

      {/* Contador e Ordenação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
          {getFilteredBills().length} conta(s) encontrada(s)
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
      ) : getFilteredBills().length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary, backgroundColor: colors.backgroundCard, borderRadius: '12px', border: `1px solid ${colors.border}` }}>
          {filter === 'all' ? 'Nenhuma conta cadastrada' : filter === 'paid' ? 'Nenhuma conta paga este mês' : 'Nenhuma conta pendente'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {getFilteredBills().map((bill) => {
            const cat = categoryConfig[bill.category] || categoryConfig.outros
            const urgency = getUrgencyColors(bill.urgency)
            const Icon = cat.icon
            const isSelected = selectedItems.includes(bill._id)

            return (
              <div
                key={bill._id}
                onClick={selectionMode ? () => toggleItemSelection(bill._id) : undefined}
                style={{
                  backgroundColor: isSelected ? (isDark ? '#1e3a5f' : '#dbeafe') : urgency.bg,
                  borderRadius: '12px',
                  padding: '16px',
                  borderLeft: `4px solid ${isSelected ? '#3b82f6' : urgency.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                  cursor: selectionMode ? 'pointer' : 'default',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Checkbox de seleção */}
                {selectionMode && (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    border: `2px solid ${isSelected ? '#3b82f6' : colors.border}`,
                    backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isSelected && <Check size={14} color="white" />}
                  </div>
                )}

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
                  {/* Mostrar info de pagamento parcial */}
                  {bill.isPartialPayment && bill.paidAmount > 0 && (
                    <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>
                      Pago: {formatCurrency(bill.paidAmount)}
                    </p>
                  )}
                  {/* Mostrar se tem desconto aplicado */}
                  {bill.hasOverride && bill.overrideType === 'custom_amount' && bill.originalAmount !== bill.amount && (
                    <p style={{ fontSize: '11px', color: '#22c55e', marginTop: '2px', textDecoration: 'line-through' }}>
                      {formatCurrency(bill.originalAmount)}
                    </p>
                  )}
                </div>

                {/* Ações - ocultar quando em modo de seleção */}
                {!selectionMode && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!bill.isPaid && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePay(bill) }}
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
                      {/* Botão de mais opções - apenas para contas recorrentes */}
                      {bill.isFromRecurring && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openActionModal(bill) }}
                          title="Mais opções"
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
                            border: '1px solid #3b82f6',
                            cursor: 'pointer'
                          }}
                        >
                          <MoreHorizontal size={16} color="#3b82f6" />
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(bill) }}
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
                    onClick={(e) => { e.stopPropagation(); handleDelete(bill) }}
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
                )}
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

      {/* Modal de Ações da Conta */}
      {showActionModal && selectedBill && (
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
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                Opções para "{selectedBill.name}"
              </h2>
              <button onClick={() => setShowActionModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            {/* Info da conta */}
            <div style={{
              padding: '12px',
              backgroundColor: isDark ? '#1e293b' : '#f8fafc',
              borderRadius: '8px',
              marginBottom: '20px',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: colors.textSecondary, fontSize: '14px' }}>Valor original:</span>
                <span style={{ color: colors.text, fontWeight: '600', fontSize: '16px' }}>
                  {formatCurrency(selectedBill.originalAmount || selectedBill.amount)}
                </span>
              </div>
              {selectedBill.isPartialPayment && selectedBill.paidAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ color: '#f59e0b', fontSize: '14px' }}>Já pago:</span>
                  <span style={{ color: '#f59e0b', fontWeight: '600' }}>{formatCurrency(selectedBill.paidAmount)}</span>
                </div>
              )}
            </div>

            {/* Seleção de ação */}
            {!actionType && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Botão de Desfazer - aparece apenas se houver override */}
                {selectedBill.hasOverride && (
                  <button
                    onClick={() => setActionType('undo')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px',
                      borderRadius: '12px',
                      border: `2px solid #ef4444`,
                      backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: '#fecaca',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Undo2 size={20} color="#ef4444" />
                    </div>
                    <div>
                      <p style={{ fontWeight: '600', color: '#ef4444', margin: 0 }}>Desfazer alteração</p>
                      <p style={{ fontSize: '13px', color: colors.textSecondary, margin: 0 }}>
                        {selectedBill.overrideType === 'skip'
                          ? 'Restaurar conta (foi pulada)'
                          : selectedBill.overrideType === 'custom_amount'
                            ? `Restaurar valor original (${formatCurrency(selectedBill.originalAmount)})`
                            : 'Remover pagamento parcial'}
                      </p>
                    </div>
                  </button>
                )}

                {/* Pular este mês */}
                <button
                  onClick={() => setActionType('skip')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.backgroundCard,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <SkipForward size={20} color="#f59e0b" />
                  </div>
                  <div>
                    <p style={{ fontWeight: '600', color: colors.text, margin: 0 }}>Pular este mês</p>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, margin: 0 }}>
                      A conta não aparecerá em {selectedMonth}/{selectedYear}
                    </p>
                  </div>
                </button>

                {/* Pagar com desconto */}
                <button
                  onClick={() => setActionType('discount')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.backgroundCard,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Percent size={20} color="#22c55e" />
                  </div>
                  <div>
                    <p style={{ fontWeight: '600', color: colors.text, margin: 0 }}>Pagar com desconto</p>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, margin: 0 }}>
                      Aplica desconto apenas neste mês
                    </p>
                  </div>
                </button>

                {/* Pagamento parcial */}
                <button
                  onClick={() => setActionType('partial')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.backgroundCard,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: '#dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <DollarSign size={20} color="#3b82f6" />
                  </div>
                  <div>
                    <p style={{ fontWeight: '600', color: colors.text, margin: 0 }}>Pagamento parcial</p>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, margin: 0 }}>
                      Pagar apenas uma parte agora
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Formulário de Skip */}
            {actionType === 'skip' && (
              <div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <Info size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ color: '#92400e', fontSize: '14px', margin: 0 }}>
                    A conta será removida apenas de <strong>{selectedMonth}/{selectedYear}</strong>.
                    Ela continuará aparecendo normalmente nos outros meses.
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                    Motivo (opcional)
                  </label>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Ex: Férias, sem uso este mês..."
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

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setActionType(null)}
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
                    onClick={handleSkipMonth}
                    disabled={isProcessingAction}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      fontWeight: '500',
                      cursor: isProcessingAction ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isProcessingAction ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <SkipForward size={16} />}
                    Pular Mês
                  </button>
                </div>
              </div>
            )}

            {/* Formulário de Desconto */}
            {actionType === 'discount' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                    Valor do desconto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="0,00"
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
                  {discountAmount && (
                    <p style={{ fontSize: '13px', color: '#22c55e', marginTop: '8px' }}>
                      Valor final: {formatCurrency((selectedBill.originalAmount || selectedBill.amount) - parseFloat(discountAmount || 0))}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                    Motivo do desconto (opcional)
                  </label>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Ex: Desconto por pagamento antecipado..."
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

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setActionType(null)}
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
                    onClick={handlePayWithDiscount}
                    disabled={isProcessingAction || !discountAmount}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: (!discountAmount || isProcessingAction) ? '#9ca3af' : '#22c55e',
                      color: 'white',
                      fontWeight: '500',
                      cursor: (!discountAmount || isProcessingAction) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isProcessingAction ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
                    Pagar com Desconto
                  </button>
                </div>
              </div>
            )}

            {/* Formulário de Pagamento Parcial */}
            {actionType === 'partial' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                    Valor a pagar agora (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="0,00"
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
                  {partialAmount && (
                    <p style={{ fontSize: '13px', color: '#3b82f6', marginTop: '8px' }}>
                      Restante após pagamento: {formatCurrency((selectedBill.originalAmount || selectedBill.amount) - (selectedBill.paidAmount || 0) - parseFloat(partialAmount || 0))}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '6px' }}>
                    Observação (opcional)
                  </label>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Ex: Primeira parcela..."
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

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setActionType(null)}
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
                    onClick={handlePartialPayment}
                    disabled={isProcessingAction || !partialAmount}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: (!partialAmount || isProcessingAction) ? '#9ca3af' : '#3b82f6',
                      color: 'white',
                      fontWeight: '500',
                      cursor: (!partialAmount || isProcessingAction) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isProcessingAction ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <DollarSign size={16} />}
                    Registrar Pagamento
                  </button>
                </div>
              </div>
            )}

            {/* Formulário de Desfazer */}
            {actionType === 'undo' && (
              <div>
                <div style={{
                  padding: '16px',
                  backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ color: '#dc2626', fontSize: '14px', margin: 0, fontWeight: '600' }}>
                      Confirmar restauração
                    </p>
                    <p style={{ color: '#7f1d1d', fontSize: '13px', margin: '8px 0 0 0' }}>
                      {selectedBill.overrideType === 'skip'
                        ? `A conta "${selectedBill.name}" voltará a aparecer em ${selectedMonth}/${selectedYear}.`
                        : selectedBill.overrideType === 'custom_amount'
                          ? `O valor será restaurado de ${formatCurrency(selectedBill.amount)} para ${formatCurrency(selectedBill.originalAmount)}.`
                          : `O registro de pagamento parcial será removido e a conta voltará ao valor original.`}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setActionType(null)}
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
                    onClick={handleUndoOverride}
                    disabled={isProcessingAction}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isProcessingAction ? '#9ca3af' : '#ef4444',
                      color: 'white',
                      fontWeight: '500',
                      cursor: isProcessingAction ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isProcessingAction ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Undo2 size={16} />}
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Exclusão - Escolher: só este mês ou todos os meses */}
      {showDeleteModal && selectedBill && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}
        >
          <div style={{
            backgroundColor: colors.backgroundCard,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Trash2 size={20} color="#ef4444" />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: colors.text, margin: 0 }}>
                    Excluir conta
                  </h3>
                  <p style={{ fontSize: '13px', color: colors.textSecondary, margin: 0 }}>
                    {selectedBill.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            {/* Opções */}
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '14px', color: colors.text, marginBottom: '16px' }}>
                O que você deseja fazer?
              </p>

              {/* Opção 1: Excluir só deste mês */}
              <button
                onClick={handleDeleteThisMonth}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '12px',
                  border: `2px solid ${colors.primary}`,
                  backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '12px'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <SkipForward size={20} color="#3b82f6" />
                </div>
                <div>
                  <p style={{ fontWeight: '600', color: colors.primary, margin: 0, fontSize: '14px' }}>
                    Excluir apenas de {MONTH_NAMES[selectedMonth - 1]}
                  </p>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '4px 0 0 0' }}>
                    A conta continuará aparecendo nos outros meses
                  </p>
                </div>
              </button>

              {/* Opção 2: Excluir de todos */}
              <button
                onClick={handleDeleteAllMonths}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.backgroundCard,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Trash2 size={20} color="#ef4444" />
                </div>
                <div>
                  <p style={{ fontWeight: '600', color: '#ef4444', margin: 0, fontSize: '14px' }}>
                    Excluir de todos os meses
                  </p>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '4px 0 0 0' }}>
                    Remove a conta recorrente permanentemente
                  </p>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.backgroundCard,
                  color: colors.textSecondary,
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Bills
