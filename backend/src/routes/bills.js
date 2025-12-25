const express = require('express')
const router = express.Router()
const Bill = require('../models/Bill')
const Recurring = require('../models/Recurring')
const Transaction = require('../models/Transaction')
const RecurringPayment = require('../models/RecurringPayment')
const RecurringOverride = require('../models/RecurringOverride')
const { protect, validateObjectId } = require('../middleware/auth')

// Função auxiliar para calcular urgência baseada na semana calendário
// Semana útil: Segunda (1) a Domingo (0)
function calculateUrgency(dueDate, isPaid) {
  if (isPaid) return 'paid'

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())

  const daysUntilDue = Math.ceil((dueDateStart - todayStart) / (1000 * 60 * 60 * 24))

  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue === 0) return 'today'
  if (daysUntilDue <= 3) return 'soon'

  // Calcular fim da semana atual (próximo domingo)
  const dayOfWeek = today.getDay() // 0 = domingo, 1 = segunda, etc.
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek

  // Se vence até o domingo desta semana = "Esta semana"
  if (daysUntilDue <= daysUntilSunday) return 'upcoming'

  // Próxima semana (segunda a domingo que vem)
  if (daysUntilDue <= daysUntilSunday + 7) return 'next_week'

  return 'normal'
}

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
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0))
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999))

    // Buscar todas as recorrências ativas que começaram antes ou durante o mês selecionado
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

    // Buscar pagamentos já realizados para este mês/ano
    const payments = await RecurringPayment.find({
      user: req.user._id,
      month: currentMonth,
      year: currentYear
    })

    // Buscar sobrescritas para este mês/ano
    const overrides = await RecurringOverride.find({
      user: req.user._id,
      month: currentMonth,
      year: currentYear
    })

    // Criar um Map com sobrescritas por recorrência
    const overridesMap = new Map()
    overrides.forEach(o => {
      overridesMap.set(o.recurring.toString(), o)
    })

    // Criar um Map com pagamentos por recorrência e dia
    const paidRecurringMap = new Map()
    payments.forEach(p => {
      const key = `${p.recurring.toString()}_${p.paidAt ? new Date(p.paidAt).getUTCDate() : 0}`
      paidRecurringMap.set(key, true)
      // Também marcar por recurring ID simples para compatibilidade
      paidRecurringMap.set(p.recurring.toString(), true)
    })

    // Converter recorrências para formato de bill
    const recurringBills = []

    recurrings.forEach(r => {
      const recurringStartDate = new Date(r.startDate)
      const recurringStartMonth = recurringStartDate.getUTCMonth() + 1
      const recurringStartYear = recurringStartDate.getUTCFullYear()
      const recurringEndDate = r.endDate ? new Date(r.endDate) : null

      // Se a recorrência começa depois do mês atual, não mostrar
      if (recurringStartYear > currentYear ||
          (recurringStartYear === currentYear && recurringStartMonth > currentMonth)) {
        return
      }

      const today = new Date()
      const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()

      if (r.frequency === 'weekly') {
        // Para recorrências semanais, gerar todas as ocorrências do mês
        const dayOfWeek = r.dayOfWeek !== undefined ? r.dayOfWeek : recurringStartDate.getUTCDay()

        // Encontrar o primeiro dia do mês que corresponde ao dia da semana
        const firstOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 12, 0, 0))
        const firstDayOfWeek = firstOfMonth.getUTCDay()
        let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7
        let currentDay = 1 + daysToAdd

        let weekNumber = 1
        while (currentDay <= lastDayOfMonth) {
          const dueDate = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay, 12, 0, 0))

          // Verificar se esta data está dentro do período da recorrência
          if (dueDate >= recurringStartDate && (!recurringEndDate || dueDate <= recurringEndDate)) {
            const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

            // Verificar se esta semana específica foi paga
            const paymentKey = `${r._id.toString()}_${currentDay}`
            const isPaidThisWeek = paidRecurringMap.has(paymentKey)

            // Usar função de urgência baseada na semana calendário
            const urgency = calculateUrgency(dueDate, isPaidThisWeek)

            recurringBills.push({
              _id: `${r._id}_week${weekNumber}`,
              name: `${r.name} (Sem ${weekNumber})`,
              category: r.category,
              amount: r.amount,
              dueDay: currentDay,
              isRecurring: true,
              isPaid: isPaidThisWeek,
              isFromRecurring: true,
              recurringId: r._id,
              account: r.account,
              urgency,
              daysUntilDue,
              nextDueDate: dueDate,
              isInstallment: false,
              frequency: 'weekly',
              weekNumber
            })
          }

          currentDay += 7
          weekNumber++
        }
      } else {
        // Para recorrências mensais (código original)
        let dueDay = r.dayOfMonth || recurringStartDate.getUTCDate()

        // Ajustar para o último dia do mês se necessário
        if (dueDay > lastDayOfMonth) {
          dueDay = lastDayOfMonth
        }

        const dueDate = new Date(Date.UTC(currentYear, currentMonth - 1, dueDay, 12, 0, 0))
        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

        // Para parcelamentos, calcular qual parcela corresponde ao mês selecionado
        let installmentForThisMonth = 1
        if (r.isInstallment) {
          const monthsDiff = (currentYear - recurringStartYear) * 12 + (currentMonth - recurringStartMonth)
          installmentForThisMonth = monthsDiff + 1

          if (installmentForThisMonth > r.totalInstallments || installmentForThisMonth < 1) {
            return
          }
        }

        // Verificar se foi pago usando a tabela RecurringPayment
        const isPaidThisMonth = paidRecurringMap.has(r._id.toString())

        // Verificar se há sobrescrita para este mês
        const override = overridesMap.get(r._id.toString())
        const finalAmount = override?.amount ?? r.amount
        const finalName = override?.name ?? r.name

        // Usar função de urgência baseada na semana calendário
        const urgency = calculateUrgency(dueDate, isPaidThisMonth)

        recurringBills.push({
          _id: r._id,
          name: r.isInstallment ? `${finalName} (${installmentForThisMonth}/${r.totalInstallments})` : finalName,
          category: r.category,
          amount: finalAmount,
          originalAmount: r.amount, // Guardar valor original para referência
          hasOverride: !!override, // Indicar se tem sobrescrita
          dueDay: dueDay,
          isRecurring: true,
          isPaid: isPaidThisMonth,
          isFromRecurring: true,
          recurringId: r._id,
          account: r.account,
          urgency,
          daysUntilDue,
          nextDueDate: dueDate,
          isInstallment: r.isInstallment,
          currentInstallment: installmentForThisMonth,
          totalInstallments: r.totalInstallments
        })
      }
    })

    // Filtrar por status se necessário
    let filteredRecurringBills = recurringBills
    if (status === 'paid') {
      filteredRecurringBills = recurringBills.filter(b => b.isPaid)
    } else if (status === 'pending') {
      filteredRecurringBills = recurringBills.filter(b => !b.isPaid)
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

    // Buscar pagamentos já realizados para este mês/ano usando RecurringPayment
    const payments = await RecurringPayment.find({
      user: req.user._id,
      month: currentMonth,
      year: currentYear
    })

    // Criar um Set com IDs das recorrências já pagas neste mês
    const paidRecurringIds = new Set(payments.map(p => p.recurring.toString()))

    // Converter recorrências para formato de bill e filtrar as dos próximos 7 dias
    const upcomingRecurrings = recurrings.map(r => {
      let dueDay = r.dayOfMonth || new Date(r.startDate).getUTCDate()
      const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()
      if (dueDay > lastDayOfMonth) dueDay = lastDayOfMonth

      const dueDate = new Date(Date.UTC(currentYear, currentMonth - 1, dueDay, 12, 0, 0))
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

      // Verificar se foi pago usando a tabela RecurringPayment
      const isPaidThisMonth = paidRecurringIds.has(r._id.toString())

      // Usar função de urgência baseada na semana calendário
      const urgency = calculateUrgency(dueDate, isPaidThisMonth)

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

    // Buscar pagamentos já realizados para este mês/ano usando RecurringPayment
    const payments = await RecurringPayment.find({
      user: req.user._id,
      month: currentMonth,
      year: currentYear
    })

    // Criar um Set com IDs das recorrências já pagas neste mês
    const paidRecurringIds = new Set(payments.map(p => p.recurring.toString()))

    const today = new Date()

    // Processar recorrências para verificar se já foram pagas neste mês
    const processedRecurrings = recurrings.map(r => {
      // Verificar se a recorrência começou antes ou durante este mês
      const recurringStartDate = new Date(r.startDate)
      const recurringStartMonth = recurringStartDate.getUTCMonth() + 1
      const recurringStartYear = recurringStartDate.getUTCFullYear()

      // Se a recorrência começa depois do mês atual, não incluir
      if (recurringStartYear > currentYear ||
          (recurringStartYear === currentYear && recurringStartMonth > currentMonth)) {
        return null
      }

      // Para parcelamentos, verificar se a parcela deste mês está dentro do período
      if (r.isInstallment) {
        const monthsDiff = (currentYear - recurringStartYear) * 12 + (currentMonth - recurringStartMonth)
        const installmentForThisMonth = monthsDiff + 1

        // Se parcela fora do período, não incluir
        if (installmentForThisMonth < 1 || installmentForThisMonth > r.totalInstallments) {
          return null
        }
      }

      // Verificar se foi pago usando a tabela RecurringPayment
      const isPaidThisMonth = paidRecurringIds.has(r._id.toString())

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
      totalCount: bills.length + processedRecurrings.length
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
// @desc    Atualizar conta (apenas para bills diretas, não recorrências)
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

// @route   PUT /api/bills/:id/override
// @desc    Criar/atualizar sobrescrita de valor para um mês específico (apenas para recorrências)
//          Isso permite alterar o valor de uma conta apenas para aquele mês, sem afetar outros meses
router.put('/:id/override', validateObjectId(), async (req, res) => {
  try {
    const { month, year, amount, name, notes } = req.body

    if (!month || !year) {
      return res.status(400).json({ message: 'Mês e ano são obrigatórios' })
    }

    // Verificar se a recorrência existe
    const recurring = await Recurring.findOne({ _id: req.params.id, user: req.user._id })

    if (!recurring) {
      return res.status(404).json({ message: 'Recorrência não encontrada' })
    }

    // Criar ou atualizar a sobrescrita
    const override = await RecurringOverride.findOneAndUpdate(
      {
        user: req.user._id,
        recurring: req.params.id,
        month: parseInt(month),
        year: parseInt(year)
      },
      {
        user: req.user._id,
        recurring: req.params.id,
        month: parseInt(month),
        year: parseInt(year),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(name !== undefined && { name }),
        ...(notes !== undefined && { notes })
      },
      { upsert: true, new: true }
    )

    res.json({
      message: 'Valor atualizado apenas para este mês',
      override,
      recurring: {
        name: recurring.name,
        originalAmount: recurring.amount
      }
    })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar sobrescrita', error: error.message })
  }
})

// @route   DELETE /api/bills/:id/override
// @desc    Remover sobrescrita e voltar ao valor original da recorrência
router.delete('/:id/override', validateObjectId(), async (req, res) => {
  try {
    const { month, year } = req.body

    if (!month || !year) {
      return res.status(400).json({ message: 'Mês e ano são obrigatórios' })
    }

    const result = await RecurringOverride.findOneAndDelete({
      user: req.user._id,
      recurring: req.params.id,
      month: parseInt(month),
      year: parseInt(year)
    })

    if (!result) {
      return res.status(404).json({ message: 'Sobrescrita não encontrada' })
    }

    res.json({ message: 'Valor restaurado para o original da recorrência' })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao remover sobrescrita', error: error.message })
  }
})

// @route   POST /api/bills/:id/pay
// @desc    Marcar conta como paga e criar transação (funciona para bills e recorrências)
router.post('/:id/pay', validateObjectId(), async (req, res) => {
  try {
    const { isFromRecurring, month, year } = req.body

    // Determinar mês/ano do pagamento (usa o enviado ou o atual)
    const paymentMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const paymentYear = year ? parseInt(year) : new Date().getFullYear()

    // Se for de recorrência
    if (isFromRecurring) {
      const recurring = await Recurring.findOne({ _id: req.params.id, user: req.user._id })

      if (!recurring) {
        return res.status(404).json({ message: 'Recorrência não encontrada' })
      }

      // Verificar se já foi pago neste mês
      const existingPayment = await RecurringPayment.findOne({
        user: req.user._id,
        recurring: recurring._id,
        month: paymentMonth,
        year: paymentYear
      })

      if (existingPayment) {
        return res.status(400).json({ message: 'Esta conta já foi paga neste mês' })
      }

      // Calcular a data da transação (dia de vencimento no mês selecionado)
      const dueDay = recurring.dayOfMonth || new Date(recurring.startDate).getDate()
      const lastDayOfMonth = new Date(paymentYear, paymentMonth, 0).getDate()
      const transactionDate = new Date(paymentYear, paymentMonth - 1, Math.min(dueDay, lastDayOfMonth), 12, 0, 0)

      // Criar transação
      const transaction = await Transaction.create({
        user: req.user._id,
        type: recurring.type,
        category: recurring.category,
        description: recurring.name,
        amount: recurring.amount,
        account: recurring.account,
        date: transactionDate,
        recurringId: recurring._id
      })

      // Registrar o pagamento na tabela RecurringPayment
      const payment = await RecurringPayment.create({
        user: req.user._id,
        recurring: recurring._id,
        month: paymentMonth,
        year: paymentYear,
        transaction: transaction._id,
        amountPaid: recurring.amount
      })

      return res.json({
        payment,
        transaction,
        message: `Conta paga para ${paymentMonth}/${paymentYear}!`
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
