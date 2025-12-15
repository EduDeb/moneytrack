const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const {
  projectBalance,
  projectGoal,
  projectCategorySpending,
  projectCashFlow
} = require('../services/projectionService')

router.use(protect)

// @route   GET /api/projections/balance
// @desc    Projetar saldo futuro
router.get('/balance', async (req, res) => {
  try {
    const { months = 6 } = req.query
    const projection = await projectBalance(req.user._id, parseInt(months))
    res.json(projection)
  } catch (error) {
    res.status(500).json({ message: 'Erro ao projetar saldo', error: error.message })
  }
})

// @route   GET /api/projections/goal/:goalId
// @desc    Projetar alcance de meta
router.get('/goal/:goalId', async (req, res) => {
  try {
    const projection = await projectGoal(req.user._id, req.params.goalId)
    res.json(projection)
  } catch (error) {
    res.status(500).json({ message: 'Erro ao projetar meta', error: error.message })
  }
})

// @route   GET /api/projections/categories
// @desc    Projetar gastos por categoria
router.get('/categories', async (req, res) => {
  try {
    const { months = 3 } = req.query
    const projection = await projectCategorySpending(req.user._id, parseInt(months))
    res.json(projection)
  } catch (error) {
    res.status(500).json({ message: 'Erro ao projetar categorias', error: error.message })
  }
})

// @route   GET /api/projections/cashflow
// @desc    Projetar fluxo de caixa semanal
router.get('/cashflow', async (req, res) => {
  try {
    const { weeks = 4 } = req.query
    const projection = await projectCashFlow(req.user._id, parseInt(weeks))
    res.json(projection)
  } catch (error) {
    res.status(500).json({ message: 'Erro ao projetar fluxo de caixa', error: error.message })
  }
})

// @route   GET /api/projections/summary
// @desc    Resumo de todas as projeções
router.get('/summary', async (req, res) => {
  try {
    const [balance, categories, cashflow] = await Promise.all([
      projectBalance(req.user._id, 3),
      projectCategorySpending(req.user._id, 3),
      projectCashFlow(req.user._id, 4)
    ])

    res.json({
      balance: {
        currentBalance: balance.currentBalance,
        projectedIn3Months: balance.projections[2]?.endBalance,
        trend: balance.analysis.trend,
        savingsRate: balance.analysis.savingsRate
      },
      expenses: {
        topCategories: categories.summary.topCategories.slice(0, 3),
        growingCategories: categories.summary.growingCategories,
        averageMonthly: categories.summary.totalProjectedExpense
      },
      cashflow: {
        criticalWeeks: cashflow.summary.criticalWeeks,
        lowestBalance: cashflow.summary.lowestBalance,
        alerts: cashflow.alerts.length
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao gerar resumo', error: error.message })
  }
})

module.exports = router
