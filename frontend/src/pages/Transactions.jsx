import { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, X, Filter, TrendingUp, TrendingDown, Wallet, Search, Sparkles, CheckSquare, Square, XCircle, Check, Loader } from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'
import { useCategories } from '../contexts/CategoriesContext'
import MonthSelector from '../components/MonthSelector'
import SortToggle from '../components/SortToggle'
import { TransactionListSkeleton, CardSkeleton } from '../components/Skeleton'

// Normaliza label de categoria para value do dropdown
const normalizeCategory = (categoryLabel) => {
  if (!categoryLabel) return ''
  return categoryLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '_')      // Substitui caracteres especiais
    .replace(/_+/g, '_')             // Remove underscores duplicados
    .replace(/^_|_$/g, '')           // Remove underscores início/fim
}

function Transactions() {
  const { colors, isDark } = useContext(ThemeContext)
  const { categories, incomeCategories, expenseCategories, categoryLabels, getCategoryLabel } = useCategories()
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [filter, setFilter] = useState({ type: '', category: '', search: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' = mais recentes, 'asc' = mais antigos

  // Seleção múltipla
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState([])
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)

  // Auto-sugestão de categoria
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [autoFilled, setAutoFilled] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const debounceRef = useRef(null)
  const descriptionInputRef = useRef(null)

  // Alerta de duplicatas
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState(null)
  const [pendingTransaction, setPendingTransaction] = useState(null)

  // Função para buscar sugestão de categoria baseada na descrição
  const fetchCategorySuggestion = useCallback(async (description) => {
    if (!description || description.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setSuggestLoading(true)
    try {
      const response = await api.get(`/transactions/suggest-category?description=${encodeURIComponent(description)}`)
      const data = response.data

      if (data.category && data.confidence >= 70) {
        // Auto-preencher categoria se confiança alta
        const normalizedCategory = normalizeCategory(data.category)
        setForm(prev => ({
          ...prev,
          category: normalizedCategory,
          type: data.type || prev.type
        }))
        setAutoFilled(true)
        setSuggestions(data.suggestions || [])
      } else if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (error) {
      console.error('Erro ao buscar sugestão:', error)
    } finally {
      setSuggestLoading(false)
    }
  }, [])

  // Handler para mudança na descrição com debounce
  const handleDescriptionChange = useCallback((e) => {
    const value = e.target.value
    setForm(prev => ({ ...prev, description: value }))
    setAutoFilled(false)

    // Limpar timeout anterior
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Configurar novo debounce (300ms)
    debounceRef.current = setTimeout(() => {
      fetchCategorySuggestion(value)
    }, 300)
  }, [fetchCategorySuggestion])

  // Aplicar sugestão selecionada
  const applySuggestion = useCallback((suggestion) => {
    setForm(prev => ({
      ...prev,
      description: suggestion.description,
      category: normalizeCategory(suggestion.category),
      type: suggestion.type || prev.type
    }))
    setAutoFilled(true)
    setShowSuggestions(false)
    setSuggestions([])
  }, [])

  // Pegar primeira categoria disponível
  const getDefaultCategory = (type) => {
    const cats = type === 'income' ? incomeCategories : expenseCategories
    return cats[0]?.value || (type === 'income' ? 'salario' : 'alimentacao')
  }

  const [form, setForm] = useState({
    type: 'expense',
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  })

  // Atualizar categoria padrão quando categorias carregarem
  useEffect(() => {
    if (expenseCategories.length > 0 && !form.category) {
      setForm(prev => ({ ...prev, category: getDefaultCategory('expense') }))
    }
  }, [expenseCategories])

  useEffect(() => {
    fetchTransactions()
    fetchSummary()
  }, [selectedMonth, selectedYear, filter.type, filter.category])

  const handleMonthChange = (month, year) => {
    setSelectedMonth(month)
    setSelectedYear(year)
  }

  const fetchSummary = async () => {
    try {
      const response = await api.get(`/transactions/summary?month=${selectedMonth}&year=${selectedYear}`)
      setSummary(response.data)
    } catch (error) {
      console.error('Erro ao buscar resumo:', error)
    }
  }

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams()
      params.append('month', selectedMonth)
      params.append('year', selectedYear)
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
    if (submitting) return

    // Value overflow protection
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Por favor, insira um valor válido maior que zero.')
      return
    }
    if (amount > 999999999.99) {
      toast.error('O valor máximo permitido é R$ 999.999.999,99')
      return
    }

    // Description length limit
    if (form.description && form.description.length > 200) {
      toast.error('A descrição deve ter no máximo 200 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const dataToSend = {
        ...form,
        amount: parseFloat(form.amount)
      }
      if (editingTransaction) {
        await api.put(`/transactions/${editingTransaction._id}`, dataToSend)
        toast.success('Transação atualizada com sucesso!')
      } else {
        try {
          await api.post('/transactions', dataToSend)
          toast.success('Transação criada com sucesso!')
        } catch (error) {
          // Verificar se é erro de duplicata (409)
          if (error.response?.status === 409 && error.response?.data?.isDuplicate) {
            setDuplicateInfo(error.response.data.existingTransaction)
            setPendingTransaction(dataToSend)
            setShowDuplicateModal(true)
            setSubmitting(false)
            return
          }
          throw error
        }
      }

      setShowModal(false)
      setEditingTransaction(null)
      resetForm()
      // Atualizar tanto transações quanto resumo imediatamente
      await Promise.all([fetchTransactions(), fetchSummary()])
    } catch (error) {
      console.error('Erro ao salvar transação:', error)
      toast.error('Erro ao salvar transação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // Forçar criação de transação (ignorar alerta de duplicata)
  const handleForceCreate = async () => {
    if (!pendingTransaction) return
    setSubmitting(true)
    try {
      await api.post('/transactions', { ...pendingTransaction, force: true })
      toast.success('Transação criada com sucesso!')
      setShowDuplicateModal(false)
      setDuplicateInfo(null)
      setPendingTransaction(null)
      setShowModal(false)
      setEditingTransaction(null)
      resetForm()
      await Promise.all([fetchTransactions(), fetchSummary()])
    } catch (error) {
      console.error('Erro ao criar transação:', error)
      toast.error('Erro ao criar transação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const closeDuplicateModal = () => {
    setShowDuplicateModal(false)
    setDuplicateInfo(null)
    setPendingTransaction(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return
    if (deleting) return

    setDeleting(id)
    try {
      await api.delete(`/transactions/${id}`)
      toast.success('Transação excluída com sucesso!')
      // Atualizar tanto transações quanto resumo imediatamente
      await Promise.all([fetchTransactions(), fetchSummary()])
    } catch (error) {
      console.error('Erro ao excluir transação:', error)
      toast.error('Erro ao excluir transação. Tente novamente.')
    } finally {
      setDeleting(null)
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
    // Limpar estados de sugestão ao editar
    setAutoFilled(false)
    setSuggestions([])
    setShowSuggestions(false)
    setShowModal(true)
  }

  const resetForm = () => {
    setForm({
      type: 'expense',
      category: getDefaultCategory('expense'),
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0]
    })
    // Limpar estados de sugestão
    setAutoFilled(false)
    setSuggestions([])
    setShowSuggestions(false)
    setSuggestLoading(false)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
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

  // Filtrar e ordenar transações
  const filteredTransactions = useMemo(() => {
    let result = transactions.filter(t => {
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        return t.description?.toLowerCase().includes(searchLower) ||
               getCategoryLabel(t.category)?.toLowerCase().includes(searchLower)
      }
      return true
    })

    // Ordenar por data
    result.sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    })

    return result
  }, [transactions, filter.search, sortOrder])

  // Funções de seleção múltipla
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    setSelectedItems([])
  }

  const toggleItemSelection = (id) => {
    setSelectedItems(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const selectAllItems = () => {
    if (selectedItems.length === filteredTransactions.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredTransactions.map(t => t._id))
    }
  }

  // Excluir todas selecionadas
  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0) return

    if (!confirm(`Tem certeza que deseja excluir ${selectedItems.length} transação(ões)?`)) return

    setIsProcessingBatch(true)
    let successCount = 0
    let errorCount = 0

    for (const id of selectedItems) {
      try {
        await api.delete(`/transactions/${id}`)
        successCount++
      } catch (error) {
        console.error(`Erro ao excluir transação:`, error)
        errorCount++
      }
    }

    setIsProcessingBatch(false)
    setSelectedItems([])
    setSelectionMode(false)
    // Atualizar tanto transações quanto resumo imediatamente
    await Promise.all([fetchTransactions(), fetchSummary()])

    if (errorCount > 0) {
      toast.error(`${successCount} excluída(s), ${errorCount} erro(s)`)
    } else {
      toast.success(`${successCount} transação(ões) excluída(s)!`)
    }
  }

  return (
    <div>
      {/* CSS para animação de loading */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header com título e seletor de mês */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>Transações</h1>
        <MonthSelector
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onChange={handleMonthChange}
        />
      </div>

      {/* Cards de Resumo */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {/* Receitas do Mês */}
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} color="#22c55e" />
              </div>
              <span style={{ fontSize: '13px', color: colors.textSecondary }}>Receitas do Mês</span>
            </div>
            <p style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>{formatCurrency(summary.income)}</p>
          </div>

          {/* Despesas do Mês */}
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingDown size={20} color="#ef4444" />
              </div>
              <span style={{ fontSize: '13px', color: colors.textSecondary }}>Despesas do Mês</span>
            </div>
            <p style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(summary.expenses)}</p>
          </div>

          {/* Saldo do Mês */}
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={20} color="#3b82f6" />
              </div>
              <span style={{ fontSize: '13px', color: colors.textSecondary }}>Saldo do Mês</span>
            </div>
            <p style={{ fontSize: '24px', fontWeight: '700', color: summary.balance >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(summary.balance)}</p>
          </div>

          {/* Saldo Acumulado (Conta Corrente) */}
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `2px solid ${summary.accumulatedBalance >= 0 ? '#22c55e' : '#ef4444'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: summary.accumulatedBalance >= 0 ? '#dcfce7' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={20} color={summary.accumulatedBalance >= 0 ? '#22c55e' : '#ef4444'} />
              </div>
              <span style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: '600' }}>Saldo Acumulado</span>
            </div>
            <p style={{ fontSize: '24px', fontWeight: '700', color: summary.accumulatedBalance >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(summary.accumulatedBalance)}</p>
            {summary.previousBalance !== 0 && (
              <p style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }}>
                Saldo anterior: {formatCurrency(summary.previousBalance)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Barra de ações e filtros */}
      <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px', marginBottom: '24px', border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            {/* Campo de Busca */}
            <div style={{ position: 'relative' }}>
              <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Buscar..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                style={{
                  padding: '8px 12px 8px 36px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                  backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '14px', width: '180px'
                }}
              />
            </div>

            {/* Filtro por Tipo */}
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

            {/* Filtro por Categoria */}
            <select
              value={filter.category}
              onChange={(e) => setFilter({ ...filter, category: e.target.value })}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '14px'
              }}
            >
              <option value="">Todas categorias</option>
              <optgroup label="Receitas">
                {incomeCategories.map(c => <option key={c.value} value={c.value}>{c.label || c.name}</option>)}
              </optgroup>
              <optgroup label="Despesas">
                {expenseCategories.map(c => <option key={c.value} value={c.value}>{c.label || c.name}</option>)}
              </optgroup>
            </select>

            {/* Limpar Filtros */}
            {(filter.type || filter.category || filter.search) && (
              <button
                onClick={() => setFilter({ type: '', category: '', search: '' })}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
                  backgroundColor: 'transparent', color: colors.textSecondary, fontSize: '13px', cursor: 'pointer'
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Botão de seleção múltipla */}
          <button
            onClick={toggleSelectionMode}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
              borderRadius: '8px',
              border: `1px solid ${selectionMode ? '#3b82f6' : colors.border}`,
              backgroundColor: selectionMode ? '#3b82f6' : 'transparent',
              color: selectionMode ? 'white' : colors.textSecondary,
              fontWeight: '500', cursor: 'pointer', fontSize: '13px'
            }}
          >
            {selectionMode ? <XCircle size={16} /> : <CheckSquare size={16} />}
            {selectionMode ? 'Cancelar' : 'Selecionar'}
          </button>

          {/* Botão Nova Transação */}
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
      </div>

      {/* Barra de ações de seleção múltipla */}
      {selectionMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
          padding: '12px 16px', backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
          borderRadius: '12px', border: '1px solid #3b82f6', flexWrap: 'wrap'
        }}>
          <button
            onClick={selectAllItems}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
              borderRadius: '6px', border: `1px solid ${colors.border}`,
              backgroundColor: colors.backgroundCard, color: colors.text,
              fontWeight: '500', cursor: 'pointer', fontSize: '13px'
            }}
          >
            {selectedItems.length === filteredTransactions.length ? <Square size={16} /> : <CheckSquare size={16} />}
            {selectedItems.length === filteredTransactions.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
          </button>

          <span style={{ color: colors.text, fontSize: '13px', fontWeight: '500' }}>
            {selectedItems.length} selecionada(s)
          </span>

          <div style={{ flex: 1 }} />

          <button
            onClick={handleDeleteSelected}
            disabled={selectedItems.length === 0 || isProcessingBatch}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
              borderRadius: '8px', border: 'none',
              backgroundColor: selectedItems.length === 0 ? '#9ca3af' : '#ef4444',
              color: 'white', fontWeight: '500',
              cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px'
            }}
          >
            {isProcessingBatch ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
            Excluir Selecionadas
          </button>
        </div>
      )}

      {/* Contador e Ordenação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
          {filteredTransactions.length} transação(ões) encontrada(s)
        </span>
        <SortToggle
          sortOrder={sortOrder}
          onToggle={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
          label="Data"
        />
      </div>

      {/* Lista de Transações */}
      {loading ? (
        <TransactionListSkeleton count={8} />
      ) : filteredTransactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: colors.textSecondary, backgroundColor: colors.backgroundCard, borderRadius: '12px' }}>
          <Wallet size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>Nenhuma transação encontrada para este período.</p>
          <button
            onClick={() => { resetForm(); setEditingTransaction(null); setShowModal(true) }}
            style={{
              marginTop: '16px', padding: '10px 20px', backgroundColor: '#3b82f6',
              color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'
            }}
          >
            Adicionar Transação
          </button>
        </div>
      ) : (
        <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${colors.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: isDark ? colors.border : '#f8fafc' }}>
                {selectionMode && (
                  <th style={{ padding: '12px 8px', textAlign: 'center', width: '40px' }}>
                    <div
                      onClick={selectAllItems}
                      style={{
                        width: '20px', height: '20px', borderRadius: '4px', cursor: 'pointer',
                        border: `2px solid ${selectedItems.length === filteredTransactions.length ? '#3b82f6' : colors.border}`,
                        backgroundColor: selectedItems.length === filteredTransactions.length ? '#3b82f6' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto'
                      }}
                    >
                      {selectedItems.length === filteredTransactions.length && <Check size={12} color="white" />}
                    </div>
                  </th>
                )}
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>Data</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>Descrição</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>Categoria</th>
                <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>Valor</th>
                {!selectionMode && <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(t => {
                const isSelected = selectedItems.includes(t._id)
                return (
                <tr
                  key={t._id}
                  onClick={selectionMode ? () => toggleItemSelection(t._id) : undefined}
                  style={{
                    borderTop: `1px solid ${colors.border}`,
                    backgroundColor: isSelected ? (isDark ? '#1e3a5f' : '#dbeafe') : 'transparent',
                    cursor: selectionMode ? 'pointer' : 'default',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {selectionMode && (
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '4px',
                        border: `2px solid ${isSelected ? '#3b82f6' : colors.border}`,
                        backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto'
                      }}>
                        {isSelected && <Check size={12} color="white" />}
                      </div>
                    </td>
                  )}
                  <td style={{ padding: '12px 16px', color: colors.text, fontSize: '14px' }}>{formatDate(t.date)}</td>
                  <td style={{ padding: '12px 8px', color: colors.text, fontSize: '14px' }}>{t.description || '-'}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
                      backgroundColor: t.type === 'income' ? '#dcfce7' : '#fef2f2',
                      color: t.type === 'income' ? '#166534' : '#991b1b'
                    }}>
                      {getCategoryLabel(t.category)}
                    </span>
                  </td>
                  <td style={{
                    padding: '12px 8px', textAlign: 'right', fontWeight: '600', fontSize: '14px',
                    color: t.type === 'income' ? '#22c55e' : '#ef4444'
                  }}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </td>
                  {!selectionMode && (
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(t) }}
                      disabled={deleting === t._id}
                      aria-label={`Editar transação: ${t.description}`}
                      title="Editar transação"
                      style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, opacity: deleting === t._id ? 0.5 : 1 }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(t._id) }}
                      disabled={deleting === t._id}
                      aria-label={`Excluir transação: ${t.description}`}
                      title="Excluir transação"
                      style={{ padding: '4px', background: 'none', border: 'none', cursor: deleting === t._id ? 'not-allowed' : 'pointer', color: deleting === t._id ? '#ef4444' : colors.textSecondary, marginLeft: '8px' }}
                    >
                      {deleting === t._id ? (
                        <span className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid #ef4444', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }}></span>
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </td>
                  )}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

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
                    onClick={() => setForm({ ...form, type: 'expense', category: getDefaultCategory('expense') })}
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
                    onClick={() => setForm({ ...form, type: 'income', category: getDefaultCategory('income') })}
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
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>
                  Categoria
                  {autoFilled && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#22c55e', fontWeight: '400' }}>
                      (preenchida automaticamente)
                    </span>
                  )}
                </label>
                <select
                  value={form.category}
                  onChange={(e) => { setForm({ ...form, category: e.target.value }); setAutoFilled(false); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: `1px solid ${autoFilled ? '#22c55e' : colors.border}`,
                    backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '14px',
                    transition: 'border-color 0.2s'
                  }}
                >
                  {(form.type === 'income' ? incomeCategories : expenseCategories).map(c => (
                    <option key={c.value} value={c.value}>{c.label || c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Descrição</label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={descriptionInputRef}
                    type="text"
                    value={form.description}
                    onChange={handleDescriptionChange}
                    placeholder="Ex: Almoço no restaurante"
                    required
                    maxLength={200}
                    autoComplete="off"
                    style={{
                      width: '100%', padding: '10px 12px', paddingRight: suggestLoading || autoFilled ? '40px' : '12px',
                      borderRadius: '8px', border: `1px solid ${autoFilled ? '#22c55e' : colors.border}`,
                      backgroundColor: colors.backgroundCard, color: colors.text, fontSize: '14px', boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                  />
                  {suggestLoading && (
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                      <span style={{ width: '16px', height: '16px', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
                    </div>
                  )}
                  {autoFilled && !suggestLoading && (
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#22c55e' }} title="Categoria preenchida automaticamente">
                      <Sparkles size={18} />
                    </div>
                  )}
                </div>
                {/* Dropdown de sugestões */}
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                    backgroundColor: colors.backgroundCard, border: `1px solid ${colors.border}`,
                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10,
                    maxHeight: '200px', overflowY: 'auto'
                  }}>
                    {suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => applySuggestion(s)}
                        style={{
                          padding: '10px 12px', cursor: 'pointer',
                          borderBottom: idx < suggestions.length - 1 ? `1px solid ${colors.border}` : 'none',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ fontSize: '14px', color: colors.text, fontWeight: '500' }}>{s.description}</div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                          {getCategoryLabel(s.category)} • {s.count}x usado
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: colors.text }}>Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="999999999.99"
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
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard,
                    color: colors.textSecondary, fontWeight: '500', cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px',
                    border: 'none', backgroundColor: submitting ? '#93c5fd' : '#3b82f6',
                    color: 'white', fontWeight: '500', cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }}></span>
                      Salvando...
                    </>
                  ) : (
                    editingTransaction ? 'Salvar' : 'Adicionar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Alerta de Duplicata */}
      {showDuplicateModal && duplicateInfo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '20px'
        }}>
          <div style={{
            backgroundColor: colors.backgroundCard, borderRadius: '16px',
            width: '100%', maxWidth: '420px', overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px', borderBottom: `1px solid ${colors.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, color: colors.text, fontSize: '18px', fontWeight: '600' }}>
                Transação Duplicada?
              </h3>
              <button onClick={closeDuplicateModal} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px'
              }}>
                <X size={20} style={{ color: colors.textSecondary }} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ color: colors.text, marginBottom: '16px', fontSize: '14px' }}>
                Já existe uma transação similar para esta data:
              </p>
              <div style={{
                backgroundColor: isDark ? colors.border : '#f8fafc',
                padding: '16px', borderRadius: '8px',
                border: `1px solid ${colors.border}`, marginBottom: '16px'
              }}>
                <p style={{ fontWeight: '600', color: colors.text, marginBottom: '4px' }}>
                  {duplicateInfo.description}
                </p>
                <p style={{ color: duplicateInfo.type === 'expense' ? '#ef4444' : '#22c55e', fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
                  {duplicateInfo.type === 'expense' ? '-' : '+'} R$ {duplicateInfo.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p style={{ color: colors.textSecondary, fontSize: '13px' }}>
                  {new Date(duplicateInfo.date).toLocaleDateString('pt-BR')} • {getCategoryLabel(duplicateInfo.category)}
                </p>
              </div>
              <p style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: '20px' }}>
                Deseja criar a transação mesmo assim?
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={closeDuplicateModal}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: 'transparent',
                    color: colors.text, fontWeight: '500', cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleForceCreate}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px',
                    border: 'none', backgroundColor: submitting ? '#fca5a5' : '#ef4444',
                    color: 'white', fontWeight: '500', cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Criando...' : 'Criar Mesmo Assim'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transactions
