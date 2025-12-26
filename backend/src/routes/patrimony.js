const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const Account = require('../models/Account')
const Investment = require('../models/Investment')
const Debt = require('../models/Debt')
const Transaction = require('../models/Transaction')
const Budget = require('../models/Budget')
const Goal = require('../models/Goal')
const Bill = require('../models/Bill')
const Recurring = require('../models/Recurring')
const RecurringOverride = require('../models/RecurringOverride')
const RecurringPayment = require('../models/RecurringPayment')

router.use(protect)

// @route   GET /api/patrimony/summary
// @desc    Retorna resumo do patrimônio total
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user._id

    // 1. Saldo total das contas
    const accounts = await Account.find({ user: userId, isActive: true })
    const accountsTotal = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)

    // 2. Investimentos
    const investments = await Investment.find({ user: userId })
    const investmentsTotal = investments.reduce((sum, inv) => {
      return sum + (inv.quantity * (inv.currentPrice || inv.purchasePrice))
    }, 0)

    // 3. Dívidas
    const debts = await Debt.find({ user: userId, status: { $ne: 'paid' } })
    const debtsTotal = debts.reduce((sum, debt) => sum + (debt.remainingAmount || 0), 0)

    // 4. Patrimônio líquido
    const netWorth = accountsTotal + investmentsTotal - debtsTotal

    // 5. Variação do mês (transações do mês atual) - usar UTC para consistência
    const today = new Date()
    const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 0, 0, 0, 0))
    const endOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999))

    const monthTransactions = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ])

    const monthIncome = monthTransactions.find(t => t._id === 'income')?.total || 0
    const monthExpense = monthTransactions.find(t => t._id === 'expense')?.total || 0
    const monthBalance = monthIncome - monthExpense

    // 6. Composição do patrimônio
    // Use total assets (accounts + investments) for percentage calculation
    const totalAssets = accountsTotal + investmentsTotal
    const composition = {
      accounts: {
        total: accountsTotal,
        percentage: totalAssets > 0 ? ((accountsTotal / totalAssets) * 100) : 0,
        items: accounts.map(a => ({
          name: a.name,
          type: a.type,
          balance: a.balance,
          color: a.color
        }))
      },
      investments: {
        total: investmentsTotal,
        percentage: totalAssets > 0 ? ((investmentsTotal / totalAssets) * 100) : 0,
        items: investments.map(i => ({
          name: i.name,
          type: i.type,
          value: i.quantity * (i.currentPrice || i.purchasePrice)
        }))
      },
      debts: {
        total: debtsTotal,
        percentage: totalAssets > 0 ? ((debtsTotal / totalAssets) * 100) : 0,
        items: debts.map(d => ({
          name: d.name,
          type: d.type,
          remaining: d.remainingAmount
        }))
      }
    }

    res.json({
      netWorth,
      accountsTotal,
      investmentsTotal,
      debtsTotal,
      monthBalance,
      monthIncome,
      monthExpense,
      composition
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao calcular patrimônio', error: error.message })
  }
})

// @route   GET /api/patrimony/health-score
// @desc    Calcula score de saúde financeira
router.get('/health-score', async (req, res) => {
  try {
    const userId = req.user._id
    const today = new Date()
    // Usar UTC para consistência com datas armazenadas no banco
    const currentMonth = today.getUTCMonth() + 1
    const currentYear = today.getUTCFullYear()

    let score = 100
    const factors = []

    // 1. Verificar reserva de emergência (pelo menos 3x a despesa média mensal)
    const lastSixMonths = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 6, 1, 0, 0, 0, 0))
    const avgExpenses = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: lastSixMonths }
        }
      },
      {
        $group: { _id: null, total: { $sum: '$amount' } }
      }
    ])

    const monthlyAvgExpense = (avgExpenses[0]?.total || 0) / 6
    const accounts = await Account.find({ user: userId, isActive: true })
    const liquidAssets = accounts
      .filter(a => ['checking', 'savings', 'cash'].includes(a.type))
      .reduce((sum, a) => sum + (a.balance || 0), 0)

    const emergencyMonths = monthlyAvgExpense > 0 ? liquidAssets / monthlyAvgExpense : 0

    if (emergencyMonths >= 6) {
      factors.push({ name: 'Reserva de emergência', status: 'excellent', points: 0, detail: `${emergencyMonths.toFixed(1)} meses de despesas` })
    } else if (emergencyMonths >= 3) {
      factors.push({ name: 'Reserva de emergência', status: 'good', points: -5, detail: `${emergencyMonths.toFixed(1)} meses de despesas` })
      score -= 5
    } else if (emergencyMonths >= 1) {
      factors.push({ name: 'Reserva de emergência', status: 'warning', points: -15, detail: `Apenas ${emergencyMonths.toFixed(1)} meses` })
      score -= 15
    } else {
      factors.push({ name: 'Reserva de emergência', status: 'critical', points: -25, detail: 'Sem reserva adequada' })
      score -= 25
    }

    // 2. Verificar orçamentos (está dentro do limite?)
    // Otimizado: buscar orçamentos e gastos em apenas 2 queries ao invés de N+1
    const budgets = await Budget.find({ user: userId, month: currentMonth, year: currentYear })

    // Buscar todos os gastos por categoria em uma única query
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0))
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999))

    const spentByCategory = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' }
        }
      }
    ])

    // Converter para objeto para acesso rápido
    const spentMap = {}
    spentByCategory.forEach(s => { spentMap[s._id] = s.total })

    let budgetsOverLimit = 0
    for (const budget of budgets) {
      if ((spentMap[budget.category] || 0) > budget.limit) {
        budgetsOverLimit++
      }
    }

    if (budgets.length > 0) {
      const budgetHealth = ((budgets.length - budgetsOverLimit) / budgets.length) * 100
      if (budgetHealth === 100) {
        factors.push({ name: 'Orçamentos', status: 'excellent', points: 0, detail: 'Todos dentro do limite' })
      } else if (budgetHealth >= 70) {
        factors.push({ name: 'Orçamentos', status: 'warning', points: -10, detail: `${budgetsOverLimit} orçamento(s) excedido(s)` })
        score -= 10
      } else {
        factors.push({ name: 'Orçamentos', status: 'critical', points: -20, detail: `${budgetsOverLimit} orçamento(s) excedido(s)` })
        score -= 20
      }
    }

    // 3. Verificar dívidas (relação dívida/patrimônio)
    const debts = await Debt.find({ user: userId, status: { $ne: 'paid' } })
    const debtsTotal = debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0)
    const investments = await Investment.find({ user: userId })
    const investmentsTotal = investments.reduce((sum, i) => sum + (i.quantity * (i.currentPrice || i.purchasePrice)), 0)
    const totalAssets = liquidAssets + investmentsTotal

    const debtRatio = totalAssets > 0 ? (debtsTotal / totalAssets) * 100 : 0

    if (debtsTotal === 0) {
      factors.push({ name: 'Endividamento', status: 'excellent', points: 0, detail: 'Sem dívidas' })
    } else if (debtRatio <= 30) {
      factors.push({ name: 'Endividamento', status: 'good', points: -5, detail: `${debtRatio.toFixed(0)}% do patrimônio` })
      score -= 5
    } else if (debtRatio <= 50) {
      factors.push({ name: 'Endividamento', status: 'warning', points: -15, detail: `${debtRatio.toFixed(0)}% do patrimônio` })
      score -= 15
    } else {
      factors.push({ name: 'Endividamento', status: 'critical', points: -25, detail: `${debtRatio.toFixed(0)}% do patrimônio` })
      score -= 25
    }

    // 4. Verificar contas atrasadas
    const overdueBills = await Bill.countDocuments({
      user: userId,
      isPaid: false,
      dueDay: { $lt: today.getDate() },
      currentMonth: currentMonth,
      currentYear: currentYear
    })

    if (overdueBills === 0) {
      factors.push({ name: 'Contas em dia', status: 'excellent', points: 0, detail: 'Nenhuma conta atrasada' })
    } else {
      factors.push({ name: 'Contas em dia', status: 'critical', points: -15, detail: `${overdueBills} conta(s) atrasada(s)` })
      score -= 15
    }

    // 5. Verificar metas (tem metas ativas?)
    const activeGoals = await Goal.countDocuments({ user: userId, status: 'active' })
    const completedGoals = await Goal.countDocuments({ user: userId, status: 'completed' })

    if (activeGoals > 0 || completedGoals > 0) {
      factors.push({ name: 'Planejamento', status: 'excellent', points: 0, detail: `${activeGoals} meta(s) ativa(s)` })
    } else {
      factors.push({ name: 'Planejamento', status: 'warning', points: -5, detail: 'Defina metas financeiras' })
      score -= 5
    }

    // 6. Diversificação de investimentos
    const investmentTypes = [...new Set(investments.map(i => i.type))]
    if (investmentsTotal > 0) {
      if (investmentTypes.length >= 3) {
        factors.push({ name: 'Diversificação', status: 'excellent', points: 0, detail: `${investmentTypes.length} tipos de investimento` })
      } else if (investmentTypes.length >= 2) {
        factors.push({ name: 'Diversificação', status: 'good', points: -5, detail: 'Diversifique mais' })
        score -= 5
      } else {
        factors.push({ name: 'Diversificação', status: 'warning', points: -10, detail: 'Concentrado em 1 tipo' })
        score -= 10
      }
    }

    // Garantir que o score fique entre 0 e 100
    score = Math.max(0, Math.min(100, score))

    // Determinar nível de saúde
    let level, message
    if (score >= 80) {
      level = 'excellent'
      message = 'Excelente! Suas finanças estão muito bem organizadas.'
    } else if (score >= 60) {
      level = 'good'
      message = 'Bom! Há alguns pontos para melhorar.'
    } else if (score >= 40) {
      level = 'warning'
      message = 'Atenção! Revise seus hábitos financeiros.'
    } else {
      level = 'critical'
      message = 'Crítico! Ação imediata necessária.'
    }

    res.json({
      score,
      level,
      message,
      factors
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao calcular saúde financeira', error: error.message })
  }
})

// @route   GET /api/patrimony/cashflow-forecast
// @desc    Previsão de fluxo de caixa para os próximos 30 dias
router.get('/cashflow-forecast', async (req, res) => {
  try {
    const userId = req.user._id
    const today = new Date()
    const forecast = []

    // Saldo atual
    const accounts = await Account.find({ user: userId, isActive: true })
    let currentBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)

    // Buscar recorrências ativas
    const recurring = await Recurring.find({ user: userId, isActive: true })

    // Buscar contas a pagar do mês (usar UTC para consistência)
    const currentMonth = today.getUTCMonth() + 1
    const currentYear = today.getUTCFullYear()
    const bills = await Bill.find({
      user: userId,
      isPaid: false,
      currentMonth: currentMonth,
      currentYear: currentYear
    })

    // IMPORTANTE: Buscar overrides para os próximos 2 meses (para cobrir os 30 dias)
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear
    const overrides = await RecurringOverride.find({
      user: userId,
      $or: [
        { month: currentMonth, year: currentYear },
        { month: nextMonth, year: nextYear }
      ]
    })

    // Criar mapa de overrides por recorrência/mês/ano
    const overridesMap = new Map()
    overrides.forEach(o => {
      const key = `${o.recurring.toString()}_${o.month}_${o.year}`
      overridesMap.set(key, o)
    })

    // Buscar pagamentos já realizados nos meses relevantes
    const payments = await RecurringPayment.find({
      user: userId,
      $or: [
        { month: currentMonth, year: currentYear },
        { month: nextMonth, year: nextYear }
      ]
    })

    // Criar Set de recorrências já pagas por mês
    const paidRecurringMap = new Map()
    payments.forEach(p => {
      const key = `${p.recurring.toString()}_${p.month}_${p.year}`
      paidRecurringMap.set(key, true)
    })

    // Gerar previsão para os próximos 30 dias
    for (let i = 0; i <= 30; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const day = date.getDate()
      const month = date.getMonth() + 1
      const year = date.getFullYear()

      const dayEvents = []
      let dayIncome = 0
      let dayExpense = 0

      // Verificar recorrências
      for (const rec of recurring) {
        let isDue = false

        if (rec.frequency === 'monthly' && rec.dayOfMonth === day) {
          isDue = true
        } else if (rec.frequency === 'weekly') {
          const recDate = new Date(rec.nextDueDate)
          isDue = recDate.toDateString() === date.toDateString()
        }

        if (isDue) {
          // Verificar override para este mês específico
          const overrideKey = `${rec._id.toString()}_${month}_${year}`
          const override = overridesMap.get(overrideKey)

          // Verificar se já foi pago
          const paymentKey = `${rec._id.toString()}_${month}_${year}`
          const isPaid = paidRecurringMap.has(paymentKey)

          // Se foi pulado (skip), não incluir na previsão
          if (override?.type === 'skip') {
            continue
          }

          // Se já foi pago, não incluir na previsão
          if (isPaid) {
            continue
          }

          // Calcular valor considerando override (desconto ou pagamento parcial)
          let finalAmount = rec.amount
          let hasDiscount = false
          if (override) {
            if (override.type === 'custom_amount' && override.amount !== undefined) {
              finalAmount = override.amount
              hasDiscount = true
            } else if (override.type === 'partial_payment') {
              // Para pagamento parcial, usar o valor restante
              finalAmount = override.amount || (rec.amount - (override.paidAmount || 0))
              hasDiscount = true
            }
          }

          if (rec.type === 'income') {
            dayIncome += finalAmount
            dayEvents.push({
              type: 'income',
              name: rec.name,
              amount: finalAmount,
              originalAmount: hasDiscount ? rec.amount : undefined,
              hasDiscount,
              source: 'recurring'
            })
          } else {
            dayExpense += finalAmount
            dayEvents.push({
              type: 'expense',
              name: rec.name,
              amount: finalAmount,
              originalAmount: hasDiscount ? rec.amount : undefined,
              hasDiscount,
              source: 'recurring'
            })
          }
        }
      }

      // Verificar contas a pagar (bills diretas, não recorrências)
      for (const bill of bills) {
        if (bill.dueDay === day && month === currentMonth && year === currentYear) {
          dayExpense += bill.amount
          dayEvents.push({ type: 'expense', name: bill.name, amount: bill.amount, source: 'bill' })
        }
      }

      // Atualizar saldo projetado
      currentBalance += dayIncome - dayExpense

      forecast.push({
        date: date.toISOString().split('T')[0],
        day,
        balance: currentBalance,
        income: dayIncome,
        expense: dayExpense,
        events: dayEvents
      })
    }

    // Calcular alertas
    const alerts = []
    const minBalance = Math.min(...forecast.map(f => f.balance))
    if (minBalance < 0) {
      const negativeDay = forecast.find(f => f.balance < 0)
      alerts.push({
        type: 'critical',
        message: `Saldo negativo previsto para ${new Date(negativeDay.date).toLocaleDateString('pt-BR')}`
      })
    } else if (minBalance < 500) {
      alerts.push({
        type: 'warning',
        message: `Saldo baixo previsto: R$ ${minBalance.toFixed(2)}`
      })
    }

    res.json({
      forecast,
      summary: {
        startBalance: forecast[0]?.balance || 0,
        endBalance: forecast[forecast.length - 1]?.balance || 0,
        totalIncome: forecast.reduce((sum, f) => sum + f.income, 0),
        totalExpense: forecast.reduce((sum, f) => sum + f.expense, 0),
        minBalance,
        maxBalance: Math.max(...forecast.map(f => f.balance))
      },
      alerts
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao gerar previsão', error: error.message })
  }
})

// @route   GET /api/patrimony/dashboard
// @desc    Endpoint unificado do dashboard - retorna tudo em uma chamada
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user._id
    const today = new Date()
    const currentMonth = today.getUTCMonth() + 1
    const currentYear = today.getUTCFullYear()
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0))
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999))

    // Buscar todos os dados em paralelo
    const [
      accounts,
      investments,
      debts,
      monthTransactions,
      upcomingBills,
      budgets,
      goals,
      spentByCategory
    ] = await Promise.all([
      Account.find({ user: userId, isActive: true }),
      Investment.find({ user: userId }),
      Debt.find({ user: userId, status: { $ne: 'paid' } }),
      Transaction.aggregate([
        {
          $match: {
            user: userId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' }
          }
        }
      ]),
      Bill.find({
        user: userId,
        isPaid: false,
        currentMonth: currentMonth,
        currentYear: currentYear
      }).sort({ dueDay: 1 }).limit(5),
      Budget.find({ user: userId, month: currentMonth, year: currentYear }),
      Goal.find({ user: userId, status: 'active' }).limit(3),
      Transaction.aggregate([
        {
          $match: {
            user: userId,
            type: 'expense',
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 5 }
      ])
    ])

    // Calcular totais
    const accountsTotal = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
    const investmentsTotal = investments.reduce((sum, inv) => {
      return sum + (inv.quantity * (inv.currentPrice || inv.purchasePrice))
    }, 0)
    const debtsTotal = debts.reduce((sum, debt) => sum + (debt.remainingAmount || 0), 0)
    const netWorth = accountsTotal + investmentsTotal - debtsTotal

    const monthIncome = monthTransactions.find(t => t._id === 'income')?.total || 0
    const monthExpense = monthTransactions.find(t => t._id === 'expense')?.total || 0
    const monthBalance = monthIncome - monthExpense

    // Score de saúde simplificado (0-100)
    let healthScore = 100
    // Reserva de emergência
    const liquidAssets = accounts
      .filter(a => ['checking', 'savings', 'cash'].includes(a.type))
      .reduce((sum, a) => sum + (a.balance || 0), 0)
    const avgMonthlyExpense = monthExpense || 1
    const emergencyMonths = liquidAssets / avgMonthlyExpense
    if (emergencyMonths < 3) healthScore -= 20
    else if (emergencyMonths < 6) healthScore -= 10

    // Dívidas
    const totalAssets = accountsTotal + investmentsTotal
    const debtRatio = totalAssets > 0 ? (debtsTotal / totalAssets) * 100 : 0
    if (debtRatio > 50) healthScore -= 25
    else if (debtRatio > 30) healthScore -= 15
    else if (debtRatio > 0) healthScore -= 5

    // Orçamentos estourados
    const spentMap = {}
    spentByCategory.forEach(s => { spentMap[s._id] = s.total })
    const budgetsOverLimit = budgets.filter(b => (spentMap[b.category] || 0) > b.limit).length
    if (budgetsOverLimit > 0) healthScore -= (budgetsOverLimit * 5)

    healthScore = Math.max(0, Math.min(100, healthScore))

    // Determinar nível
    let healthLevel = 'excellent'
    if (healthScore < 40) healthLevel = 'critical'
    else if (healthScore < 60) healthLevel = 'warning'
    else if (healthScore < 80) healthLevel = 'good'

    // Formatar contas próximas
    const formattedBills = upcomingBills.map(bill => {
      const dueDate = new Date(Date.UTC(currentYear, currentMonth - 1, bill.dueDay))
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
      return {
        _id: bill._id,
        name: bill.name,
        amount: bill.amount,
        dueDay: bill.dueDay,
        category: bill.category,
        isOverdue: diffDays < 0,
        daysUntilDue: diffDays
      }
    })

    // Formatar orçamentos
    const formattedBudgets = budgets.map(b => ({
      category: b.category,
      limit: b.limit,
      spent: spentMap[b.category] || 0,
      percentage: Math.round(((spentMap[b.category] || 0) / b.limit) * 100)
    })).sort((a, b) => b.percentage - a.percentage).slice(0, 5)

    res.json({
      // Resumo financeiro
      summary: {
        netWorth,
        accountsTotal,
        investmentsTotal,
        debtsTotal,
        monthIncome,
        monthExpense,
        monthBalance
      },
      // Saúde financeira (simplificada)
      health: {
        score: healthScore,
        level: healthLevel
      },
      // Próximas contas
      upcomingBills: formattedBills,
      // Top categorias de gasto
      topCategories: spentByCategory.map(c => ({
        category: c._id,
        total: c.total
      })),
      // Orçamentos
      budgets: formattedBudgets,
      // Metas ativas
      goals: goals.map(g => ({
        _id: g._id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        progress: Math.round((g.currentAmount / g.targetAmount) * 100)
      })),
      // Contas bancárias
      accounts: accounts.map(a => ({
        _id: a._id,
        name: a.name,
        type: a.type,
        balance: a.balance,
        color: a.color
      }))
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar dashboard', error: error.message })
  }
})

module.exports = router
