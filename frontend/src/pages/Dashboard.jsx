import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { ThemeContext } from '../contexts/ThemeContext'
import { DashboardSkeleton, ChartSkeleton } from '../components/Skeleton'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  CreditCard,
  Calendar,
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Shield,
  Plus,
  Eye,
  X,
  ArrowLeft,
  Loader
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import OnboardingWizard from '../components/OnboardingWizard'
import { useCategories } from '../contexts/CategoriesContext'

// Cores padrão para categorias não encontradas
const DEFAULT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function Dashboard() {
  const navigate = useNavigate()
  const { colors, isDark } = useContext(ThemeContext)
  const { user } = useAuth()
  const { categoryLabels, getCategoryColor, getCategoryByValue, allCategories } = useCategories()
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [dashboardData, setDashboardData] = useState(null)
  const [transactionSummary, setTransactionSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [payingBill, setPayingBill] = useState(null)

  // Estados para drill-down de categoria
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categoryTransactions, setCategoryTransactions] = useState([])
  const [loadingCategory, setLoadingCategory] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)

  const isCurrentMonth = selectedMonth === (now.getMonth() + 1) && selectedYear === now.getFullYear()

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  const goToCurrentMonth = () => {
    setSelectedMonth(now.getMonth() + 1)
    setSelectedYear(now.getFullYear())
  }

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    setLoading(true)

    const fetchData = async () => {
      try {
        const params = `?month=${selectedMonth}&year=${selectedYear}`
        const config = { signal: abortController.signal }

        // Apenas 2 chamadas: dashboard unificado + transações do mês
        const [dashboardRes, transRes] = await Promise.all([
          api.get('/patrimony/dashboard', config),
          api.get(`/transactions/summary${params}`, config)
        ])

        if (isMounted) {
          setDashboardData(dashboardRes.data)
          setTransactionSummary(transRes.data)
          setLoading(false)
        }
      } catch (error) {
        if (error.name !== 'AbortError' && isMounted) {
          console.error('Erro ao carregar dados:', error)
          if (!error.response) {
            setTimeout(() => {
              if (isMounted) fetchData()
            }, 2000)
          } else {
            setTransactionSummary({ income: 0, expenses: 0, balance: 0, accumulatedBalance: 0 })
            setLoading(false)
          }
        }
      }
    }

    const checkOnboarding = async () => {
      const onboardingCompleted = localStorage.getItem('onboardingCompleted')
      if (onboardingCompleted) return

      try {
        const res = await api.get('/accounts', { signal: abortController.signal })
        if (isMounted && res.data.length === 0) {
          setShowOnboarding(true)
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Erro ao verificar contas:', error)
        }
      }
    }

    fetchData()
    checkOnboarding()

    const handleTransactionAdded = () => {
      if (isMounted) fetchData()
    }
    window.addEventListener('transaction-added', handleTransactionAdded)

    return () => {
      isMounted = false
      abortController.abort()
      window.removeEventListener('transaction-added', handleTransactionAdded)
    }
  }, [selectedMonth, selectedYear])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    window.location.reload()
  }

  const handlePayBill = async (bill) => {
    if (!confirm(`Confirma pagamento de ${formatCurrency(bill.amount)} para "${bill.name}"?`)) return
    if (payingBill) return

    setPayingBill(bill._id)
    try {
      const now = new Date()
      await api.post(`/bills/${bill._id}/pay`, {
        isFromRecurring: bill.isFromRecurring || false,
        month: now.getMonth() + 1,
        year: now.getFullYear()
      })
      toast.success(`${bill.name} paga com sucesso!`)
      window.location.reload()
    } catch (error) {
      console.error('Erro ao pagar conta:', error)
      toast.error(error.response?.data?.message || 'Erro ao pagar conta')
    } finally {
      setPayingBill(null)
    }
  }

  const getUrgencyStyle = (daysUntilDue) => {
    if (daysUntilDue < 0) return { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' }
    if (daysUntilDue <= 3) return { bg: '#fffbeb', border: '#f59e0b', text: '#d97706' }
    return { bg: '#f0fdf4', border: '#22c55e', text: '#16a34a' }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  // Função para abrir o drill-down de categoria
  const handleCategoryClick = async (categoryData) => {
    setSelectedCategory(categoryData)
    setShowCategoryModal(true)
    setLoadingCategory(true)

    try {
      // Buscar transações do mês filtradas por categoria
      const response = await api.get(`/transactions?month=${selectedMonth}&year=${selectedYear}&category=${categoryData.originalCategory}&type=expense&limit=100`)
      setCategoryTransactions(response.data.transactions || [])
    } catch (error) {
      console.error('Erro ao buscar transações da categoria:', error)
      setCategoryTransactions([])
    } finally {
      setLoadingCategory(false)
    }
  }

  // Fechar modal de categoria
  const closeCategoryModal = () => {
    setShowCategoryModal(false)
    setSelectedCategory(null)
    setCategoryTransactions([])
  }

  // Formatar data
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  // Função para buscar cor da categoria (case-insensitive)
  const findCategoryColor = (categoryName, index) => {
    // Tenta encontrar a categoria pelo nome (case-insensitive)
    const cat = allCategories.find(c =>
      c.name.toLowerCase() === categoryName.toLowerCase() ||
      c.value.toLowerCase() === categoryName.toLowerCase() ||
      c.label?.toLowerCase() === categoryName.toLowerCase()
    )
    if (cat?.color) return cat.color

    // Se não encontrou, usa cor padrão pelo índice
    return DEFAULT_COLORS[index % DEFAULT_COLORS.length]
  }

  const getExpenseChartData = () => {
    if (!transactionSummary?.byCategory) return []

    // Filtrar apenas despesas (excluir receitas)
    const expenseCategories = Object.entries(transactionSummary.byCategory)
      .filter(([category]) => {
        const lowerCat = category.toLowerCase()
        // Excluir categorias de receita
        return !lowerCat.includes('receita') && lowerCat !== 'salario' && lowerCat !== 'salário' && !lowerCat.includes('freelance') && !lowerCat.includes('investimento')
      })
      .slice(0, 8)

    // Calcular total para percentuais
    const total = expenseCategories.reduce((sum, [, amount]) => sum + amount, 0)

    return expenseCategories.map(([category, amount], index) => ({
      name: categoryLabels[category.toLowerCase()] || categoryLabels[category] || category,
      originalCategory: category, // Guardar categoria original para busca
      value: amount,
      color: findCategoryColor(category, index),
      percentage: total > 0 ? ((amount / total) * 100).toFixed(1) : 0
    }))
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  const { summary, health, upcomingBills, topCategories, budgets, goals, accounts } = dashboardData || {}

  return (
    <div>
      {showOnboarding && (
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          userName={user?.name || 'Usuário'}
        />
      )}

      {/* Header com navegação de mês */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: colors.text }}>Dashboard</h1>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: colors.backgroundCard,
          padding: '8px 16px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: `1px solid ${colors.border}`
        }}>
          <button
            onClick={goToPreviousMonth}
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isDark ? colors.border : '#f3f4f6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronLeft size={20} color={colors.textSecondary} />
          </button>

          <div style={{ minWidth: '140px', textAlign: 'center', padding: '0 8px' }}>
            <span style={{ fontWeight: '600', color: colors.text }}>
              {MONTH_NAMES[selectedMonth - 1]}
            </span>
            <span style={{ color: colors.textSecondary, marginLeft: '4px' }}>
              {selectedYear}
            </span>
          </div>

          <button
            onClick={goToNextMonth}
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isDark ? colors.border : '#f3f4f6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronRight size={20} color={colors.textSecondary} />
          </button>

          {!isCurrentMonth && (
            <button
              onClick={goToCurrentMonth}
              style={{
                marginLeft: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: colors.primary,
                color: 'white',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Hoje
            </button>
          )}
        </div>
      </div>

      {/* Cards de Resumo do Mês */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="text-sm text-gray-500">Receitas</p>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', color: '#16a34a' }}>
                {formatCurrency(transactionSummary?.income)}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="text-green-600" size={20} />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="text-sm text-gray-500">Despesas</p>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', color: '#dc2626' }}>
                {formatCurrency(transactionSummary?.expenses)}
              </p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <TrendingDown className="text-red-600" size={20} />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="text-sm text-gray-500">Saldo do Mês</p>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', color: (transactionSummary?.balance || 0) >= 0 ? '#2563eb' : '#dc2626' }}>
                {formatCurrency(transactionSummary?.balance)}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Wallet className="text-blue-600" size={20} />
            </div>
          </div>
        </div>

        <div className="card" style={{
          border: `2px solid ${(transactionSummary?.accumulatedBalance || 0) >= 0 ? '#22c55e' : '#ef4444'}`,
          background: (transactionSummary?.accumulatedBalance || 0) >= 0
            ? (isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4')
            : (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2')
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="text-sm" style={{ color: colors.textSecondary, fontWeight: '600' }}>
                Saldo Acumulado
              </p>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', color: (transactionSummary?.accumulatedBalance || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                {formatCurrency(transactionSummary?.accumulatedBalance)}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${(transactionSummary?.accumulatedBalance || 0) >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <PiggyBank className={(transactionSummary?.accumulatedBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'} size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Patrimônio e Saúde Financeira */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Card Patrimônio Líquido */}
        <div style={{
          background: `linear-gradient(135deg, ${isDark ? '#1e3a5f' : '#1e40af'} 0%, ${isDark ? '#0f172a' : '#3b82f6'} 100%)`,
          borderRadius: '16px',
          padding: '24px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Wallet size={20} style={{ opacity: 0.9 }} />
            <span style={{ fontSize: '14px', opacity: 0.9 }}>Patrimônio Líquido</span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>
            {formatCurrency(summary?.netWorth)}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', opacity: 0.9 }}>
            {(summary?.monthBalance || 0) >= 0 ? (
              <>
                <ArrowUpRight size={16} />
                <span>+{formatCurrency(summary?.monthBalance)} este mês</span>
              </>
            ) : (
              <>
                <ArrowDownRight size={16} />
                <span>{formatCurrency(summary?.monthBalance)} este mês</span>
              </>
            )}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div>
              <p style={{ fontSize: '11px', opacity: 0.7 }}>Contas</p>
              <p style={{ fontSize: '14px', fontWeight: '600' }}>{formatCurrency(summary?.accountsTotal)}</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', opacity: 0.7 }}>Investimentos</p>
              <p style={{ fontSize: '14px', fontWeight: '600' }}>{formatCurrency(summary?.investmentsTotal)}</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', opacity: 0.7 }}>Dívidas</p>
              <p style={{ fontSize: '14px', fontWeight: '600' }}>-{formatCurrency(summary?.debtsTotal)}</p>
            </div>
          </div>
        </div>

        {/* Card Saúde Financeira - Simplificado */}
        <div style={{
          backgroundColor: colors.backgroundCard,
          borderRadius: '16px',
          padding: '24px',
          border: `1px solid ${colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Shield size={20} color={
              health?.level === 'excellent' ? '#22c55e' :
              health?.level === 'good' ? '#3b82f6' :
              health?.level === 'warning' ? '#f59e0b' : '#ef4444'
            } />
            <span style={{ fontSize: '14px', color: colors.textSecondary }}>Saúde Financeira</span>
          </div>

          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: `conic-gradient(${
              health?.level === 'excellent' ? '#22c55e' :
              health?.level === 'good' ? '#3b82f6' :
              health?.level === 'warning' ? '#f59e0b' : '#ef4444'
            } ${(health?.score || 0) * 3.6}deg, ${isDark ? '#374151' : '#e5e7eb'} 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: colors.backgroundCard,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{
                fontSize: '28px',
                fontWeight: '700',
                color: health?.level === 'excellent' ? '#22c55e' :
                  health?.level === 'good' ? '#3b82f6' :
                  health?.level === 'warning' ? '#f59e0b' : '#ef4444'
              }}>
                {health?.score || 0}
              </span>
            </div>
          </div>

          <p style={{
            fontSize: '16px',
            fontWeight: '600',
            color: colors.text,
            marginTop: '16px'
          }}>
            {health?.level === 'excellent' ? 'Excelente!' :
             health?.level === 'good' ? 'Bom' :
             health?.level === 'warning' ? 'Atenção' : 'Crítico'}
          </p>
        </div>
      </div>

      {/* Próximas Contas */}
      {upcomingBills && upcomingBills.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontWeight: '600', color: colors.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#f59e0b" />
              Próximas Contas
            </h3>
            <button
              onClick={() => navigate('/bills')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                color: colors.primary,
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Ver todas <ChevronRight size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {upcomingBills.slice(0, 4).map((bill) => {
              const style = getUrgencyStyle(bill.daysUntilDue)
              return (
                <div
                  key={bill._id}
                  style={{
                    backgroundColor: isDark ? `${style.border}20` : style.bg,
                    borderLeft: `4px solid ${style.border}`,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div>
                    <p style={{ fontWeight: '600', color: colors.text }}>{bill.name}</p>
                    <p style={{ fontSize: '12px', color: colors.textSecondary }}>
                      Vence dia {bill.dueDay}
                      {bill.daysUntilDue === 0 && <span style={{ color: '#ef4444', fontWeight: '600' }}> - HOJE!</span>}
                      {bill.daysUntilDue < 0 && <span style={{ color: '#ef4444', fontWeight: '600' }}> - ATRASADA!</span>}
                      {bill.daysUntilDue > 0 && bill.daysUntilDue <= 3 && <span style={{ color: '#d97706', fontWeight: '500' }}> - Em {bill.daysUntilDue} dia(s)</span>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: '700', color: style.text }}>{formatCurrency(bill.amount)}</span>
                    <button
                      onClick={() => handlePayBill(bill)}
                      disabled={payingBill === bill._id}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: payingBill === bill._id ? '#86efac' : '#22c55e',
                        color: 'white',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: payingBill === bill._id ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Check size={14} />
                      Pagar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Orçamento do Mês - Simplificado */}
      {budgets && budgets.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontWeight: '600', color: colors.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="#3b82f6" />
              Orçamentos
            </h3>
            <button
              onClick={() => navigate('/budget')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                color: colors.primary,
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Gerenciar <ChevronRight size={16} />
            </button>
          </div>
          <div style={{
            backgroundColor: colors.backgroundCard,
            borderRadius: '12px',
            padding: '16px',
            border: `1px solid ${colors.border}`
          }}>
            {budgets.slice(0, 4).map(budget => (
              <div key={budget.category} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: colors.text }}>
                    {categoryLabels[budget.category] || budget.category}
                  </span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: budget.percentage >= 100 ? '#ef4444' : budget.percentage >= 80 ? '#f59e0b' : '#22c55e'
                  }}>
                    {budget.percentage}%
                  </span>
                </div>
                <div style={{ height: '6px', backgroundColor: isDark ? colors.border : '#f3f4f6', borderRadius: '3px' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(budget.percentage, 100)}%`,
                    backgroundColor: budget.percentage >= 100 ? '#ef4444' : budget.percentage >= 80 ? '#f59e0b' : '#22c55e',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico de Despesas - Com cores reais e legenda melhorada */}
      <div className="card">
        <h3 style={{ fontWeight: '600', color: colors.text, marginBottom: '16px' }}>Despesas por Categoria</h3>
        {getExpenseChartData().length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {/* Gráfico de Pizza */}
            <div style={{ flex: '0 0 200px', height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getExpenseChartData()}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {getExpenseChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: colors.backgroundCard,
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda personalizada com nomes e percentuais - CLICÁVEL */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              {getExpenseChartData().map((item, index) => (
                <div
                  key={index}
                  onClick={() => handleCategoryClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    margin: '0 -12px',
                    borderBottom: index < getExpenseChartData().length - 1 ? `1px solid ${colors.border}` : 'none',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#374151' : '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: item.color,
                      flexShrink: 0
                    }} />
                    <span style={{ fontSize: '14px', color: colors.text }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                      {formatCurrency(item.value)}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: colors.textSecondary,
                      backgroundColor: isDark ? '#374151' : '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      minWidth: '45px',
                      textAlign: 'center'
                    }}>
                      {item.percentage}%
                    </span>
                    <ChevronRight size={16} color={colors.textSecondary} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary }}>
            Sem despesas registradas este mês
          </div>
        )}
      </div>

      {/* Modal de Drill-Down por Categoria */}
      {showCategoryModal && selectedCategory && (
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
          onClick={(e) => e.target === e.currentTarget && closeCategoryModal()}
        >
          <div style={{
            backgroundColor: colors.backgroundCard,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            {/* Header do Modal */}
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={closeCategoryModal}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isDark ? '#374151' : '#f3f4f6',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <ArrowLeft size={20} color={colors.text} />
                </button>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      backgroundColor: selectedCategory.color
                    }} />
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: colors.text, margin: 0 }}>
                      {selectedCategory.name}
                    </h3>
                  </div>
                  <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                    {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </p>
                </div>
              </div>
              <button
                onClick={closeCategoryModal}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                <X size={24} color={colors.textSecondary} />
              </button>
            </div>

            {/* Resumo */}
            <div style={{
              padding: '16px 24px',
              backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <p style={{ fontSize: '13px', color: colors.textSecondary }}>Total gasto</p>
                <p style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
                  {formatCurrency(selectedCategory.value)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '13px', color: colors.textSecondary }}>
                  {categoryTransactions.length} transações
                </p>
                <p style={{ fontSize: '14px', color: colors.text }}>
                  {selectedCategory.percentage}% do total
                </p>
              </div>
            </div>

            {/* Lista de Transações */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 24px'
            }}>
              {loadingCategory ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  color: colors.textSecondary
                }}>
                  <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ marginLeft: '12px' }}>Carregando...</span>
                </div>
              ) : categoryTransactions.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: colors.textSecondary
                }}>
                  Nenhuma transação encontrada
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {categoryTransactions.map((transaction) => (
                    <div
                      key={transaction._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                        borderRadius: '10px',
                        border: `1px solid ${colors.border}`
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontWeight: '600',
                          color: colors.text,
                          marginBottom: '2px',
                          fontSize: '14px'
                        }}>
                          {transaction.description}
                        </p>
                        <p style={{
                          fontSize: '12px',
                          color: colors.textSecondary
                        }}>
                          {formatDate(transaction.date)}
                          {transaction.account && ` • ${transaction.account.name || transaction.account}`}
                        </p>
                      </div>
                      <div style={{
                        fontWeight: '700',
                        color: '#ef4444',
                        fontSize: '15px'
                      }}>
                        -{formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  closeCategoryModal()
                  navigate('/transactions')
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.backgroundCard,
                  color: colors.text,
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                Ver todas as transações
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
