const express = require('express')
const router = express.Router()
const Goal = require('../models/Goal')
const { protect, validateObjectId } = require('../middleware/auth')

router.use(protect)

// @route   GET /api/goals
// @desc    Listar todas as metas
router.get('/', async (req, res) => {
  try {
    const { status, month, year } = req.query
    const filter = { user: req.user._id }

    if (status) filter.status = status

    const goals = await Goal.find(filter).sort({ createdAt: -1 })

    // Para metas do tipo expense_limit, calcular currentAmount baseado nas despesas do mês
    const Transaction = require('../models/Transaction')

    // Usar mês/ano da query ou mês atual
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    const startDate = new Date(targetYear, targetMonth - 1, 1)
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59)

    // Buscar total de despesas do mês
    const expenseResult = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ])

    const monthlyExpenses = expenseResult[0]?.total || 0

    // Atualizar currentAmount para metas do tipo expense_limit
    const goalsWithCalculations = goals.map(goal => {
      const goalObj = goal.toObject()

      if (goal.type === 'expense_limit') {
        // Para limite de gastos: currentAmount = total de despesas do mês
        goalObj.currentAmount = monthlyExpenses
        goalObj.calculatedMonth = targetMonth
        goalObj.calculatedYear = targetYear

        // Recalcular progress (invertido: quanto menor o gasto, melhor)
        // Se gastou menos que o limite = sucesso
        // progress mostra quanto do limite já foi usado
        goalObj.progress = goal.targetAmount > 0
          ? (monthlyExpenses / goal.targetAmount) * 100
          : 0

        // Remaining = quanto ainda pode gastar
        goalObj.remaining = Math.max(0, goal.targetAmount - monthlyExpenses)

        // Status baseado no gasto
        if (monthlyExpenses <= goal.targetAmount) {
          goalObj.isOnTrack = true
          goalObj.statusMessage = monthlyExpenses < goal.targetAmount
            ? `Dentro do limite! Pode gastar mais R$ ${(goal.targetAmount - monthlyExpenses).toFixed(2)}`
            : 'No limite exato!'
        } else {
          goalObj.isOnTrack = false
          goalObj.statusMessage = `Estourou o limite em R$ ${(monthlyExpenses - goal.targetAmount).toFixed(2)}`
        }
      }

      return goalObj
    })

    res.json({ goals: goalsWithCalculations })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar metas', error: error.message })
  }
})

// @route   GET /api/goals/summary
// @desc    Resumo das metas
router.get('/summary', async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user._id, status: 'active' })

    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
    const totalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0)
    const completedCount = goals.filter(g => g.progress >= 100).length

    res.json({
      totalGoals: goals.length,
      totalTarget,
      totalCurrent,
      totalProgress: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0,
      completedCount,
      goals
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar resumo', error: error.message })
  }
})

// @route   POST /api/goals
// @desc    Criar nova meta
router.post('/', async (req, res) => {
  try {
    const { name, type, targetAmount, currentAmount, deadline, color, icon, notes } = req.body

    const goal = await Goal.create({
      user: req.user._id,
      name,
      type,
      targetAmount,
      currentAmount: currentAmount || 0,
      deadline,
      color,
      icon,
      notes
    })

    res.status(201).json({ goal })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar meta', error: error.message })
  }
})

// @route   PUT /api/goals/:id
// @desc    Atualizar meta
router.put('/:id', async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id })

    if (!goal) {
      return res.status(404).json({ message: 'Meta não encontrada' })
    }

    const updates = req.body
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        goal[key] = updates[key]
      }
    })

    // Marcar como completa se atingiu
    if (goal.currentAmount >= goal.targetAmount && goal.status === 'active') {
      goal.status = 'completed'
    }

    await goal.save()
    res.json({ goal })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar meta', error: error.message })
  }
})

// @route   POST /api/goals/:id/deposit
// @desc    Adicionar valor à meta (cria transação automaticamente)
router.post('/:id/deposit', validateObjectId(), async (req, res) => {
  try {
    const { amount, account, date, createTransaction = true } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valor deve ser maior que zero' })
    }

    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id })

    if (!goal) {
      return res.status(404).json({ message: 'Meta não encontrada' })
    }

    goal.currentAmount += amount

    if (goal.currentAmount >= goal.targetAmount && goal.status === 'active') {
      goal.status = 'completed'
    }

    await goal.save()

    // CRIAR TRANSAÇÃO AUTOMATICAMENTE (se solicitado)
    let transaction = null
    if (createTransaction) {
      const Transaction = require('../models/Transaction')

      transaction = await Transaction.create({
        user: req.user._id,
        type: 'expense', // É uma "saída" do dinheiro disponível para a meta
        category: 'metas',
        description: `Depósito na meta: ${goal.name}`,
        amount: amount,
        account: account || null,
        date: date ? new Date(date) : new Date(),
        tags: ['meta', goal.type]
      })
    }

    const response = {
      goal,
      message: goal.status === 'completed' ? 'Meta atingida! Parabéns!' : 'Depósito realizado!'
    }

    if (transaction) {
      response.transaction = transaction
    }

    res.json(response)
  } catch (error) {
    res.status(400).json({ message: 'Erro ao depositar', error: error.message })
  }
})

// @route   POST /api/goals/:id/withdraw
// @desc    Retirar valor da meta (ex: usar o dinheiro economizado)
router.post('/:id/withdraw', validateObjectId(), async (req, res) => {
  try {
    const { amount, account, date, description } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valor deve ser maior que zero' })
    }

    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id })

    if (!goal) {
      return res.status(404).json({ message: 'Meta não encontrada' })
    }

    if (amount > goal.currentAmount) {
      return res.status(400).json({ message: 'Valor de retirada maior que o saldo disponível na meta' })
    }

    goal.currentAmount -= amount

    // Se tinha completado mas retirou, voltar para ativo
    if (goal.status === 'completed' && goal.currentAmount < goal.targetAmount) {
      goal.status = 'active'
    }

    await goal.save()

    // Criar transação de receita (dinheiro "volta" para disponível)
    const Transaction = require('../models/Transaction')

    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'income',
      category: 'metas',
      description: description || `Retirada da meta: ${goal.name}`,
      amount: amount,
      account: account || null,
      date: date ? new Date(date) : new Date(),
      tags: ['meta', 'retirada']
    })

    res.json({
      goal,
      transaction,
      message: 'Retirada realizada!'
    })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao retirar', error: error.message })
  }
})

// @route   DELETE /api/goals/:id
// @desc    Excluir meta
router.delete('/:id', async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user._id })

    if (!goal) {
      return res.status(404).json({ message: 'Meta não encontrada' })
    }

    res.json({ message: 'Meta excluída com sucesso' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir meta', error: error.message })
  }
})

module.exports = router
