const express = require('express')
const router = express.Router()
const Recurring = require('../models/Recurring')
const Transaction = require('../models/Transaction')
const { protect } = require('../middleware/auth')
const { v4: uuidv4 } = require('uuid')

router.use(protect)

// @route   GET /api/recurring
// @desc    Listar todas as recorrências do usuário
router.get('/', async (req, res) => {
  try {
    const { type, isActive = true } = req.query
    const query = { user: req.user._id }
    if (type) query.type = type
    if (isActive !== 'all') query.isActive = isActive === 'true'

    const recurrences = await Recurring.find(query)
      .populate('account', 'name color')
      .sort({ nextDueDate: 1 })

    res.json({ recurrences })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar recorrências', error: error.message })
  }
})

// @route   GET /api/recurring/upcoming
// @desc    Próximas recorrências a vencer
router.get('/upcoming', async (req, res) => {
  try {
    const { days = 30 } = req.query
    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate() + parseInt(days))

    const recurrences = await Recurring.find({
      user: req.user._id,
      isActive: true,
      nextDueDate: { $lte: limitDate }
    })
      .populate('account', 'name color')
      .sort({ nextDueDate: 1 })

    res.json({ recurrences })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar recorrências', error: error.message })
  }
})

// @route   POST /api/recurring
// @desc    Criar nova recorrência
router.post('/', async (req, res) => {
  try {
    const {
      name, type, category, amount, account,
      frequency, dayOfMonth, dayOfWeek, startDate, endDate,
      isInstallment, totalInstallments, notifyDaysBefore
    } = req.body

    // Calcular próxima data
    let nextDueDate = new Date(startDate || Date.now())
    if (dayOfMonth && frequency === 'monthly') {
      nextDueDate.setDate(dayOfMonth)
      if (nextDueDate < new Date()) {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1)
      }
    }

    const recurring = await Recurring.create({
      user: req.user._id,
      name,
      type,
      category,
      amount,
      account,
      frequency: frequency || 'monthly',
      dayOfMonth,
      dayOfWeek,
      startDate: startDate || Date.now(),
      endDate,
      nextDueDate,
      isInstallment: isInstallment || false,
      totalInstallments: totalInstallments || 1,
      currentInstallment: 1,
      notifyDaysBefore: notifyDaysBefore || 3
    })

    res.status(201).json({ recurring })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar recorrência', error: error.message })
  }
})

// @route   POST /api/recurring/:id/generate
// @desc    Gerar transação a partir da recorrência
router.post('/:id/generate', async (req, res) => {
  try {
    const recurring = await Recurring.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!recurring) {
      return res.status(404).json({ message: 'Recorrência não encontrada' })
    }

    // Criar transação
    const transaction = await Transaction.create({
      user: req.user._id,
      type: recurring.type,
      category: recurring.category,
      description: recurring.isInstallment
        ? `${recurring.name} (${recurring.currentInstallment}/${recurring.totalInstallments})`
        : recurring.name,
      amount: recurring.amount,
      account: recurring.account,
      date: recurring.nextDueDate,
      recurringId: recurring._id,
      isInstallment: recurring.isInstallment,
      installmentNumber: recurring.currentInstallment,
      totalInstallments: recurring.totalInstallments
    })

    // Atualizar recorrência
    recurring.lastGeneratedDate = recurring.nextDueDate
    recurring.nextDueDate = recurring.calculateNextDueDate()

    if (recurring.isInstallment) {
      recurring.currentInstallment++
      if (recurring.currentInstallment > recurring.totalInstallments) {
        recurring.isActive = false
      }
    }

    // Verificar se passou da data final
    if (recurring.endDate && recurring.nextDueDate > recurring.endDate) {
      recurring.isActive = false
    }

    await recurring.save()

    res.json({ transaction, recurring })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao gerar transação', error: error.message })
  }
})

// @route   POST /api/recurring/installment
// @desc    Criar parcelamento (gera todas as parcelas)
router.post('/installment', async (req, res) => {
  try {
    const {
      name, category, amount, account, totalInstallments,
      startDate, generateAll
    } = req.body

    const installmentGroupId = uuidv4()
    const transactions = []
    let currentDate = new Date(startDate || Date.now())

    // Se generateAll, criar todas as transações de uma vez
    if (generateAll) {
      for (let i = 1; i <= totalInstallments; i++) {
        const transaction = await Transaction.create({
          user: req.user._id,
          type: 'expense',
          category,
          description: `${name} (${i}/${totalInstallments})`,
          amount: amount / totalInstallments,
          account,
          date: currentDate,
          isInstallment: true,
          installmentNumber: i,
          totalInstallments,
          installmentGroupId,
          status: i === 1 ? 'confirmed' : 'pending'
        })
        transactions.push(transaction)
        currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1))
      }
    } else {
      // Criar recorrência para gerar parcelas mensalmente
      const recurring = await Recurring.create({
        user: req.user._id,
        name,
        type: 'expense',
        category,
        amount: amount / totalInstallments,
        account,
        frequency: 'monthly',
        dayOfMonth: currentDate.getDate(),
        startDate: currentDate,
        nextDueDate: currentDate,
        isInstallment: true,
        totalInstallments,
        currentInstallment: 1
      })

      return res.status(201).json({ recurring, message: 'Parcelamento criado como recorrência' })
    }

    res.status(201).json({
      message: `${transactions.length} parcelas criadas`,
      transactions,
      installmentGroupId
    })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar parcelamento', error: error.message })
  }
})

// @route   PUT /api/recurring/:id
// @desc    Atualizar recorrência
router.put('/:id', async (req, res) => {
  try {
    const recurring = await Recurring.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!recurring) {
      return res.status(404).json({ message: 'Recorrência não encontrada' })
    }

    const allowedUpdates = [
      'name', 'amount', 'category', 'account', 'frequency',
      'dayOfMonth', 'dayOfWeek', 'endDate', 'isActive', 'notifyDaysBefore'
    ]

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        recurring[field] = req.body[field]
      }
    })

    await recurring.save()
    res.json({ recurring })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar recorrência', error: error.message })
  }
})

// @route   DELETE /api/recurring/:id
// @desc    Desativar recorrência
router.delete('/:id', async (req, res) => {
  try {
    const recurring = await Recurring.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!recurring) {
      return res.status(404).json({ message: 'Recorrência não encontrada' })
    }

    recurring.isActive = false
    await recurring.save()

    res.json({ message: 'Recorrência desativada com sucesso' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desativar recorrência', error: error.message })
  }
})

module.exports = router
