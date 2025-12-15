const express = require('express')
const router = express.Router()
const Bill = require('../models/Bill')
const Recurring = require('../models/Recurring')
const Transaction = require('../models/Transaction')
const { protect } = require('../middleware/auth')

// Todas as rotas precisam de autenticação
router.use(protect)

// @route   GET /api/bills
// @desc    Listar todas as contas do usuário (incluindo recorrências)
router.get('/', async (req, res) => {
  try {
    const { status, month, year } = req.query

    const filter = { user: req.user._id }

    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const currentYear = year ? parseInt(year) : new Date().getFullYear()

    filter.currentMonth = currentMonth
    filter.currentYear = currentYear

    if (status === 'paid') {
      filter.isPaid = true
    } else if (status === 'pending') {
      filter.isPaid = false
    }

    const bills = await Bill.find(filter).sort({ dueDay: 1 })

    // Buscar recorrências do tipo expense que vencem neste mês
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59)

    const recurrings = await Recurring.find({
      user: req.user._id,
      type: 'expense',
      isActive: true,
      nextDueDate: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('account', 'name color')

    // Converter recorrências para formato de bill
    const recurringBills = recurrings.map(r => {
      const dueDate = new Date(r.nextDueDate)
      const today = new Date()
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

      let urgency = 'normal'
      if (daysUntilDue < 0) urgency = 'overdue'
      else if (daysUntilDue === 0) urgency = 'today'
      else if (daysUntilDue <= 3) urgency = 'soon'
      else if (daysUntilDue <= 7) urgency = 'upcoming'

      return {
        _id: r._id,
        name: r.name,
        category: r.category,
        amount: r.amount,
        dueDay: dueDate.getDate(),
        isRecurring: true,
        isPaid: false,
        isFromRecurring: true, // Flag para identificar que veio de recorrência
        recurringId: r._id,
        account: r.account,
        urgency,
        daysUntilDue,
        nextDueDate: r.nextDueDate
      }
    })

    // Filtrar por status se necessário
    let filteredRecurringBills = recurringBills
    if (status === 'paid') {
      filteredRecurringBills = [] // Recorrências ainda não pagas não aparecem no filtro "pagas"
    }

    // Combinar bills e recorrências
    const allBills = [...bills.map(b => ({
      ...b.toObject(),
      isFromRecurring: false
    })), ...filteredRecurringBills]

    // Ordenar por dia de vencimento
    allBills.sort((a, b) => a.dueDay - b.dueDay)

    res.json({ bills: allBills })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar contas', error: error.message })
  }
})

// @route   GET /api/bills/upcoming
// @desc    Listar contas dos próximos 7 dias
router.get('/upcoming', async (req, res) => {
  try {
    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()

    const bills = await Bill.find({
      user: req.user._id,
      isPaid: false,
      currentMonth,
      currentYear
    }).sort({ dueDay: 1 })

    // Filtrar apenas as dos próximos 7 dias
    const upcomingBills = bills.filter(bill => {
      const daysUntil = bill.daysUntilDue
      return daysUntil <= 7
    })

    res.json({ bills: upcomingBills })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar contas', error: error.message })
  }
})

// @route   GET /api/bills/summary
// @desc    Resumo das contas do mês (incluindo recorrências)
router.get('/summary', async (req, res) => {
  try {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const bills = await Bill.find({
      user: req.user._id,
      currentMonth,
      currentYear
    })

    // Buscar recorrências do tipo expense que vencem neste mês
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59)

    const recurrings = await Recurring.find({
      user: req.user._id,
      type: 'expense',
      isActive: true,
      nextDueDate: { $gte: startOfMonth, $lte: endOfMonth }
    })

    const today = new Date()

    // Calcular totais das bills
    const billsTotal = bills.reduce((sum, b) => sum + b.amount, 0)
    const billsPaid = bills.filter(b => b.isPaid).reduce((sum, b) => sum + b.amount, 0)

    // Calcular totais das recorrências (todas pendentes)
    const recurringTotal = recurrings.reduce((sum, r) => sum + r.amount, 0)
    const recurringOverdue = recurrings.filter(r => new Date(r.nextDueDate) < today).length

    // Totais combinados
    const total = billsTotal + recurringTotal
    const paid = billsPaid
    const pending = total - paid
    const paidCount = bills.filter(b => b.isPaid).length
    const pendingCount = bills.filter(b => !b.isPaid).length + recurrings.length
    const overdueCount = bills.filter(b => !b.isPaid && b.daysUntilDue < 0).length + recurringOverdue

    res.json({
      total,
      paid,
      pending,
      paidCount,
      pendingCount,
      overdueCount,
      totalCount: bills.length + recurrings.length
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar resumo', error: error.message })
  }
})

// @route   POST /api/bills
// @desc    Criar nova conta
router.post('/', async (req, res) => {
  try {
    const { name, category, amount, dueDay, isRecurring, notes } = req.body

    const bill = await Bill.create({
      user: req.user._id,
      name,
      category,
      amount,
      dueDay,
      isRecurring,
      notes,
      currentMonth: new Date().getMonth() + 1,
      currentYear: new Date().getFullYear()
    })

    res.status(201).json({ bill })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar conta', error: error.message })
  }
})

// @route   PUT /api/bills/:id
// @desc    Atualizar conta
router.put('/:id', async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user._id })

    if (!bill) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    const { name, category, amount, dueDay, isRecurring, notes } = req.body

    bill.name = name || bill.name
    bill.category = category || bill.category
    bill.amount = amount || bill.amount
    bill.dueDay = dueDay || bill.dueDay
    bill.isRecurring = isRecurring !== undefined ? isRecurring : bill.isRecurring
    bill.notes = notes !== undefined ? notes : bill.notes

    await bill.save()

    res.json({ bill })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar conta', error: error.message })
  }
})

// @route   POST /api/bills/:id/pay
// @desc    Marcar conta como paga e criar transação (funciona para bills e recorrências)
router.post('/:id/pay', async (req, res) => {
  try {
    const { isFromRecurring } = req.body

    // Se for de recorrência, usa o endpoint de generate
    if (isFromRecurring) {
      const recurring = await Recurring.findOne({ _id: req.params.id, user: req.user._id })

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

      // Atualizar recorrência para próximo período
      recurring.lastGeneratedDate = recurring.nextDueDate

      // Calcular próxima data manualmente (sempre avançar para o próximo período)
      let nextDate = new Date(recurring.nextDueDate)
      switch (recurring.frequency) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + 1)
          break
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7)
          break
        case 'biweekly':
          nextDate.setDate(nextDate.getDate() + 14)
          break
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1)
          if (recurring.dayOfMonth) {
            const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
            nextDate.setDate(Math.min(recurring.dayOfMonth, lastDay))
          }
          break
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1)
          break
      }
      recurring.nextDueDate = nextDate

      if (recurring.isInstallment) {
        recurring.currentInstallment++
        if (recurring.currentInstallment > recurring.totalInstallments) {
          recurring.isActive = false
        }
      }

      if (recurring.endDate && recurring.nextDueDate > recurring.endDate) {
        recurring.isActive = false
      }

      await recurring.save()

      return res.json({
        recurring,
        transaction,
        message: 'Recorrência paga e transação registrada!'
      })
    }

    // Fluxo normal para bills
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user._id })

    if (!bill) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    if (bill.isPaid) {
      return res.status(400).json({ message: 'Conta já foi paga' })
    }

    bill.isPaid = true
    bill.paidAt = new Date()
    await bill.save()

    // Criar transação de despesa automaticamente
    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'expense',
      category: 'contas',
      description: `Pagamento: ${bill.name}`,
      amount: bill.amount,
      date: new Date()
    })

    res.json({ bill, transaction, message: 'Conta paga e transação registrada!' })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao pagar conta', error: error.message })
  }
})

// @route   POST /api/bills/:id/renew
// @desc    Renovar conta para o próximo mês (para recorrentes)
router.post('/:id/renew', async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user._id })

    if (!bill) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    if (!bill.isRecurring) {
      return res.status(400).json({ message: 'Conta não é recorrente' })
    }

    let newMonth = bill.currentMonth + 1
    let newYear = bill.currentYear

    if (newMonth > 12) {
      newMonth = 1
      newYear++
    }

    bill.currentMonth = newMonth
    bill.currentYear = newYear
    bill.isPaid = false
    bill.paidAt = null

    await bill.save()

    res.json({ bill, message: 'Conta renovada para o próximo mês!' })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao renovar conta', error: error.message })
  }
})

// @route   DELETE /api/bills/:id
// @desc    Excluir conta
router.delete('/:id', async (req, res) => {
  try {
    const bill = await Bill.findOneAndDelete({ _id: req.params.id, user: req.user._id })

    if (!bill) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    res.json({ message: 'Conta excluída com sucesso' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir conta', error: error.message })
  }
})

module.exports = router
