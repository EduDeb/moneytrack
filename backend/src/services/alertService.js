const Notification = require('../models/Notification')
const Transaction = require('../models/Transaction')
const Account = require('../models/Account')
const Budget = require('../models/Budget')
const Bill = require('../models/Bill')
const Goal = require('../models/Goal')
const { sendBillReminder, sendBudgetAlert, sendGoalAlert } = require('./notificationService')

/**
 * Serviço de Alertas Inteligentes
 * Analisa padrões financeiros e gera alertas automáticos
 */

// Configurações padrão de alertas
const ALERT_CONFIG = {
  lowBalanceThreshold: 100, // Saldo mínimo para alerta
  unusualSpendingMultiplier: 2, // Gasto X vezes maior que média
  billDueDays: 3, // Dias antes do vencimento
  goalProgressThreshold: 80, // % para notificar proximidade de meta
  budgetWarningThreshold: 80, // % do orçamento usado
  budgetCriticalThreshold: 95, // % crítico do orçamento
  largeTransactionMultiplier: 3, // Transação X vezes maior que média
  consecutiveDaysSpending: 5, // Dias consecutivos com gastos altos
}

/**
 * Analisar e gerar todos os alertas para um usuário
 */
const analyzeAndGenerateAlerts = async (userId) => {
  try {
    const alerts = []

    // Executar todas as análises em paralelo
    const [
      balanceAlerts,
      spendingAlerts,
      billAlerts,
      budgetAlerts,
      goalAlerts,
      unusualAlerts
    ] = await Promise.all([
      checkLowBalance(userId),
      checkUnusualSpending(userId),
      checkUpcomingBills(userId),
      checkBudgetStatus(userId),
      checkGoalProgress(userId),
      detectUnusualPatterns(userId)
    ])

    alerts.push(...balanceAlerts, ...spendingAlerts, ...billAlerts,
                ...budgetAlerts, ...goalAlerts, ...unusualAlerts)

    // Criar notificações para cada alerta
    for (const alert of alerts) {
      await createAlertNotification(userId, alert)
    }

    return alerts
  } catch (error) {
    console.error('[ALERTS] Erro na análise:', error.message)
    return []
  }
}

/**
 * Verificar saldo baixo nas contas
 */
const checkLowBalance = async (userId) => {
  const alerts = []

  const accounts = await Account.find({
    user: userId,
    isActive: true,
    includeInTotal: true
  })

  for (const account of accounts) {
    if (account.balance < ALERT_CONFIG.lowBalanceThreshold) {
      alerts.push({
        type: 'LOW_BALANCE',
        priority: account.balance < 0 ? 'critical' : 'high',
        title: 'Saldo Baixo',
        message: `Sua conta "${account.name}" está com saldo de R$ ${account.balance.toFixed(2)}`,
        data: {
          accountId: account._id,
          accountName: account.name,
          balance: account.balance
        }
      })
    }
  }

  return alerts
}

/**
 * Verificar gastos incomuns comparados à média
 */
const checkUnusualSpending = async (userId) => {
  const alerts = []

  // Média dos últimos 30 dias
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const avgSpending = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        type: 'expense',
        date: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        total: { $sum: '$amount' }
      }
    },
    {
      $group: {
        _id: null,
        average: { $avg: '$total' }
      }
    }
  ])

  const dailyAverage = avgSpending[0]?.average || 0

  // Gastos de hoje
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todaySpending = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        type: 'expense',
        date: { $gte: today }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ])

  const todayTotal = todaySpending[0]?.total || 0

  if (dailyAverage > 0 && todayTotal > dailyAverage * ALERT_CONFIG.unusualSpendingMultiplier) {
    alerts.push({
      type: 'UNUSUAL_SPENDING',
      priority: 'medium',
      title: 'Gasto Acima da Média',
      message: `Você já gastou R$ ${todayTotal.toFixed(2)} hoje, ${(todayTotal / dailyAverage * 100).toFixed(0)}% acima da sua média diária`,
      data: {
        todayTotal,
        dailyAverage,
        percentage: ((todayTotal / dailyAverage) * 100).toFixed(0)
      }
    })
  }

  return alerts
}

/**
 * Verificar contas próximas do vencimento
 */
const checkUpcomingBills = async (userId) => {
  const alerts = []

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + ALERT_CONFIG.billDueDays)

  const upcomingBills = await Bill.find({
    user: userId,
    status: 'pending',
    dueDate: { $lte: dueDate }
  }).sort({ dueDate: 1 })

  for (const bill of upcomingBills) {
    const daysUntilDue = Math.ceil((bill.dueDate - new Date()) / (1000 * 60 * 60 * 24))

    alerts.push({
      type: 'BILL_DUE',
      priority: daysUntilDue <= 1 ? 'critical' : 'high',
      title: daysUntilDue <= 0 ? 'Conta Vencida!' : 'Conta a Vencer',
      message: daysUntilDue <= 0
        ? `A conta "${bill.name}" venceu! Valor: R$ ${bill.amount.toFixed(2)}`
        : `A conta "${bill.name}" vence em ${daysUntilDue} dia(s). Valor: R$ ${bill.amount.toFixed(2)}`,
      data: {
        billId: bill._id,
        billName: bill.name,
        amount: bill.amount,
        dueDate: bill.dueDate,
        daysUntilDue
      }
    })
  }

  return alerts
}

/**
 * Verificar status dos orçamentos
 */
const checkBudgetStatus = async (userId) => {
  const alerts = []

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const budgets = await Budget.find({
    user: userId,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  })

  for (const budget of budgets) {
    // Calcular gastos da categoria
    const spending = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          category: budget.category,
          date: { $gte: budget.startDate, $lte: budget.endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ])

    const spent = spending[0]?.total || 0
    const percentage = (spent / budget.amount) * 100

    if (percentage >= ALERT_CONFIG.budgetCriticalThreshold) {
      alerts.push({
        type: 'BUDGET_CRITICAL',
        priority: 'critical',
        title: 'Orçamento Crítico!',
        message: `Você usou ${percentage.toFixed(0)}% do orçamento de ${budget.category}`,
        data: {
          budgetId: budget._id,
          category: budget.category,
          budgetAmount: budget.amount,
          spent,
          percentage: percentage.toFixed(0)
        }
      })
    } else if (percentage >= ALERT_CONFIG.budgetWarningThreshold) {
      alerts.push({
        type: 'BUDGET_WARNING',
        priority: 'medium',
        title: 'Alerta de Orçamento',
        message: `Você já usou ${percentage.toFixed(0)}% do orçamento de ${budget.category}`,
        data: {
          budgetId: budget._id,
          category: budget.category,
          budgetAmount: budget.amount,
          spent,
          percentage: percentage.toFixed(0)
        }
      })
    }
  }

  return alerts
}

/**
 * Verificar progresso das metas
 */
const checkGoalProgress = async (userId) => {
  const alerts = []

  const goals = await Goal.find({
    user: userId,
    status: 'active'
  })

  for (const goal of goals) {
    const percentage = (goal.currentAmount / goal.targetAmount) * 100

    // Meta quase alcançada
    if (percentage >= ALERT_CONFIG.goalProgressThreshold && percentage < 100) {
      alerts.push({
        type: 'GOAL_NEAR_COMPLETE',
        priority: 'low',
        title: 'Meta Quase Alcançada!',
        message: `Você está a R$ ${(goal.targetAmount - goal.currentAmount).toFixed(2)} de alcançar sua meta "${goal.name}"`,
        data: {
          goalId: goal._id,
          goalName: goal.name,
          currentAmount: goal.currentAmount,
          targetAmount: goal.targetAmount,
          percentage: percentage.toFixed(0),
          remaining: goal.targetAmount - goal.currentAmount
        }
      })
    }

    // Verificar se a data limite está próxima
    if (goal.deadline) {
      const daysUntilDeadline = Math.ceil((goal.deadline - new Date()) / (1000 * 60 * 60 * 24))
      const monthlyNeeded = (goal.targetAmount - goal.currentAmount) / Math.max(daysUntilDeadline / 30, 1)

      if (daysUntilDeadline <= 30 && percentage < 90) {
        alerts.push({
          type: 'GOAL_DEADLINE_NEAR',
          priority: 'medium',
          title: 'Prazo de Meta Próximo',
          message: `Faltam ${daysUntilDeadline} dias para a meta "${goal.name}". Você precisa economizar R$ ${monthlyNeeded.toFixed(2)}/mês`,
          data: {
            goalId: goal._id,
            goalName: goal.name,
            daysUntilDeadline,
            monthlyNeeded,
            remaining: goal.targetAmount - goal.currentAmount
          }
        })
      }
    }
  }

  return alerts
}

/**
 * Detectar padrões incomuns nas transações
 */
const detectUnusualPatterns = async (userId) => {
  const alerts = []

  // Transações dos últimos 90 dias para calcular média
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const transactions = await Transaction.find({
    user: userId,
    type: 'expense',
    date: { $gte: ninetyDaysAgo }
  }).sort({ date: -1 })

  if (transactions.length < 10) return alerts // Dados insuficientes

  // Calcular média e desvio padrão
  const amounts = transactions.map(t => t.amount)
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length
  const stdDev = Math.sqrt(variance)

  // Verificar transações recentes (últimas 24h) que são outliers
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const recentTransactions = transactions.filter(t => t.date >= yesterday)

  for (const transaction of recentTransactions) {
    if (transaction.amount > mean + (stdDev * ALERT_CONFIG.largeTransactionMultiplier)) {
      alerts.push({
        type: 'LARGE_TRANSACTION',
        priority: 'medium',
        title: 'Transação Incomum Detectada',
        message: `Gasto de R$ ${transaction.amount.toFixed(2)} em "${transaction.category}" é significativamente maior que sua média`,
        data: {
          transactionId: transaction._id,
          amount: transaction.amount,
          category: transaction.category,
          averageAmount: mean.toFixed(2),
          description: transaction.description
        }
      })
    }
  }

  // Detectar aumento em categoria específica
  const categorySpending = {}
  transactions.forEach(t => {
    if (!categorySpending[t.category]) {
      categorySpending[t.category] = { recent: 0, older: 0 }
    }
    const isRecent = t.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (isRecent) {
      categorySpending[t.category].recent += t.amount
    } else {
      categorySpending[t.category].older += t.amount
    }
  })

  for (const [category, spending] of Object.entries(categorySpending)) {
    const weeklyAvg = spending.older / 12 // ~12 semanas em 90 dias
    if (weeklyAvg > 0 && spending.recent > weeklyAvg * 2) {
      alerts.push({
        type: 'CATEGORY_SPIKE',
        priority: 'low',
        title: `Aumento em ${category}`,
        message: `Seus gastos em ${category} aumentaram ${((spending.recent / weeklyAvg) * 100 - 100).toFixed(0)}% esta semana`,
        data: {
          category,
          recentSpending: spending.recent,
          averageSpending: weeklyAvg
        }
      })
    }
  }

  return alerts
}

/**
 * Criar notificação a partir de um alerta
 */
const createAlertNotification = async (userId, alert) => {
  try {
    // Verificar se já existe notificação similar não lida nas últimas 24h
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const existing = await Notification.findOne({
      user: userId,
      type: alert.type,
      isRead: false,
      createdAt: { $gte: oneDayAgo }
    })

    if (existing) return null // Evitar duplicatas

    const notification = await Notification.create({
      user: userId,
      type: alert.type,
      title: alert.title,
      message: alert.message,
      priority: alert.priority,
      data: alert.data,
      actionUrl: getActionUrl(alert)
    })

    // Enviar notificações externas baseado no tipo de alerta
    try {
      if (alert.type === 'BILL_DUE' && alert.data) {
        await sendBillReminder(userId, {
          billName: alert.data.billName,
          amount: alert.data.amount,
          dueDate: alert.data.dueDate,
          daysUntilDue: alert.data.daysUntilDue
        })
      } else if ((alert.type === 'BUDGET_WARNING' || alert.type === 'BUDGET_CRITICAL') && alert.data) {
        await sendBudgetAlert(userId, {
          category: alert.data.category,
          spent: alert.data.spent,
          budgetAmount: alert.data.budgetAmount,
          percentage: parseFloat(alert.data.percentage)
        })
      } else if ((alert.type === 'GOAL_NEAR_COMPLETE' || alert.type === 'GOAL_DEADLINE_NEAR') && alert.data) {
        await sendGoalAlert(userId, {
          goalName: alert.data.goalName,
          currentAmount: alert.data.currentAmount,
          targetAmount: alert.data.targetAmount,
          percentage: parseFloat(alert.data.percentage),
          type: alert.type === 'GOAL_NEAR_COMPLETE' ? 'near' : 'deadline'
        })
      }
    } catch (notifError) {
      console.error('[ALERTS] Erro ao enviar notificação externa:', notifError.message)
    }

    return notification
  } catch (error) {
    console.error('[ALERTS] Erro ao criar notificação:', error.message)
    return null
  }
}

/**
 * Determinar URL de ação baseada no tipo de alerta
 */
const getActionUrl = (alert) => {
  switch (alert.type) {
    case 'LOW_BALANCE':
      return `/accounts/${alert.data?.accountId}`
    case 'BILL_DUE':
      return `/bills/${alert.data?.billId}`
    case 'BUDGET_WARNING':
    case 'BUDGET_CRITICAL':
      return `/budget/${alert.data?.budgetId}`
    case 'GOAL_NEAR_COMPLETE':
    case 'GOAL_DEADLINE_NEAR':
      return `/goals/${alert.data?.goalId}`
    case 'LARGE_TRANSACTION':
      return `/transactions/${alert.data?.transactionId}`
    default:
      return null
  }
}

/**
 * Executar análise para um usuário específico (chamado por cron job ou manualmente)
 */
const runUserAnalysis = async (userId) => {
  console.log(`[ALERTS] Iniciando análise para usuário ${userId}`)
  const alerts = await analyzeAndGenerateAlerts(userId)
  console.log(`[ALERTS] ${alerts.length} alertas gerados para usuário ${userId}`)
  return alerts
}

/**
 * Calcular score de saúde financeira (0-100)
 */
const calculateFinancialHealthScore = async (userId) => {
  try {
    let score = 100
    const factors = []

    // Fator 1: Saldo total das contas (20 pontos)
    const accounts = await Account.find({ user: userId, isActive: true })
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

    if (totalBalance < 0) {
      score -= 20
      factors.push({ name: 'Saldo negativo', impact: -20 })
    } else if (totalBalance < 500) {
      score -= 10
      factors.push({ name: 'Reserva baixa', impact: -10 })
    }

    // Fator 2: Contas em atraso (25 pontos)
    const overdueBills = await Bill.countDocuments({
      user: userId,
      status: 'pending',
      dueDate: { $lt: new Date() }
    })

    if (overdueBills > 0) {
      const penalty = Math.min(overdueBills * 5, 25)
      score -= penalty
      factors.push({ name: `${overdueBills} conta(s) em atraso`, impact: -penalty })
    }

    // Fator 3: Orçamentos estourados (20 pontos)
    const now = new Date()
    const budgets = await Budget.find({
      user: userId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    })

    let budgetsExceeded = 0
    for (const budget of budgets) {
      const spending = await Transaction.aggregate([
        {
          $match: {
            user: userId,
            type: 'expense',
            category: budget.category,
            date: { $gte: budget.startDate, $lte: budget.endDate }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
      if ((spending[0]?.total || 0) > budget.amount) {
        budgetsExceeded++
      }
    }

    if (budgetsExceeded > 0) {
      const penalty = Math.min(budgetsExceeded * 5, 20)
      score -= penalty
      factors.push({ name: `${budgetsExceeded} orçamento(s) excedido(s)`, impact: -penalty })
    }

    // Fator 4: Progresso em metas (15 pontos - bônus)
    const goals = await Goal.find({ user: userId, status: 'active' })
    if (goals.length > 0) {
      const avgProgress = goals.reduce((sum, g) => sum + (g.currentAmount / g.targetAmount), 0) / goals.length
      if (avgProgress >= 0.8) {
        score = Math.min(score + 10, 100)
        factors.push({ name: 'Bom progresso em metas', impact: +10 })
      } else if (avgProgress >= 0.5) {
        score = Math.min(score + 5, 100)
        factors.push({ name: 'Progresso moderado em metas', impact: +5 })
      }
    }

    // Fator 5: Diversificação de gastos (10 pontos)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const categoryDistribution = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' }
        }
      }
    ])

    const totalExpenses = categoryDistribution.reduce((sum, c) => sum + c.total, 0)
    const maxCategoryRatio = Math.max(...categoryDistribution.map(c => c.total / totalExpenses))

    if (maxCategoryRatio > 0.5) {
      score -= 10
      factors.push({ name: 'Gastos concentrados em uma categoria', impact: -10 })
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      grade: getGrade(score),
      factors,
      recommendations: generateRecommendations(factors, score)
    }
  } catch (error) {
    console.error('[ALERTS] Erro ao calcular score:', error.message)
    return { score: 0, grade: 'N/A', factors: [], recommendations: [] }
  }
}

const getGrade = (score) => {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

const generateRecommendations = (factors, score) => {
  const recommendations = []

  for (const factor of factors) {
    if (factor.name.includes('negativo')) {
      recommendations.push('Priorize equilibrar suas contas o mais rápido possível')
    }
    if (factor.name.includes('atraso')) {
      recommendations.push('Pague as contas em atraso para evitar juros e multas')
    }
    if (factor.name.includes('excedido')) {
      recommendations.push('Revise seus orçamentos e corte gastos desnecessários')
    }
    if (factor.name.includes('concentrados')) {
      recommendations.push('Diversifique seus gastos para maior controle financeiro')
    }
    if (factor.name.includes('Reserva baixa')) {
      recommendations.push('Construa uma reserva de emergência de 3-6 meses de despesas')
    }
  }

  if (score < 60) {
    recommendations.push('Considere buscar orientação financeira profissional')
  }

  return [...new Set(recommendations)] // Remove duplicatas
}

module.exports = {
  analyzeAndGenerateAlerts,
  checkLowBalance,
  checkUnusualSpending,
  checkUpcomingBills,
  checkBudgetStatus,
  checkGoalProgress,
  detectUnusualPatterns,
  runUserAnalysis,
  calculateFinancialHealthScore,
  ALERT_CONFIG
}
