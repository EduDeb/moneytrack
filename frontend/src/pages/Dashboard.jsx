import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import { ThemeContext } from '../contexts/ThemeContext'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  CreditCard,
  AlertCircle,
  Calendar,
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Target,
  Activity,
  Shield,
  Zap,
  TrendingUp as TrendUp,
  Plus,
  Eye,
  Settings,
  ArrowRight
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import OnboardingWizard from '../components/OnboardingWizard'
import InfoTooltip from '../components/InfoTooltip'
import TipCard from '../components/TipCard'
import GuidedTour, { defaultDashboardSteps } from '../components/GuidedTour'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const categoryLabels = {
  salario: 'Salário',
  freelance: 'Freelance',
  investimentos: 'Investimentos',
  outros_receita: 'Outros',
  alimentacao: 'Alimentação',
  transporte: 'Transporte',
  moradia: 'Moradia',
  saude: 'Saúde',
  educacao: 'Educação',
  lazer: 'Lazer',
  compras: 'Compras',
  contas: 'Contas',
  outros_despesa: 'Outros'
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function Dashboard() {
  const navigate = useNavigate()
  const { colors, isDark } = useContext(ThemeContext)
  const { user } = useAuth()
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [transactionSummary, setTransactionSummary] = useState(null)
  const [investmentSummary, setInvestmentSummary] = useState(null)
  const [debtSummary, setDebtSummary] = useState(null)
  const [upcomingBills, setUpcomingBills] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [budgetStatus, setBudgetStatus] = useState(null)
  const [patrimony, setPatrimony] = useState(null)
  const [healthScore, setHealthScore] = useState(null)
  const [cashflowForecast, setCashflowForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [accountsCount, setAccountsCount] = useState(null)
  const [showTour, setShowTour] = useState(false)

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
    fetchData()
    checkOnboarding()

    // Listener para atualizar quando adicionar transação pelo botão rápido
    const handleTransactionAdded = () => fetchData()
    window.addEventListener('transaction-added', handleTransactionAdded)
    return () => window.removeEventListener('transaction-added', handleTransactionAdded)
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    const tourCompleted = localStorage.getItem('guidedTour_completed')
    const onboardingDone = localStorage.getItem('onboardingCompleted')
    if (onboardingDone && !tourCompleted) {
      setTimeout(() => setShowTour(true), 1000)
    }
  }, [])

  const checkOnboarding = async () => {
    const onboardingCompleted = localStorage.getItem('onboardingCompleted')
    if (onboardingCompleted) return

    try {
      const res = await api.get('/accounts')
      setAccountsCount(res.data.length)
      if (res.data.length === 0) {
        setShowOnboarding(true)
      }
    } catch (error) {
      console.error('Erro ao verificar contas:', error)
    }
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    fetchData()
  }

  // Mapeamento de ações para os fatores de saúde financeira
  const getFactorAction = (factorName, status) => {
    const actions = {
      'Reserva de emergência': {
        route: '/goals',
        label: 'Criar Reserva',
        icon: Plus,
        show: status !== 'excellent'
      },
      'Orçamentos': {
        route: '/budget',
        label: 'Ver Orçamentos',
        icon: Eye,
        show: status !== 'excellent'
      },
      'Endividamento': {
        route: '/debts',
        label: 'Ver Dívidas',
        icon: Eye,
        show: status === 'critical' || status === 'warning'
      },
      'Contas em dia': {
        route: '/bills',
        label: 'Ver Contas',
        icon: Eye,
        show: status !== 'excellent'
      },
      'Planejamento': {
        route: '/goals',
        label: 'Criar Meta',
        icon: Plus,
        show: status !== 'excellent'
      },
      'Diversificação': {
        route: '/investments',
        label: 'Ver Investimentos',
        icon: Eye,
        show: status !== 'excellent'
      }
    }
    return actions[factorName] || null
  }

  // Estilo do botão de ação
  const actionButtonStyle = {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s'
  }

  const fetchData = async () => {
    try {
      const params = `?month=${selectedMonth}&year=${selectedYear}`
      const [transRes, invRes, debtRes, billsRes, analyticsRes, budgetRes, patrimonyRes, healthRes, cashflowRes] = await Promise.all([
        api.get(`/transactions/summary${params}`),
        api.get('/investments/summary'),
        api.get('/debts/summary'),
        api.get('/bills/upcoming'),
        api.get(`/transactions/analytics${params}`),
        api.get(`/budget/status${params}`),
        api.get('/patrimony/summary'),
        api.get('/patrimony/health-score'),
        api.get('/patrimony/cashflow-forecast')
      ])

      setTransactionSummary(transRes.data)
      setInvestmentSummary(invRes.data)
      setDebtSummary(debtRes.data)
      setUpcomingBills(billsRes.data.bills || [])
      setAnalytics(analyticsRes.data)
      setBudgetStatus(budgetRes.data)
      setPatrimony(patrimonyRes.data)
      setHealthScore(healthRes.data)
      setCashflowForecast(cashflowRes.data)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayBill = async (bill) => {
    if (!confirm(`Confirma pagamento de ${formatCurrency(bill.amount)} para "${bill.name}"?`)) return
    try {
      await api.post(`/bills/${bill._id}/pay`, {
        isFromRecurring: bill.isFromRecurring || false
      })
      fetchData()
    } catch (error) {
      console.error('Erro ao pagar conta:', error)
    }
  }

  const getUrgencyStyle = (urgency) => {
    switch (urgency) {
      case 'overdue':
      case 'today':
        return { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' }
      case 'soon':
        return { bg: '#fffbeb', border: '#f59e0b', text: '#d97706' }
      default:
        return { bg: '#f0fdf4', border: '#22c55e', text: '#16a34a' }
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const getExpenseChartData = () => {
    if (!transactionSummary?.byCategory) return []

    return Object.entries(transactionSummary.byCategory)
      .filter(([category]) => category.includes('despesa') ||
        ['alimentacao', 'transporte', 'moradia', 'saude', 'educacao', 'lazer', 'compras', 'contas'].includes(category))
      .map(([category, amount]) => ({
        name: categoryLabels[category] || category,
        value: amount
      }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Onboarding Wizard para novos usuários */}
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

          <div style={{
            minWidth: '140px',
            textAlign: 'center',
            padding: '0 8px'
          }}>
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

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-tour="summary-cards">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Receitas (mês)</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(transactionSummary?.income)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Despesas (mês)</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(transactionSummary?.expenses)}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <TrendingDown className="text-red-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Saldo (mês)</p>
              <p className={`text-2xl font-bold ${(transactionSummary?.balance || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(transactionSummary?.balance)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Wallet className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Patrimônio</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(investmentSummary?.currentValue)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <PiggyBank className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Patrimônio e Saúde Financeira */}
      {(patrimony || healthScore) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Card Patrimônio Líquido */}
          {patrimony && (
            <div data-tour="net-worth" style={{
              background: `linear-gradient(135deg, ${isDark ? '#1e3a5f' : '#1e40af'} 0%, ${isDark ? '#0f172a' : '#3b82f6'} 100%)`,
              borderRadius: '16px',
              padding: '24px',
              color: 'white',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                right: '-20px',
                top: '-20px',
                width: '120px',
                height: '120px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '50%'
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Wallet size={20} style={{ opacity: 0.9 }} />
                  <span style={{ fontSize: '14px', opacity: 0.9 }}>Patrimônio Líquido</span>
                  <InfoTooltip term="Patrimônio Líquido" />
                </div>
                <p style={{ fontSize: '32px', fontWeight: '700', marginBottom: '4px' }}>
                  {formatCurrency(patrimony.netWorth)}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '13px',
                  opacity: 0.9
                }}>
                  {patrimony.monthBalance >= 0 ? (
                    <>
                      <ArrowUpRight size={16} />
                      <span>+{formatCurrency(patrimony.monthBalance)} este mês</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight size={16} />
                      <span>{formatCurrency(patrimony.monthBalance)} este mês</span>
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
                    <p style={{ fontSize: '14px', fontWeight: '600' }}>{formatCurrency(patrimony.accountsTotal)}</p>
                    {patrimony.accountsTotal === 0 && (
                      <button
                        onClick={() => navigate('/accounts')}
                        style={{
                          marginTop: '6px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          fontSize: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Plus size={12} /> Adicionar
                      </button>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', opacity: 0.7 }}>Investimentos</p>
                    <p style={{ fontSize: '14px', fontWeight: '600' }}>{formatCurrency(patrimony.investmentsTotal)}</p>
                    {patrimony.investmentsTotal === 0 && (
                      <button
                        onClick={() => navigate('/investments')}
                        style={{
                          marginTop: '6px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          fontSize: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Plus size={12} /> Adicionar
                      </button>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', opacity: 0.7 }}>Dívidas</p>
                    <p style={{ fontSize: '14px', fontWeight: '600' }}>-{formatCurrency(patrimony.debtsTotal)}</p>
                    {patrimony.debtsTotal > 0 && (
                      <button
                        onClick={() => navigate('/debts')}
                        style={{
                          marginTop: '6px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          fontSize: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={12} /> Gerenciar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card Saúde Financeira */}
          {healthScore && (
            <div data-tour="financial-health" style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: '16px',
              padding: '24px',
              border: `1px solid ${colors.border}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Shield size={20} color={
                  healthScore.level === 'excellent' ? '#22c55e' :
                  healthScore.level === 'good' ? '#3b82f6' :
                  healthScore.level === 'warning' ? '#f59e0b' : '#ef4444'
                } />
                <span style={{ fontSize: '14px', color: colors.textSecondary }}>Saúde Financeira</span>
                <InfoTooltip position="right">
                  Mede a qualidade das suas finanças com base em diversos fatores: reserva de emergência, nível de endividamento, orçamentos e metas. Quanto maior o score, mais saudável está sua vida financeira.
                </InfoTooltip>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: `conic-gradient(${
                    healthScore.level === 'excellent' ? '#22c55e' :
                    healthScore.level === 'good' ? '#3b82f6' :
                    healthScore.level === 'warning' ? '#f59e0b' : '#ef4444'
                  } ${healthScore.score * 3.6}deg, ${isDark ? '#374151' : '#e5e7eb'} 0deg)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: colors.backgroundCard,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: healthScore.level === 'excellent' ? '#22c55e' :
                        healthScore.level === 'good' ? '#3b82f6' :
                        healthScore.level === 'warning' ? '#f59e0b' : '#ef4444'
                    }}>
                      {healthScore.score}
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: colors.text,
                    marginBottom: '4px'
                  }}>
                    {healthScore.level === 'excellent' ? 'Excelente!' :
                     healthScore.level === 'good' ? 'Bom' :
                     healthScore.level === 'warning' ? 'Atenção' : 'Crítico'}
                  </p>
                  <p style={{ fontSize: '13px', color: colors.textSecondary, lineHeight: '1.4' }}>
                    {healthScore.message}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {healthScore.factors?.slice(0, 4).map((factor, i) => {
                  const action = getFactorAction(factor.name, factor.status)
                  const ActionIcon = action?.icon || ArrowRight
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? colors.border : '#f9fafb'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '4px'
                      }}>
                        <span style={{ fontSize: '13px', color: colors.text, fontWeight: '500' }}>{factor.name}</span>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: factor.status === 'excellent' ? (isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7') :
                            factor.status === 'good' ? (isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe') :
                            factor.status === 'warning' ? (isDark ? 'rgba(245,158,11,0.2)' : '#fef3c7') :
                            (isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2'),
                          color: factor.status === 'excellent' ? '#22c55e' :
                            factor.status === 'good' ? '#3b82f6' :
                            factor.status === 'warning' ? '#f59e0b' : '#ef4444'
                        }}>
                          {factor.detail}
                        </span>
                      </div>
                      {action && action.show && (
                        <button
                          onClick={() => navigate(action.route)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: factor.status === 'critical' ? '#ef4444' :
                              factor.status === 'warning' ? '#f59e0b' : colors.primary,
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            width: '100%'
                          }}
                        >
                          <ActionIcon size={12} />
                          {action.label}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TipCards baseados nos dados */}
      {(healthScore?.score < 60 || (patrimony && patrimony.debtsTotal > patrimony.accountsTotal)) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {healthScore && healthScore.score < 60 && (
            <TipCard
              type="warning"
              title="Sua saúde financeira precisa de atenção"
              actionLabel="Ver como melhorar"
              onAction={() => navigate('/goals')}
            >
              Seu score está em {healthScore.score}. Comece criando uma reserva de emergência.
            </TipCard>
          )}

          {patrimony && patrimony.debtsTotal > patrimony.accountsTotal && (
            <TipCard
              type="danger"
              title="Dívidas maiores que saldo"
              actionLabel="Ver dívidas"
              onAction={() => navigate('/debts')}
            >
              Suas dívidas ({formatCurrency(patrimony.debtsTotal)}) superam seu saldo em contas. Priorize quitar as de juros mais altos.
            </TipCard>
          )}
        </div>
      )}

      {/* Previsão de Fluxo de Caixa */}
      {cashflowForecast && cashflowForecast.alerts?.length > 0 && (
        <div style={{
          backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          border: '1px solid #ef4444'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
            <Zap size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '600', color: '#ef4444', marginBottom: '4px' }}>Alerta de Fluxo de Caixa</p>
              {cashflowForecast.alerts.map((alert, i) => (
                <p key={i} style={{ fontSize: '13px', color: colors.text, lineHeight: '1.4' }}>{alert.message}</p>
              ))}
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '8px',
            marginTop: '8px'
          }}>
            <button
              onClick={() => navigate('/transactions')}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#22c55e',
                color: 'white',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={14} />
              Adicionar Receita
            </button>
            <button
              onClick={() => navigate('/recurring')}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.backgroundCard,
                color: colors.text,
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Eye size={14} />
              Ver Recorrências
            </button>
            <button
              onClick={() => navigate('/bills')}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.backgroundCard,
                color: colors.text,
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Calendar size={14} />
              Ver Contas
            </button>
          </div>
        </div>
      )}

      {/* Segunda linha de cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Total Investido</p>
            <PiggyBank className="text-gray-400" size={18} />
          </div>
          <p className="text-xl font-bold">{formatCurrency(investmentSummary?.totalInvested)}</p>
          {(investmentSummary?.totalInvested || 0) > 0 ? (
            <p className={`text-sm mt-1 ${(investmentSummary?.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(investmentSummary?.profit || 0) >= 0 ? '+' : ''}{formatCurrency(investmentSummary?.profit)}
              {' '}({(investmentSummary?.profitPercentage || 0).toFixed(2)}%)
            </p>
          ) : (
            <button
              onClick={() => navigate('/investments')}
              style={{
                marginTop: '8px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#8b5cf6',
                color: 'white',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={14} />
              Começar a Investir
            </button>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Total em Dívidas</p>
            <CreditCard className="text-gray-400" size={18} />
          </div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(debtSummary?.totalDebt)}</p>
          {(debtSummary?.totalDebt || 0) > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
              <p className="text-sm text-gray-500">
                {debtSummary?.activeCount || 0} dívidas ativas
              </p>
              <button
                onClick={() => navigate('/debts')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <Eye size={10} />
                Gerenciar
              </button>
            </div>
          ) : (
            <p className="text-sm text-green-600 mt-1">
              Parabéns! Sem dívidas
            </p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Parcelas do Mês</p>
            <AlertCircle className="text-gray-400" size={18} />
          </div>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(debtSummary?.monthlyPayment)}</p>
          {(debtSummary?.monthlyPayment || 0) > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
              <p className="text-sm text-gray-500">a pagar este mês</p>
              <button
                onClick={() => navigate('/debts')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <Eye size={10} />
                Ver
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mt-1">
              Nenhuma parcela pendente
            </p>
          )}
        </div>
      </div>

      {/* Análise de Gastos */}
      {analytics && (analytics.top5Categories?.length > 0 || analytics.dailyAverage > 0) && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <BarChart3 size={18} color="#8b5cf6" />
            <h3 style={{ fontWeight: '600', color: colors.text }}>Análise de Gastos</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Card Comparativo Mensal */}
            <div style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>Gastos este mês</p>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>
                    {formatCurrency(analytics.currentMonth?.total || 0)}
                  </p>
                </div>
                {analytics.monthlyChange !== null && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: parseFloat(analytics.monthlyChange) > 0 ? (isDark ? 'rgba(239,68,68,0.2)' : '#fef2f2') : (isDark ? 'rgba(34,197,94,0.2)' : '#f0fdf4'),
                    color: parseFloat(analytics.monthlyChange) > 0 ? '#dc2626' : '#16a34a'
                  }}>
                    {parseFloat(analytics.monthlyChange) > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>
                      {Math.abs(parseFloat(analytics.monthlyChange))}%
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: `1px solid ${colors.border}` }}>
                <div>
                  <p style={{ fontSize: '11px', color: colors.textSecondary }}>Mês anterior</p>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>
                    {formatCurrency(analytics.lastMonth?.total || 0)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', color: colors.textSecondary }}>Média/dia</p>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: colors.textSecondary }}>
                    {formatCurrency(analytics.dailyAverage || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Card Top 5 Categorias */}
            <div style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: `1px solid ${colors.border}`
            }}>
              <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '12px' }}>Top 5 Gastos do Mês</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analytics.top5Categories?.map((cat, index) => {
                  const maxAmount = analytics.top5Categories[0]?.amount || 1
                  const percentage = (cat.amount / maxAmount) * 100
                  const barColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e']

                  return (
                    <div key={cat.category}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: colors.text }}>
                          {categoryLabels[cat.category] || cat.category}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>
                            {formatCurrency(cat.amount)}
                          </span>
                          {cat.change !== null && (
                            <span style={{
                              fontSize: '10px',
                              color: parseFloat(cat.change) > 0 ? '#dc2626' : '#16a34a'
                            }}>
                              {parseFloat(cat.change) > 0 ? '+' : ''}{cat.change}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{
                        height: '6px',
                        backgroundColor: isDark ? colors.border : '#f3f4f6',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${percentage}%`,
                          backgroundColor: barColors[index] || '#6b7280',
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  )
                })}
                {(!analytics.top5Categories || analytics.top5Categories.length === 0) && (
                  <p style={{ fontSize: '13px', color: colors.textSecondary, textAlign: 'center', padding: '20px 0' }}>
                    Nenhum gasto registrado
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orçamento Mensal */}
      {budgetStatus && budgetStatus.budgets?.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontWeight: '600', color: colors.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="#3b82f6" />
              Orçamento do Mês
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

          {/* Resumo geral do orçamento */}
          <div style={{
            backgroundColor: colors.backgroundCard,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                Gasto: {formatCurrency(budgetStatus.summary?.totalSpent || 0)} de {formatCurrency(budgetStatus.summary?.totalBudget || 0)}
              </span>
              <span style={{
                fontSize: '13px',
                fontWeight: '600',
                color: (budgetStatus.summary?.overallPercentage || 0) >= 100 ? '#ef4444' : (budgetStatus.summary?.overallPercentage || 0) >= 80 ? '#f59e0b' : '#22c55e'
              }}>
                {(budgetStatus.summary?.overallPercentage || 0).toFixed(0)}%
              </span>
            </div>
            <div style={{ height: '8px', backgroundColor: isDark ? colors.border : '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(budgetStatus.summary?.overallPercentage || 0, 100)}%`,
                backgroundColor: (budgetStatus.summary?.overallPercentage || 0) >= 100 ? '#ef4444' : (budgetStatus.summary?.overallPercentage || 0) >= 80 ? '#f59e0b' : '#22c55e',
                borderRadius: '4px'
              }} />
            </div>
            <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '8px', fontWeight: '500' }}>
              Você pode gastar mais {formatCurrency(budgetStatus.summary?.totalRemaining || 0)} este mês
            </p>
          </div>

          {/* Categorias em alerta (>80%) */}
          {budgetStatus.budgets.filter(b => b.percentage >= 80).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {budgetStatus.budgets.filter(b => b.percentage >= 80).slice(0, 3).map(budget => (
                <div key={budget._id} style={{
                  backgroundColor: isDark ? (budget.status === 'exceeded' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)') : (budget.status === 'exceeded' ? '#fef2f2' : '#fffbeb'),
                  borderRadius: '8px',
                  padding: '12px 16px',
                  borderLeft: `4px solid ${budget.status === 'exceeded' ? '#ef4444' : '#f59e0b'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: '500', color: colors.text, fontSize: '14px' }}>
                        {categoryLabels[budget.category] || budget.category}
                      </p>
                      <p style={{ fontSize: '12px', color: colors.textSecondary }}>
                        {formatCurrency(budget.spent)} de {formatCurrency(budget.limit)}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: budget.status === 'exceeded' ? '#ef4444' : '#f59e0b'
                    }}>
                      {budget.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Próximas Contas */}
      {upcomingBills.length > 0 && (
        <div style={{ marginBottom: '24px' }} data-tour="upcoming-bills">
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
              const style = getUrgencyStyle(bill.urgency)
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
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#22c55e',
                        color: 'white',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
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

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 style={{ fontWeight: '600', color: colors.text, marginBottom: '16px' }}>Despesas por Categoria</h3>
          {getExpenseChartData().length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={getExpenseChartData()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {getExpenseChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: colors.backgroundCard, border: `1px solid ${colors.border}`, color: colors.text }}
                />
                <Legend wrapperStyle={{ color: colors.text }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '256px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary }}>
              Sem despesas registradas
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontWeight: '600', color: colors.text, marginBottom: '16px' }}>Receitas vs Despesas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[
              {
                name: 'Este mês',
                receitas: transactionSummary?.income || 0,
                despesas: transactionSummary?.expenses || 0
              }
            ]}>
              <XAxis dataKey="name" tick={{ fill: colors.textSecondary }} />
              <YAxis tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} tick={{ fill: colors.textSecondary }} />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ backgroundColor: colors.backgroundCard, border: `1px solid ${colors.border}`, color: colors.text }}
              />
              <Legend wrapperStyle={{ color: colors.text }} />
              <Bar dataKey="receitas" fill="#22c55e" name="Receitas" />
              <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GuidedTour */}
      {showTour && (
        <GuidedTour
          steps={defaultDashboardSteps}
          onComplete={() => setShowTour(false)}
          onSkip={() => setShowTour(false)}
        />
      )}
    </div>
  )
}

export default Dashboard
