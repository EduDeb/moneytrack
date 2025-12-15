const Transaction = require('../models/Transaction')
const Recurring = require('../models/Recurring')
const Bill = require('../models/Bill')
const Account = require('../models/Account')
const Goal = require('../models/Goal')

/**
 * Serviço de Projeções Financeiras
 * Previsões baseadas em dados históricos e compromissos futuros
 */

/**
 * Projetar saldo futuro
 * @param {ObjectId} userId
 * @param {number} months - Quantidade de meses para projetar
 */
const projectBalance = async (userId, months = 6) => {
  try {
    // Saldo atual
    const accounts = await Account.find({ user: userId, isActive: true })
    let currentBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

    // Médias históricas (últimos 3 meses)
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const historicalData = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: threeMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            month: { $month: '$date' }
          },
          total: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          monthlyAvg: { $avg: '$total' }
        }
      }
    ])

    const avgIncome = historicalData.find(d => d._id === 'income')?.monthlyAvg || 0
    const avgExpense = historicalData.find(d => d._id === 'expense')?.monthlyAvg || 0
    const avgNetFlow = avgIncome - avgExpense

    // Compromissos futuros fixos
    const recurringItems = await Recurring.find({
      user: userId,
      isActive: true,
      $or: [{ endDate: null }, { endDate: { $gt: new Date() } }]
    })

    const fixedIncome = recurringItems
      .filter(r => r.type === 'income')
      .reduce((sum, r) => sum + getMonthlyValue(r), 0)

    const fixedExpense = recurringItems
      .filter(r => r.type === 'expense')
      .reduce((sum, r) => sum + getMonthlyValue(r), 0)

    // Contas a pagar
    const bills = await Bill.find({
      user: userId,
      status: 'pending'
    })

    // Projeção mês a mês
    const projections = []
    let projectedBalance = currentBalance

    for (let i = 1; i <= months; i++) {
      const projectionDate = new Date()
      projectionDate.setMonth(projectionDate.getMonth() + i)
      const monthStart = new Date(projectionDate.getFullYear(), projectionDate.getMonth(), 1)
      const monthEnd = new Date(projectionDate.getFullYear(), projectionDate.getMonth() + 1, 0)

      // Contas do mês
      const monthBills = bills.filter(b => {
        const dueDate = new Date(b.dueDate)
        return dueDate >= monthStart && dueDate <= monthEnd
      })
      const billsTotal = monthBills.reduce((sum, b) => sum + b.amount, 0)

      // Cálculo do mês
      const estimatedIncome = fixedIncome + (avgIncome - fixedIncome) * 0.8 // 80% da variável
      const estimatedExpense = fixedExpense + billsTotal + (avgExpense - fixedExpense - billsTotal) * 0.8

      projectedBalance += estimatedIncome - estimatedExpense

      projections.push({
        month: projectionDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        date: monthStart,
        startBalance: projectedBalance - (estimatedIncome - estimatedExpense),
        estimatedIncome,
        estimatedExpense,
        netFlow: estimatedIncome - estimatedExpense,
        endBalance: projectedBalance,
        fixedIncome,
        fixedExpense,
        variableIncome: estimatedIncome - fixedIncome,
        variableExpense: estimatedExpense - fixedExpense - billsTotal,
        billsDue: monthBills.length,
        billsTotal,
        confidence: calculateConfidence(i)
      })
    }

    // Análise de tendência
    const trend = avgNetFlow > 0 ? 'positive' : avgNetFlow < 0 ? 'negative' : 'stable'
    const monthsToGoal = avgNetFlow > 0 ? null : Math.abs(currentBalance / avgNetFlow)

    return {
      currentBalance,
      averages: {
        income: avgIncome,
        expense: avgExpense,
        netFlow: avgNetFlow
      },
      fixed: {
        income: fixedIncome,
        expense: fixedExpense
      },
      projections,
      analysis: {
        trend,
        trendDescription: getTrendDescription(trend, avgNetFlow),
        monthsToNegative: trend === 'negative' ? monthsToGoal : null,
        savingsRate: avgIncome > 0 ? ((avgNetFlow / avgIncome) * 100).toFixed(1) : 0,
        recommendation: getBalanceRecommendation(trend, avgNetFlow, currentBalance)
      }
    }
  } catch (error) {
    console.error('[PROJECTION] Erro ao projetar saldo:', error.message)
    throw error
  }
}

/**
 * Projetar alcance de meta
 */
const projectGoal = async (userId, goalId) => {
  try {
    const goal = await Goal.findOne({ _id: goalId, user: userId })
    if (!goal) throw new Error('Meta não encontrada')

    const remaining = goal.targetAmount - goal.currentAmount
    const currentProgress = (goal.currentAmount / goal.targetAmount) * 100

    // Histórico de contribuições à meta
    const contributions = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          'tags': 'meta',
          category: goal.category || { $exists: true }
        }
      },
      {
        $group: {
          _id: { month: { $month: '$date' }, year: { $year: '$date' } },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ])

    const avgMonthlyContribution = contributions.length > 0
      ? contributions.reduce((sum, c) => sum + c.total, 0) / contributions.length
      : 0

    // Calcular projeção
    let monthsToGoal = null
    let projectedDate = null
    let onTrack = false

    if (avgMonthlyContribution > 0) {
      monthsToGoal = Math.ceil(remaining / avgMonthlyContribution)
      projectedDate = new Date()
      projectedDate.setMonth(projectedDate.getMonth() + monthsToGoal)

      if (goal.deadline) {
        onTrack = projectedDate <= goal.deadline
      }
    }

    // Calcular contribuição necessária para atingir no prazo
    let requiredMonthlyContribution = null
    if (goal.deadline) {
      const monthsUntilDeadline = Math.max(1,
        (goal.deadline.getFullYear() - new Date().getFullYear()) * 12 +
        (goal.deadline.getMonth() - new Date().getMonth())
      )
      requiredMonthlyContribution = remaining / monthsUntilDeadline
    }

    // Cenários
    const scenarios = [
      {
        name: 'Conservador',
        monthlyContribution: avgMonthlyContribution * 0.8,
        monthsToGoal: avgMonthlyContribution > 0 ? Math.ceil(remaining / (avgMonthlyContribution * 0.8)) : null
      },
      {
        name: 'Atual',
        monthlyContribution: avgMonthlyContribution,
        monthsToGoal
      },
      {
        name: 'Agressivo',
        monthlyContribution: avgMonthlyContribution * 1.5,
        monthsToGoal: avgMonthlyContribution > 0 ? Math.ceil(remaining / (avgMonthlyContribution * 1.5)) : null
      }
    ]

    if (requiredMonthlyContribution) {
      scenarios.push({
        name: 'No Prazo',
        monthlyContribution: requiredMonthlyContribution,
        monthsToGoal: Math.ceil(remaining / requiredMonthlyContribution)
      })
    }

    return {
      goal: {
        id: goal._id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        deadline: goal.deadline
      },
      progress: {
        percentage: currentProgress.toFixed(1),
        remaining,
        achieved: goal.currentAmount
      },
      projection: {
        avgMonthlyContribution,
        monthsToGoal,
        projectedDate,
        onTrack,
        requiredMonthlyContribution,
        monthlyGap: requiredMonthlyContribution ? requiredMonthlyContribution - avgMonthlyContribution : null
      },
      scenarios,
      recommendations: generateGoalRecommendations(
        onTrack,
        avgMonthlyContribution,
        requiredMonthlyContribution,
        remaining
      )
    }
  } catch (error) {
    console.error('[PROJECTION] Erro ao projetar meta:', error.message)
    throw error
  }
}

/**
 * Projetar gastos por categoria
 */
const projectCategorySpending = async (userId, months = 3) => {
  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    // Histórico por categoria
    const categoryHistory = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            category: '$category',
            month: { $dateToString: { format: '%Y-%m', date: '$date' } }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.category',
          monthlyData: {
            $push: {
              month: '$_id.month',
              total: '$total',
              count: '$count'
            }
          },
          avgMonthly: { $avg: '$total' },
          totalSpent: { $sum: '$total' }
        }
      },
      { $sort: { avgMonthly: -1 } }
    ])

    // Calcular tendência para cada categoria
    const projections = categoryHistory.map(cat => {
      const monthlyValues = cat.monthlyData.map(m => m.total).slice(-6)
      const trend = calculateTrend(monthlyValues)

      // Projetar próximos meses
      const futureProjections = []
      let lastValue = monthlyValues[monthlyValues.length - 1] || cat.avgMonthly

      for (let i = 1; i <= months; i++) {
        const projectedValue = lastValue * (1 + trend.rate)
        const date = new Date()
        date.setMonth(date.getMonth() + i)

        futureProjections.push({
          month: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
          projected: projectedValue,
          confidence: calculateConfidence(i)
        })

        lastValue = projectedValue
      }

      return {
        category: cat._id,
        historical: {
          avgMonthly: cat.avgMonthly,
          totalSpent: cat.totalSpent,
          monthsOfData: cat.monthlyData.length
        },
        trend: {
          direction: trend.direction,
          rate: (trend.rate * 100).toFixed(1),
          description: `${trend.direction === 'up' ? 'Aumentando' : trend.direction === 'down' ? 'Diminuindo' : 'Estável'} ${Math.abs(trend.rate * 100).toFixed(1)}% ao mês`
        },
        projections: futureProjections
      }
    })

    // Total projetado
    const totalProjected = projections.reduce((sum, p) => {
      return sum + p.projections.reduce((s, proj) => s + proj.projected, 0)
    }, 0)

    return {
      categories: projections,
      summary: {
        totalCategories: projections.length,
        totalProjectedExpense: totalProjected / months, // Média mensal
        topCategories: projections.slice(0, 5).map(p => ({
          category: p.category,
          avgMonthly: p.historical.avgMonthly
        })),
        growingCategories: projections
          .filter(p => p.trend.direction === 'up')
          .slice(0, 3)
          .map(p => p.category),
        decliningCategories: projections
          .filter(p => p.trend.direction === 'down')
          .slice(0, 3)
          .map(p => p.category)
      }
    }
  } catch (error) {
    console.error('[PROJECTION] Erro ao projetar categorias:', error.message)
    throw error
  }
}

/**
 * Análise de fluxo de caixa projetado
 */
const projectCashFlow = async (userId, weeks = 4) => {
  try {
    const cashFlow = []
    const accounts = await Account.find({ user: userId, isActive: true })
    let currentBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

    // Compromissos fixos
    const recurring = await Recurring.find({
      user: userId,
      isActive: true
    })

    const bills = await Bill.find({
      user: userId,
      status: 'pending',
      dueDate: { $gte: new Date() }
    }).sort({ dueDate: 1 })

    // Média diária histórica
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyAverages = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$type',
          dailyAvg: { $avg: '$amount' }
        }
      }
    ])

    const avgDailyExpense = dailyAverages.find(d => d._id === 'expense')?.dailyAvg || 0

    // Projetar semana a semana
    for (let week = 1; week <= weeks; week++) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() + (week - 1) * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      // Contas da semana
      const weekBills = bills.filter(b => {
        const due = new Date(b.dueDate)
        return due >= weekStart && due <= weekEnd
      })
      const billsAmount = weekBills.reduce((sum, b) => sum + b.amount, 0)

      // Recorrentes da semana
      const weekRecurringExpense = calculateWeeklyRecurring(recurring, weekStart, weekEnd, 'expense')
      const weekRecurringIncome = calculateWeeklyRecurring(recurring, weekStart, weekEnd, 'income')

      // Variável estimado
      const variableExpense = avgDailyExpense * 7 * 0.6 // 60% do histórico para ser conservador

      const totalInflow = weekRecurringIncome
      const totalOutflow = billsAmount + weekRecurringExpense + variableExpense

      currentBalance += totalInflow - totalOutflow

      cashFlow.push({
        week,
        period: `${weekStart.toLocaleDateString('pt-BR')} - ${weekEnd.toLocaleDateString('pt-BR')}`,
        startDate: weekStart,
        endDate: weekEnd,
        inflow: {
          total: totalInflow,
          recurring: weekRecurringIncome
        },
        outflow: {
          total: totalOutflow,
          bills: billsAmount,
          recurring: weekRecurringExpense,
          variable: variableExpense
        },
        netFlow: totalInflow - totalOutflow,
        projectedBalance: currentBalance,
        bills: weekBills.map(b => ({ name: b.name, amount: b.amount, dueDate: b.dueDate })),
        status: currentBalance < 0 ? 'critical' : currentBalance < 500 ? 'warning' : 'ok'
      })
    }

    // Identificar semanas críticas
    const criticalWeeks = cashFlow.filter(w => w.status === 'critical')
    const warningWeeks = cashFlow.filter(w => w.status === 'warning')

    return {
      cashFlow,
      summary: {
        totalInflow: cashFlow.reduce((sum, w) => sum + w.inflow.total, 0),
        totalOutflow: cashFlow.reduce((sum, w) => sum + w.outflow.total, 0),
        finalProjectedBalance: currentBalance,
        criticalWeeks: criticalWeeks.length,
        warningWeeks: warningWeeks.length,
        lowestBalance: Math.min(...cashFlow.map(w => w.projectedBalance))
      },
      alerts: [
        ...criticalWeeks.map(w => ({
          type: 'critical',
          message: `Saldo negativo projetado na semana ${w.week}`,
          week: w.week
        })),
        ...warningWeeks.map(w => ({
          type: 'warning',
          message: `Saldo baixo projetado na semana ${w.week}`,
          week: w.week
        }))
      ]
    }
  } catch (error) {
    console.error('[PROJECTION] Erro ao projetar fluxo de caixa:', error.message)
    throw error
  }
}

// Funções auxiliares
const getMonthlyValue = (recurring) => {
  switch (recurring.frequency) {
    case 'daily': return recurring.amount * 30
    case 'weekly': return recurring.amount * 4
    case 'biweekly': return recurring.amount * 2
    case 'monthly': return recurring.amount
    case 'quarterly': return recurring.amount / 3
    case 'semiannual': return recurring.amount / 6
    case 'annual': return recurring.amount / 12
    default: return recurring.amount
  }
}

const calculateWeeklyRecurring = (recurringItems, weekStart, weekEnd, type) => {
  let total = 0

  for (const item of recurringItems.filter(r => r.type === type)) {
    const monthlyValue = getMonthlyValue(item)
    total += (monthlyValue / 4) // Aproximação semanal
  }

  return total
}

const calculateConfidence = (monthsAhead) => {
  // Confiança diminui com o tempo
  return Math.max(0.5, 1 - (monthsAhead * 0.1))
}

const calculateTrend = (values) => {
  if (values.length < 2) return { direction: 'stable', rate: 0 }

  let totalChange = 0
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      totalChange += (values[i] - values[i - 1]) / values[i - 1]
    }
  }

  const avgChange = totalChange / (values.length - 1)

  return {
    direction: avgChange > 0.05 ? 'up' : avgChange < -0.05 ? 'down' : 'stable',
    rate: avgChange
  }
}

const getTrendDescription = (trend, avgNetFlow) => {
  if (trend === 'positive') {
    return `Você está economizando em média R$ ${avgNetFlow.toFixed(2)} por mês`
  } else if (trend === 'negative') {
    return `Você está gastando R$ ${Math.abs(avgNetFlow).toFixed(2)} a mais do que ganha por mês`
  }
  return 'Seu saldo está estável'
}

const getBalanceRecommendation = (trend, avgNetFlow, currentBalance) => {
  if (trend === 'negative') {
    return 'Reduza gastos variáveis e revise assinaturas para equilibrar seu orçamento'
  }
  if (currentBalance < 1000) {
    return 'Construa uma reserva de emergência antes de fazer novos investimentos'
  }
  if (avgNetFlow > 500) {
    return 'Considere investir parte da sua economia mensal para fazer seu dinheiro trabalhar'
  }
  return 'Continue mantendo seus gastos controlados'
}

const generateGoalRecommendations = (onTrack, avgContribution, required, remaining) => {
  const recommendations = []

  if (!onTrack && required) {
    const gap = required - avgContribution
    recommendations.push(`Aumente sua contribuição mensal em R$ ${gap.toFixed(2)} para atingir a meta no prazo`)
  }

  if (avgContribution === 0) {
    recommendations.push('Comece a fazer contribuições regulares para sua meta')
    recommendations.push(`Para atingir em 12 meses, contribua R$ ${(remaining / 12).toFixed(2)} por mês`)
  }

  if (onTrack) {
    recommendations.push('Você está no caminho certo! Mantenha suas contribuições regulares')
  }

  return recommendations
}

module.exports = {
  projectBalance,
  projectGoal,
  projectCategorySpending,
  projectCashFlow
}
