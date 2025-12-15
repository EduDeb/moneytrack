const express = require('express')
const router = express.Router()
const Goal = require('../models/Goal')
const { protect } = require('../middleware/auth')

router.use(protect)

// @route   GET /api/goals
// @desc    Listar todas as metas
router.get('/', async (req, res) => {
  try {
    const { status } = req.query
    const filter = { user: req.user._id }

    if (status) filter.status = status

    const goals = await Goal.find(filter).sort({ createdAt: -1 })
    res.json({ goals })
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
// @desc    Adicionar valor à meta
router.post('/:id/deposit', async (req, res) => {
  try {
    const { amount } = req.body
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id })

    if (!goal) {
      return res.status(404).json({ message: 'Meta não encontrada' })
    }

    goal.currentAmount += amount

    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = 'completed'
    }

    await goal.save()
    res.json({ goal, message: 'Depósito realizado!' })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao depositar', error: error.message })
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
