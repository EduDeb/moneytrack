const express = require('express')
const router = express.Router()
const Bill = require('../models/Bill')
const Recurring = require('../models/Recurring')
const Transaction = require('../models/Transaction')
const { protect, validateObjectId } = require('../middleware/auth')

// Todas as rotas precisam de autenticação
router.use(protect)

// @route   GET /api/bills
// @desc    Listar todas as contas do usuário (incluindo recorrências)
router.get('/', async (req, res) => {
  try {
    const { status, month, year } = req.query

    const filter = { user: req.user._id }

    // Usar UTC para consistência com datas armazenadas no banco
    const currentMonth = month ? parseInt(month) : new Date().getUTCMonth() + 1
    const currentYear = year ? parseInt(year) : new Date().getUTCFullYear()

    filter.currentMonth = currentMonth
    filter.currentYear = currentYear

    if (status === 'paid') {
      filter.isPaid = true
    } else if (status === 'pending') {
      filter.isPaid = false
    }

    const bills = await Bill.find(filter).sort({ dueDay: 1 })

    // Buscar recorrências do tipo expense que se aplicam ao mês selecionado
    // A lógica deve considerar: startDate <= mês selecionado E (endDate >= mês selecionado OU não tem endDate)
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0))
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999))

    // Buscar todas as recorrências ativas que começaram antes ou durante o mês selecionado
    const recurrings = await Recurring.find({
      user: req.user._id,
      type: 'expense',
      isActive: true,
      startDate: { $lte: endOfMonth }, // Começou antes ou durante o mês
      $or: [
        { endDate: { $exists: false } }, // Sem data de término
        { endDate: null }, // Sem data de término
        { endDate: { $gte: startOfMonth } } // Data de término é depois do início do mês
      ]
    }).populate('account', 'name color')

    // Converter recorrências para formato de bill, calculando a data correta para o mês selecionado
    const recurringBills = recurrings.map(r => {
      // Calcular a data de vencimento para o mês selecionado
      let dueDay = r.dayOfMonth || new Date(r.startDate).getUTCDate()

      // Ajustar para o último dia do mês se necessário (ex: dia 31 em fevereiro)
      const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()
      if (dueDay > lastDayOfMonth) {
        dueDay = lastDayOfMonth
      }

      // Criar a data de vencimento para este mês específico
      const dueDate = new Date(Date.UTC(currentYear, currentMonth - 1, dueDay, 12, 0, 0))

      const today = new Date()
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

      // Para parcelamentos, calcular qual parcela corresponde ao mês selecionado
      let installmentForThisMonth = r.currentInstallment
      let isPaidThisMonth = false

      if (r.isInstallment) {
        // Calcular quantos meses se passaram desde o início do parcelamento
        const startDate = new Date(r.startDate)
        const startMonth = startDate.getUTCMonth() + 1
        const startYear = startDate.getUTCFullYear()

        // Meses desde o início (0 = primeiro mês)
        const monthsDiff = (currentYear - startYear) * 12 + (currentMonth - startMonth)

        // A parcela para este mês (1-indexed)
        installmentForThisMonth = monthsDiff + 1

        // Se a parcela calculada é maior que o total, não mostrar
        if (installmentForThisMonth > r.totalInstallments) {
          return null // Será filtrado depois
        }

        // Se a parcela calculada é menor que 1, não mostrar (mês anterior ao início)
        if (installmentForThisMonth < 1) {
          return null
        }

        // Verificar se esta parcela específica já foi paga
        // Uma parcela está paga se currentInstallment > installmentForThisMonth
        isPaidThisMonth = r.currentInstallment > installmentForThisMonth
      } else {
        // Para recorrências normais, verificar pelo lastGeneratedDate
        if (r.lastGeneratedDate) {
          const lastGenDate = new Date(r.lastGeneratedDate)
          isPaidThisMonth = lastGenDate.getUTCMonth() + 1 === currentMonth &&
                            lastGenDate.getUTCFullYear() === currentYear
        }
      }

      let urgency = 'normal'
      if (isPaidThisMonth) {
        urgency = 'paid'
      } else if (daysUntilDue < 0) {
        urgency = 'overdue'
      } else if (daysUntilDue === 0) {
        urgency = 'today'
      } else if (daysUntilDue <= 3) {
        urgency = 'soon'
      } else if (daysUntilDue <= 7) {
        urgency = 'upcoming'
      }

      return {
        _id: r._id,
        name: r.isInstallment ? `${r.name} (${installmentForThisMonth}/${r.totalInstallments})` : r.name,
        category: r.category,
        amount: r.amount,
        dueDay: dueDay,
        isRecurring: true,
        isPaid: isPaidThisMonth,
        isFromRecurring: true, // Flag para identificar que veio de recorrência
        recurringId: r._id,
        account: r.account,
        urgency,
        daysUntilDue,
        nextDueDate: dueDate,
        isInstallment: r.isInstallment,
        currentInstallment: installmentForThisMonth, // Parcela correspondente a este mês
        totalInstallments: r.totalInstallments
      }
    }).filter(r => r !== null) // Remover parcelas fora do período

    // Filtrar por status se necessário
    let filteredRecurringBills = recurringBills
    if (status === 'paid') {
      filteredRecurringBills = recurringBills.filter(b => b.isPaid) // Apenas recorrências pagas neste mês
    } else if (status === 'pending') {
      filteredRecurringBills = recurringBills.filter(b => !b.isPaid) // Apenas recorrências pendentes
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
// @desc    Listar contas dos próximos 7 dias (incluindo recorrências)
router.get('/upcoming', async (req, res) => {
  try {
    const today = new Date()
    const currentMonth = today.getUTCMonth() + 1
    const currentYear = today.getUTCFullYear()

    // Buscar bills pendentes do mês atual
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
    }).map(b => ({
      ...b.toObject(),
      isFromRecurring: false
    }))

    // Buscar recorrências ativas que vencem nos próximos 7 dias
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0))
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999))

    const recurrings = await Recurring.find({
      user: req.user._id,
      type: 'expense',
      isActive: true,
      startDate: { $lte: endOfMonth },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: startOfMonth } }
      ]
    }).populate('account', 'name color')

    // Converter recorrências para formato de bill e filtrar as dos próximos 7 dias
    const upcomingRecurrings = recurrings.map(r => {
      let dueDay = r.dayOfMonth || new Date(r.startDate).getUTCDate()
      const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()
      if (dueDay > lastDayOfMonth) dueDay = lastDayOfMonth

      const dueDate = new Date(Date.UTC(currentYear, currentMonth - 1, dueDay, 12, 0, 0))
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

      // Verificar se já foi paga neste mês
      let isPaidThisMonth = false
      if (r.lastGeneratedDate) {
        const lastGenDate = new Date(r.lastGeneratedDate)
        isPaidThisMonth = lastGenDate.getUTCMonth() + 1 === currentMonth &&
                          lastGenDate.getUTCFullYear() === currentYear
      }

      let urgency = 'normal'
      if (daysUntilDue < 0) urgency = 'overdue'
      else if (daysUntilDue === 0) urgency = 'today'
      else if (daysUntilDue <= 3) urgency = 'soon'
      else if (daysUntilDue <= 7) urgency = 'upcoming'

      return {
        _id: r._id,
        name: r.isInstallment ? `${r.name} (${r.currentInstallment}/${r.totalInstallments})` : r.name,
        category: r.category,
        amount: r.amount,
        dueDay,
        isRecurring: true,
        isPaid: isPaidThisMonth,
        isFromRecurring: true,
        recurringId: r._id,
        account: r.account,
        urgency,
        daysUntilDue
      }
    }).filter(r => !r.isPaid && r.daysUntilDue <= 7) // Apenas pendentes dos próximos 7 dias

    // Combinar e ordenar
    const allUpcoming = [...upcomingBills, ...upcomingRecurrings]
    allUpcoming.sort((a, b) => a.dueDay - b.dueDay)

    res.json({ bills: allUpcoming })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar contas', error: error.message })
  }
})

// @route   GET /api/bills/summary
// @desc    Resumo das contas do mês (incluindo recorrências)
router.get('/summary', async (req, res) => {
  try {
    const { month, year } = req.query
    // Usar UTC para consistência com datas armazenadas no banco
    const currentMonth = month ? parseInt(month) : new Date().getUTCMonth() + 1
    const currentYear = year ? parseInt(year) : new Date().getUTCFullYear()

    const bills = await Bill.find({
      user: req.user._id,
      currentMonth,
      currentYear
    })

    // Buscar recorrências do tipo expense que se aplicam ao mês selecionado
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0))
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999))

    const recurrings = await Recurring.find({
      user: req.user._id,
      type: 'expense',
      isActive: true,
      startDate: { $lte: endOfMonth },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: startOfMonth } }
      ]
    })

    const today = new Date()

    // Processar recorrências para verificar se já foram pagas neste mês
    const processedRecurrings = recurrings.map(r => {
      let isPaidThisMonth = false

      // Para parcelamentos, verificar se a parcela deste mês já foi paga
      if (r.isInstallment) {
        const startDate = new Date(r.startDate)
        const startMonth = startDate.getUTCMonth() + 1
        const startYear = startDate.getUTCFullYear()
        const monthsDiff = (currentYear - startYear) * 12 + (currentMonth - startMonth)
        const installmentForThisMonth = monthsDiff + 1

        // Se parcela fora do período, não incluir
        if (installmentForThisMonth < 1 || installmentForThisMonth > r.totalInstallments) {
          return null
        }

        // Parcela está paga se currentInstallment > installmentForThisMonth
        isPaidThisMonth = r.currentInstallment > installmentForThisMonth
      } else {
        // Para recorrências normais
        if (r.lastGeneratedDate) {
          const lastGenDate = new Date(r.lastGeneratedDate)
          isPaidThisMonth = lastGenDate.getUTCMonth() + 1 === currentMonth &&
                            lastGenDate.getUTCFullYear() === currentYear
        }
      }

      // Calcular dia de vencimento para este mês
      let dueDay = r.dayOfMonth || new Date(r.startDate).getUTCDate()
      const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()
      if (dueDay > lastDayOfMonth) dueDay = lastDayOfMonth

      const dueDate = new Date(Date.UTC(currentYear, currentMonth - 1, dueDay, 12, 0, 0))
      const isOverdue = !isPaidThisMonth && dueDate < today

      return { ...r.toObject(), isPaidThisMonth, isOverdue }
    }).filter(r => r !== null)

    // Calcular totais das bills
    const billsTotal = bills.reduce((sum, b) => sum + b.amount, 0)
    const billsPaid = bills.filter(b => b.isPaid).reduce((sum, b) => sum + b.amount, 0)

    // Calcular totais das recorrências
    const recurringTotal = processedRecurrings.reduce((sum, r) => sum + r.amount, 0)
    const recurringPaid = processedRecurrings.filter(r => r.isPaidThisMonth).reduce((sum, r) => sum + r.amount, 0)
    const recurringOverdue = processedRecurrings.filter(r => r.isOverdue).length

    // Totais combinados
    const total = billsTotal + recurringTotal
    const paid = billsPaid + recurringPaid
    const pending = total - paid
    const paidCount = bills.filter(b => b.isPaid).length + processedRecurrings.filter(r => r.isPaidThisMonth).length
    const pendingCount = bills.filter(b => !b.isPaid).length + processedRecurrings.filter(r => !r.isPaidThisMonth).length
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

    // Validações básicas
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nome é obrigatório' })
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Valor deve ser um número maior que zero' })
    }
    if (!dueDay || isNaN(parseInt(dueDay)) || parseInt(dueDay) < 1 || parseInt(dueDay) > 31) {
      return res.status(400).json({ message: 'Dia de vencimento deve ser entre 1 e 31' })
    }

    const now = new Date()
    const bill = await Bill.create({
      user: req.user._id,
      name: name.trim(),
      category,
      amount: parseFloat(amount),
      dueDay: parseInt(dueDay),
      isRecurring,
      notes,
      currentMonth: now.getUTCMonth() + 1,
      currentYear: now.getUTCFullYear()
    })

    res.status(201).json({ bill })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar conta', error: error.message })
  }
})

// @route   PUT /api/bills/:id
// @desc    Atualizar conta
router.put('/:id', validateObjectId(), async (req, res) => {
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
router.post('/:id/pay', validateObjectId(), async (req, res) => {
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
router.post('/:id/renew', validateObjectId(), async (req, res) => {
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
router.delete('/:id', validateObjectId(), async (req, res) => {
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
