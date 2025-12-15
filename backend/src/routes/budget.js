const express = require('express')
const router = express.Router()
const Budget = require('../models/Budget')
const Transaction = require('../models/Transaction')
const { protect } = require('../middleware/auth')

router.use(protect)

// @route   GET /api/budget
// @desc    Listar orçamentos do mês atual
router.get('/', async (req, res) => {
  try {
    const { month, year } = req.query
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const currentYear = year ? parseInt(year) : new Date().getFullYear()

    const budgets = await Budget.find({
      user: req.user._id,
      month: currentMonth,
      year: currentYear
    })

    res.json({ budgets })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar orçamentos', error: error.message })
  }
})

// @route   GET /api/budget/status
// @desc    Obter status de todos os orçamentos com gastos atuais
router.get('/status', async (req, res) => {
  try {
    const { month, year } = req.query
    const now = new Date()
    const currentMonth = month ? parseInt(month) : now.getMonth() + 1
    const currentYear = year ? parseInt(year) : now.getFullYear()

    // Buscar orçamentos do mês
    const budgets = await Budget.find({
      user: req.user._id,
      month: currentMonth,
      year: currentYear
    })

    // Buscar transações do mês (usar UTC para consistência com datas no banco)
    const startDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0))
    const endDate = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999))

    const transactions = await Transaction.find({
      user: req.user._id,
      type: 'expense',
      date: { $gte: startDate, $lte: endDate }
    })

    // Calcular gastos por categoria
    const spentByCategory = {}
    transactions.forEach(t => {
      if (!spentByCategory[t.category]) {
        spentByCategory[t.category] = 0
      }
      spentByCategory[t.category] += t.amount
    })

    // Montar status de cada orçamento
    const budgetStatus = budgets.map(b => {
      const spent = spentByCategory[b.category] || 0
      const remaining = b.limit - spent
      const percentage = (spent / b.limit) * 100

      return {
        _id: b._id,
        category: b.category,
        limit: b.limit,
        spent,
        remaining,
        percentage: Math.min(percentage, 100),
        status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok'
      }
    })

    // Calcular totais
    const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0)
    const totalSpent = budgetStatus.reduce((sum, b) => sum + b.spent, 0)

    res.json({
      budgets: budgetStatus,
      summary: {
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        overallPercentage: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
      },
      period: { month: currentMonth, year: currentYear }
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar status', error: error.message })
  }
})

// @route   POST /api/budget
// @desc    Criar ou atualizar orçamento para uma categoria
router.post('/', async (req, res) => {
  try {
    const { category, limit, month, year } = req.body

    // Validações
    if (!category || !category.trim()) {
      return res.status(400).json({ message: 'Categoria é obrigatória' })
    }
    if (!limit || isNaN(parseFloat(limit)) || parseFloat(limit) <= 0) {
      return res.status(400).json({ message: 'Limite deve ser um número maior que zero' })
    }

    const now = new Date()
    const currentMonth = month ? parseInt(month) : now.getUTCMonth() + 1
    const currentYear = year ? parseInt(year) : now.getUTCFullYear()

    // Validar mês e ano
    if (currentMonth < 1 || currentMonth > 12) {
      return res.status(400).json({ message: 'Mês inválido' })
    }
    if (currentYear < 2000 || currentYear > 2100) {
      return res.status(400).json({ message: 'Ano inválido' })
    }

    // Tentar atualizar se existir, senão criar
    const budget = await Budget.findOneAndUpdate(
      {
        user: req.user._id,
        category: category.trim(),
        month: currentMonth,
        year: currentYear
      },
      { limit: parseFloat(limit) },
      { new: true, upsert: true, runValidators: true }
    )

    res.status(201).json({ budget })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao salvar orçamento', error: error.message })
  }
})

// @route   PUT /api/budget/:id
// @desc    Atualizar limite do orçamento
router.put('/:id', async (req, res) => {
  try {
    const { limit } = req.body

    if (!limit || isNaN(parseFloat(limit)) || parseFloat(limit) <= 0) {
      return res.status(400).json({ message: 'Limite deve ser um número maior que zero' })
    }

    const budget = await Budget.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id
      },
      { limit: parseFloat(limit) },
      { new: true, runValidators: true }
    )

    if (!budget) {
      return res.status(404).json({ message: 'Orçamento não encontrado' })
    }

    res.json({ budget })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar orçamento', error: error.message })
  }
})

// @route   DELETE /api/budget/:id
// @desc    Remover orçamento
router.delete('/:id', async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    })

    if (!budget) {
      return res.status(404).json({ message: 'Orçamento não encontrado' })
    }

    res.json({ message: 'Orçamento removido com sucesso' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao remover orçamento', error: error.message })
  }
})

module.exports = router
