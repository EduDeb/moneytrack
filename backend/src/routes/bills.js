const express = require('express')
const router = express.Router()
const Bill = require('../models/Bill')
const Recurring = require('../models/Recurring')
const Transaction = require('../models/Transaction')
const RecurringPayment = require('../models/RecurringPayment')
const RecurringOverride = require('../models/RecurringOverride')
const { protect, validateObjectId } = require('../middleware/auth')
const { roundMoney, sumMoney, subtractMoney } = require('../utils/moneyHelper')

// Função auxiliar para calcular urgência baseada na semana calendário
// Semana útil: Segunda (1) a Domingo (0)
// CORREÇÃO: Usar UTC consistentemente para evitar problemas de timezone
function calculateUrgency(dueDate, isPaid) {
  if (isPaid) return 'paid'

  const today = new Date()
  // Usar UTC para consistência com datas armazenadas no banco
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const dueDateStart = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()))

  const daysUntilDue = Math.ceil((dueDateStart - todayStart) / (1000 * 60 * 60 * 24))

  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue === 0) return 'today'
  if (daysUntilDue <= 3) return 'soon'

  // Calcular fim da semana atual (próximo domingo) usando UTC
  const dayOfWeek = today.getUTCDay() // 0 = domingo, 1 = segunda, etc.
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
      const recurringKey = p.recurring.toString()

      // Para recorrências semanais, usar dueDay
      if (p.dueDay) {
        const key = `${recurringKey}_${p.dueDay}`
        paidRecurringMap.set(key, true)
        console.log(`[DEBUG PAID] Semanal pago: ${key}`)
      }

      // Sempre marcar por ID também (para mensais e como fallback para semanais antigos)
      // Isso garante que pagamentos antigos sem dueDay não fiquem "perdidos"
      if (!paidRecurringMap.has(recurringKey)) {
        paidRecurringMap.set(recurringKey, {
          paidAt: p.paidAt,
          month: p.month,
          year: p.year
        })
        console.log(`[DEBUG PAID] Mensal/Fallback: ${recurringKey}`)
      }
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
            const recurringKey = r._id.toString()
            const paymentKey = `${recurringKey}_${currentDay}`
            let isPaidThisWeek = paidRecurringMap.has(paymentKey)

            // Fallback: verificar se há pagamento antigo sem dueDay
            // Isso acontece com pagamentos criados antes da correção
            if (!isPaidThisWeek) {
              const fallbackPayment = paidRecurringMap.get(recurringKey)
              if (fallbackPayment && typeof fallbackPayment === 'object' && fallbackPayment.paidAt) {
                // Verificar se o pagamento foi feito próximo ao dia de vencimento desta semana
                const paidDate = new Date(fallbackPayment.paidAt)
                const paidDay = paidDate.getUTCDate()
                // Se foi pago no mesmo dia ou em até 3 dias de diferença, considerar como esta semana
                if (Math.abs(paidDay - currentDay) <= 3) {
                  isPaidThisWeek = true
                  console.log(`[DEBUG CHECK] Fallback match: pago em ${paidDay}, vencimento em ${currentDay}`)
                }
              }
            }

            console.log(`[DEBUG CHECK] Verificando semana: ${paymentKey}, pago: ${isPaidThisWeek}`)

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

        // Se for do tipo 'skip', não mostrar esta conta neste mês
        if (override?.type === 'skip') {
          return
        }

        const finalAmount = override?.amount ?? r.amount
        const finalName = override?.name ?? r.name
        const isPartialPayment = override?.type === 'partial_payment'
        const paidAmount = override?.paidAmount || 0

        // Usar função de urgência baseada na semana calendário
        const urgency = calculateUrgency(dueDate, isPaidThisMonth)

        recurringBills.push({
          _id: r._id,
          name: r.isInstallment ? `${finalName} (${installmentForThisMonth}/${r.totalInstallments})` : finalName,
          category: r.category,
          amount: finalAmount,
          originalAmount: r.amount, // Guardar valor original para referência
          hasOverride: !!override, // Indicar se tem sobrescrita
          overrideType: override?.type, // Tipo de override (custom_amount, partial_payment)
          overrideNotes: override?.notes, // Motivo do desconto/alteração
          isPartialPayment,
          paidAmount, // Quanto já foi pago (para pagamentos parciais)
          remainingAmount: isPartialPayment ? finalAmount : null, // Quanto falta pagar
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
    console.error('[BILLS ERROR] Listar contas:', error.message)
    res.status(500).json({ message: 'Erro ao buscar contas' })
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
    console.error('[BILLS ERROR] Listar próximas:', error.message)
    res.status(500).json({ message: 'Erro ao buscar contas' })
  }
})

// @route   GET /api/bills/summary
// @desc    Resumo das contas do mês (incluindo recorrências e considerando overrides)
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

    // IMPORTANTE: Buscar overrides para considerar skip, descontos e pagamentos parciais
    const overrides = await RecurringOverride.find({
      user: req.user._id,
      month: currentMonth,
      year: currentYear
    })

    // Criar Maps para acesso rápido
    const paidRecurringIds = new Set(payments.map(p => p.recurring.toString()))
    const overridesMap = new Map()
    overrides.forEach(o => overridesMap.set(o.recurring.toString(), o))

    const today = new Date()

    // Processar recorrências considerando overrides
    const processedRecurrings = recurrings.map(r => {
      const recurringStartDate = new Date(r.startDate)
      const recurringStartMonth = recurringStartDate.getUTCMonth() + 1
      const recurringStartYear = recurringStartDate.getUTCFullYear()

      // Se a recorrência começa depois do mês atual, não incluir
      if (recurringStartYear > currentYear ||
          (recurringStartYear === currentYear && recurringStartMonth > currentMonth)) {
        return null
      }

      // Verificar override para este mês
      const override = overridesMap.get(r._id.toString())

      // Se tipo 'skip', NÃO incluir esta recorrência no total
      if (override?.type === 'skip') {
        return null
      }

      // Para parcelamentos, verificar se a parcela deste mês está dentro do período
      if (r.isInstallment) {
        const monthsDiff = (currentYear - recurringStartYear) * 12 + (currentMonth - recurringStartMonth)
        const installmentForThisMonth = monthsDiff + 1

        if (installmentForThisMonth < 1 || installmentForThisMonth > r.totalInstallments) {
          return null
        }
      }

      // Verificar se foi pago usando a tabela RecurringPayment
      const isPaidThisMonth = paidRecurringIds.has(r._id.toString())

      // Calcular valor real considerando override (desconto ou pagamento parcial)
      let finalAmount = r.amount
      if (override) {
        if (override.type === 'custom_amount' && override.amount !== undefined) {
          // Conta com desconto - usar valor do override
          finalAmount = override.amount
        } else if (override.type === 'partial_payment') {
          // Pagamento parcial - usar valor restante
          finalAmount = override.amount || (r.amount - (override.paidAmount || 0))
        }
      }

      // Calcular dia de vencimento para este mês
      let dueDay = r.dayOfMonth || new Date(r.startDate).getUTCDate()
      const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()
      if (dueDay > lastDayOfMonth) dueDay = lastDayOfMonth

      const dueDate = new Date(Date.UTC(currentYear, currentMonth - 1, dueDay, 12, 0, 0))
      const isOverdue = !isPaidThisMonth && dueDate < today

      return {
        ...r.toObject(),
        isPaidThisMonth,
        isOverdue,
        finalAmount,
        hasOverride: !!override,
        overrideType: override?.type
      }
    }).filter(r => r !== null)

    // Calcular totais das bills (usando funções monetárias para precisão)
    const billsTotal = sumMoney(...bills.map(b => b.amount))
    const billsPaid = sumMoney(...bills.filter(b => b.isPaid).map(b => b.amount))

    // Calcular totais das recorrências USANDO O VALOR FINAL (com desconto aplicado)
    const recurringTotal = sumMoney(...processedRecurrings.map(r => r.finalAmount))
    const recurringPaid = sumMoney(...processedRecurrings.filter(r => r.isPaidThisMonth).map(r => r.finalAmount))
    const recurringOverdue = processedRecurrings.filter(r => r.isOverdue).length

    // Totais combinados (usando funções monetárias para precisão)
    const total = sumMoney(billsTotal, recurringTotal)
    const paid = sumMoney(billsPaid, recurringPaid)
    const pending = subtractMoney(total, paid)
    const paidCount = bills.filter(b => b.isPaid).length + processedRecurrings.filter(r => r.isPaidThisMonth).length
    const pendingCount = bills.filter(b => !b.isPaid).length + processedRecurrings.filter(r => !r.isPaidThisMonth).length
    const overdueCount = bills.filter(b => !b.isPaid && b.daysUntilDue < 0).length + recurringOverdue

    // Calcular descontos aplicados (para transparência) - usando função monetária
    const discountsApplied = roundMoney(
      processedRecurrings
        .filter(r => r.hasOverride && r.overrideType === 'custom_amount')
        .reduce((sum, r) => sum + (r.amount - r.finalAmount), 0)
    )

    res.json({
      total,
      paid,
      pending,
      paidCount,
      pendingCount,
      overdueCount,
      totalCount: bills.length + processedRecurrings.length,
      discountsApplied // Valor total de descontos aplicados
    })
  } catch (error) {
    console.error('[BILLS ERROR] Resumo:', error.message)
    res.status(500).json({ message: 'Erro ao buscar resumo' })
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
    console.error('[BILLS ERROR] Criar conta:', error.message)
    res.status(400).json({ message: 'Erro ao criar conta' })
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
    res.status(400).json({ message: 'Erro ao atualizar conta' })
  }
})

// @route   PUT /api/bills/:id/override
// @desc    Criar/atualizar sobrescrita de valor para um mês específico (apenas para recorrências)
//          Isso permite alterar o valor de uma conta apenas para aquele mês, sem afetar outros meses
router.put('/:id/override', async (req, res) => {
  try {
    const { month, year, amount, name, notes, type } = req.body

    // Extrair ID real se for ID virtual de recorrência semanal (formato: xxx_week1)
    let recurringId = req.params.id
    if (req.params.id.includes('_week')) {
      recurringId = req.params.id.split('_week')[0]
    }

    if (!month || !year) {
      return res.status(400).json({ message: 'Mês e ano são obrigatórios' })
    }

    // Verificar se a recorrência existe
    const recurring = await Recurring.findOne({ _id: recurringId, user: req.user._id })

    if (!recurring) {
      return res.status(404).json({ message: 'Recorrência não encontrada' })
    }

    // Criar ou atualizar a sobrescrita
    const override = await RecurringOverride.findOneAndUpdate(
      {
        user: req.user._id,
        recurring: recurringId,
        month: parseInt(month),
        year: parseInt(year)
      },
      {
        user: req.user._id,
        recurring: recurringId,
        month: parseInt(month),
        year: parseInt(year),
        type: type || 'custom_amount',
        originalAmount: recurring.amount,
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
    res.status(400).json({ message: 'Erro ao criar sobrescrita' })
  }
})

// @route   POST /api/bills/:id/skip
// @desc    Pular uma conta apenas neste mês específico (não apaga a recorrência)
router.post('/:id/skip', validateObjectId(), async (req, res) => {
  try {
    const { month, year, notes } = req.body

    if (!month || !year) {
      return res.status(400).json({ message: 'Mês e ano são obrigatórios' })
    }

    // Verificar se a recorrência existe
    const recurring = await Recurring.findOne({ _id: req.params.id, user: req.user._id })

    if (!recurring) {
      return res.status(404).json({ message: 'Recorrência não encontrada' })
    }

    // Criar sobrescrita do tipo 'skip'
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
        type: 'skip',
        originalAmount: recurring.amount,
        amount: 0,
        notes: notes || 'Mês pulado'
      },
      { upsert: true, new: true }
    )

    res.json({
      message: `${recurring.name} pulada para ${month}/${year}. Ela continuará aparecendo nos outros meses.`,
      override
    })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao pular conta' })
  }
})

// @route   POST /api/bills/:id/pay-with-discount
// @desc    Pagar conta com desconto apenas neste mês
router.post('/:id/pay-with-discount', validateObjectId(), async (req, res) => {
  try {
    const { month, year, discountAmount, notes } = req.body

    if (!month || !year) {
      return res.status(400).json({ message: 'Mês e ano são obrigatórios' })
    }

    if (!discountAmount || isNaN(parseFloat(discountAmount)) || parseFloat(discountAmount) <= 0) {
      return res.status(400).json({ message: 'Valor do desconto deve ser maior que zero' })
    }

    // Verificar se a recorrência existe
    const recurring = await Recurring.findOne({ _id: req.params.id, user: req.user._id })

    if (!recurring) {
      return res.status(404).json({ message: 'Recorrência não encontrada' })
    }

    const finalAmount = recurring.amount - parseFloat(discountAmount)
    if (finalAmount < 0) {
      return res.status(400).json({ message: 'Desconto não pode ser maior que o valor da conta' })
    }

    // Verificar se já foi pago neste mês
    const existingPayment = await RecurringPayment.findOne({
      user: req.user._id,
      recurring: recurring._id,
      month: parseInt(month),
      year: parseInt(year)
    })

    if (existingPayment) {
      return res.status(400).json({ message: 'Esta conta já foi paga neste mês' })
    }

    // Criar sobrescrita com o valor com desconto
    await RecurringOverride.findOneAndUpdate(
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
        type: 'custom_amount',
        originalAmount: recurring.amount,
        amount: finalAmount,
        notes: notes || `Desconto de R$ ${parseFloat(discountAmount).toFixed(2)}`
      },
      { upsert: true, new: true }
    )

    // Calcular a data da transação
    const dueDay = recurring.dayOfMonth || new Date(recurring.startDate).getDate()
    const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0).getDate()
    const transactionDate = new Date(parseInt(year), parseInt(month) - 1, Math.min(dueDay, lastDayOfMonth), 12, 0, 0)

    // Criar transação com o valor final (com desconto)
    const transaction = await Transaction.create({
      user: req.user._id,
      type: recurring.type,
      category: recurring.category,
      description: `${recurring.name} (com desconto)`,
      amount: finalAmount,
      account: recurring.account,
      date: transactionDate,
      recurringId: recurring._id
    })

    // Registrar o pagamento
    const payment = await RecurringPayment.create({
      user: req.user._id,
      recurring: recurring._id,
      month: parseInt(month),
      year: parseInt(year),
      transaction: transaction._id,
      amountPaid: finalAmount
    })

    res.json({
      message: `Conta paga com desconto de R$ ${parseFloat(discountAmount).toFixed(2)}`,
      payment,
      transaction,
      originalAmount: recurring.amount,
      finalAmount
    })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao pagar com desconto' })
  }
})

// @route   POST /api/bills/:id/pay-partial
// @desc    Registrar pagamento parcial de uma conta
router.post('/:id/pay-partial', validateObjectId(), async (req, res) => {
  try {
    const { month, year, paidAmount, notes } = req.body

    if (!month || !year) {
      return res.status(400).json({ message: 'Mês e ano são obrigatórios' })
    }

    if (!paidAmount || isNaN(parseFloat(paidAmount)) || parseFloat(paidAmount) <= 0) {
      return res.status(400).json({ message: 'Valor pago deve ser maior que zero' })
    }

    // Verificar se a recorrência existe
    const recurring = await Recurring.findOne({ _id: req.params.id, user: req.user._id })

    if (!recurring) {
      return res.status(404).json({ message: 'Recorrência não encontrada' })
    }

    // Verificar se já existe um override para este mês
    let override = await RecurringOverride.findOne({
      user: req.user._id,
      recurring: req.params.id,
      month: parseInt(month),
      year: parseInt(year)
    })

    const previousPaid = override?.paidAmount || 0
    const totalPaid = previousPaid + parseFloat(paidAmount)
    const originalAmount = override?.originalAmount || recurring.amount
    const remaining = originalAmount - totalPaid

    if (totalPaid > originalAmount) {
      return res.status(400).json({
        message: `Valor total pago (R$ ${totalPaid.toFixed(2)}) excede o valor da conta (R$ ${originalAmount.toFixed(2)})`
      })
    }

    // Criar ou atualizar sobrescrita do tipo 'partial_payment'
    override = await RecurringOverride.findOneAndUpdate(
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
        type: 'partial_payment',
        originalAmount: originalAmount,
        paidAmount: totalPaid,
        amount: remaining,
        notes: notes || `Pagamento parcial: R$ ${totalPaid.toFixed(2)} de R$ ${originalAmount.toFixed(2)}`
      },
      { upsert: true, new: true }
    )

    // Calcular a data da transação
    const dueDay = recurring.dayOfMonth || new Date(recurring.startDate).getDate()
    const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0).getDate()
    const transactionDate = new Date(parseInt(year), parseInt(month) - 1, Math.min(dueDay, lastDayOfMonth), 12, 0, 0)

    // Criar transação do pagamento parcial
    const transaction = await Transaction.create({
      user: req.user._id,
      type: recurring.type,
      category: recurring.category,
      description: `${recurring.name} (pagamento parcial)`,
      amount: parseFloat(paidAmount),
      account: recurring.account,
      date: transactionDate,
      recurringId: recurring._id
    })

    // Se pagou tudo, registrar como pagamento completo
    if (remaining <= 0) {
      await RecurringPayment.findOneAndUpdate(
        {
          user: req.user._id,
          recurring: recurring._id,
          month: parseInt(month),
          year: parseInt(year)
        },
        {
          user: req.user._id,
          recurring: recurring._id,
          month: parseInt(month),
          year: parseInt(year),
          transaction: transaction._id,
          amountPaid: totalPaid
        },
        { upsert: true, new: true }
      )
    }

    res.json({
      message: remaining > 0
        ? `Pagamento parcial registrado. Faltam R$ ${remaining.toFixed(2)}`
        : 'Conta totalmente paga!',
      override,
      transaction,
      totalPaid,
      remaining,
      isFullyPaid: remaining <= 0
    })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao registrar pagamento parcial' })
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
    res.status(400).json({ message: 'Erro ao remover sobrescrita' })
  }
})

// @route   POST /api/bills/:id/pay
// @desc    Marcar conta como paga e criar transação (funciona para bills e recorrências)
router.post('/:id/pay', async (req, res) => {
  try {
    const { isFromRecurring, month, year, dueDay } = req.body

    console.log(`[DEBUG PAY] Recebido: id=${req.params.id}, isFromRecurring=${isFromRecurring}, month=${month}, year=${year}, dueDay=${dueDay}`)

    // Determinar mês/ano do pagamento (usa o enviado ou o atual)
    const paymentMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const paymentYear = year ? parseInt(year) : new Date().getFullYear()

    // Extrair ID real se for ID virtual de recorrência semanal (formato: xxx_week1)
    let recurringId = req.params.id
    let weekNumber = null
    if (req.params.id.includes('_week')) {
      const parts = req.params.id.split('_week')
      recurringId = parts[0]
      weekNumber = parseInt(parts[1])
      console.log(`[DEBUG PAY] Semanal detectado: recurringId=${recurringId}, weekNumber=${weekNumber}`)
    }

    // Se for de recorrência
    if (isFromRecurring) {
      const recurring = await Recurring.findOne({ _id: recurringId, user: req.user._id })

      if (!recurring) {
        return res.status(404).json({ message: 'Recorrência não encontrada' })
      }

      // Para recorrências semanais, verificar pagamento por dia específico
      // Para mensais, verificar por mês
      const paymentQuery = {
        user: req.user._id,
        recurring: recurring._id,
        month: paymentMonth,
        year: paymentYear
      }

      // Se for semanal, adicionar o dia do vencimento na query
      if (weekNumber && dueDay) {
        paymentQuery.dueDay = parseInt(dueDay)
      }

      const existingPayment = await RecurringPayment.findOne(paymentQuery)

      if (existingPayment) {
        return res.status(400).json({ message: 'Esta conta já foi paga' })
      }

      // Data da transação = HOJE (quando o pagamento foi feito)
      const transactionDate = new Date()

      // dueDay é usado apenas para identificar qual semana foi paga, não afeta a data da transação

      // Descrição inclui número da semana se for semanal
      const description = weekNumber
        ? `${recurring.name} (Sem ${weekNumber})`
        : recurring.name

      // Criar transação
      const transaction = await Transaction.create({
        user: req.user._id,
        type: recurring.type,
        category: recurring.category,
        description: description,
        amount: recurring.amount,
        account: recurring.account,
        date: transactionDate,
        recurringId: recurring._id
      })

      // Registrar o pagamento na tabela RecurringPayment
      const paymentData = {
        user: req.user._id,
        recurring: recurring._id,
        month: paymentMonth,
        year: paymentYear,
        transaction: transaction._id,
        amountPaid: recurring.amount,
        paidAt: transactionDate
      }

      // Adicionar dueDay para recorrências semanais
      if (weekNumber && dueDay) {
        paymentData.dueDay = parseInt(dueDay)
      }

      console.log(`[DEBUG SAVE] Salvando pagamento:`, JSON.stringify(paymentData, null, 2))
      const payment = await RecurringPayment.create(paymentData)
      console.log(`[DEBUG SAVE] Pagamento criado com ID: ${payment._id}, dueDay: ${payment.dueDay}`)

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
    res.status(400).json({ message: 'Erro ao pagar conta' })
  }
})

// @route   POST /api/bills/:id/unpay
// @desc    Cancelar pagamento de uma conta (desfazer)
router.post('/:id/unpay', async (req, res) => {
  try {
    const { isFromRecurring, month, year, dueDay } = req.body

    // Determinar mês/ano do pagamento
    const paymentMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const paymentYear = year ? parseInt(year) : new Date().getFullYear()

    // Extrair ID real se for ID virtual de recorrência semanal
    let recurringId = req.params.id
    let weekNumber = null
    if (req.params.id.includes('_week')) {
      const parts = req.params.id.split('_week')
      recurringId = parts[0]
      weekNumber = parseInt(parts[1])
    }

    // Se for de recorrência
    if (isFromRecurring) {
      // Query para encontrar o pagamento
      const paymentQuery = {
        user: req.user._id,
        recurring: recurringId,
        month: paymentMonth,
        year: paymentYear
      }

      // Para semanais, incluir dueDay na query
      if (weekNumber && dueDay) {
        paymentQuery.dueDay = parseInt(dueDay)
      }

      // Buscar e remover o pagamento da tabela RecurringPayment
      const payment = await RecurringPayment.findOneAndDelete(paymentQuery)

      if (!payment) {
        return res.status(404).json({ message: 'Pagamento não encontrado para este mês' })
      }

      // Remover a transação associada, se existir
      if (payment.transaction) {
        await Transaction.findByIdAndDelete(payment.transaction)
      }

      return res.json({
        message: `Pagamento de ${paymentMonth}/${paymentYear} cancelado com sucesso`,
        deletedPayment: payment
      })
    }

    // Fluxo normal para bills
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user._id })

    if (!bill) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    if (!bill.isPaid) {
      return res.status(400).json({ message: 'Esta conta já está pendente' })
    }

    bill.isPaid = false
    bill.paidAt = null
    await bill.save()

    res.json({ bill, message: 'Pagamento cancelado com sucesso!' })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao cancelar pagamento' })
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
    res.status(400).json({ message: 'Erro ao renovar conta' })
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
    res.status(500).json({ message: 'Erro ao excluir conta' })
  }
})

// @route   POST /api/bills/:id/fix-payment
// @desc    Corrigir pagamento existente (atualizar dueDay)
router.post('/:id/fix-payment', async (req, res) => {
  try {
    const { month, year, dueDay } = req.body

    // Extrair ID real se for ID virtual de recorrência semanal
    let recurringId = req.params.id
    if (req.params.id.includes('_week')) {
      const parts = req.params.id.split('_week')
      recurringId = parts[0]
    }

    const paymentMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const paymentYear = year ? parseInt(year) : new Date().getFullYear()

    // Buscar pagamento existente
    const payment = await RecurringPayment.findOne({
      user: req.user._id,
      recurring: recurringId,
      month: paymentMonth,
      year: paymentYear
    })

    if (!payment) {
      return res.status(404).json({ message: 'Pagamento não encontrado para este mês' })
    }

    // Atualizar dueDay se fornecido
    if (dueDay) {
      payment.dueDay = parseInt(dueDay)
      await payment.save()
    }

    res.json({
      message: 'Pagamento corrigido',
      payment: {
        _id: payment._id,
        recurring: payment.recurring,
        month: payment.month,
        year: payment.year,
        dueDay: payment.dueDay,
        amountPaid: payment.amountPaid,
        paidAt: payment.paidAt
      }
    })
  } catch (error) {
    console.error('[FIX PAYMENT ERROR]', error)
    res.status(500).json({ error: error.message })
  }
})

// @route   DELETE /api/bills/:id/delete-payment
// @desc    Deletar pagamento para poder pagar novamente
router.delete('/:id/delete-payment', async (req, res) => {
  try {
    const { month, year } = req.body

    // Extrair ID real se for ID virtual
    let recurringId = req.params.id
    if (req.params.id.includes('_week')) {
      const parts = req.params.id.split('_week')
      recurringId = parts[0]
    }

    const paymentMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const paymentYear = year ? parseInt(year) : new Date().getFullYear()

    // Deletar pagamento
    const payment = await RecurringPayment.findOneAndDelete({
      user: req.user._id,
      recurring: recurringId,
      month: paymentMonth,
      year: paymentYear
    })

    if (!payment) {
      return res.status(404).json({ message: 'Pagamento não encontrado' })
    }

    // Deletar transação associada se existir
    if (payment.transaction) {
      await Transaction.findByIdAndDelete(payment.transaction)
    }

    res.json({ message: 'Pagamento deletado. Você pode pagar novamente.' })
  } catch (error) {
    console.error('[DELETE PAYMENT ERROR]', error)
    res.status(500).json({ error: error.message })
  }
})

// @route   POST /api/bills/diagnose
// @desc    Diagnosticar problema com uma conta específica
router.post('/diagnose', async (req, res) => {
  try {
    const { recurringId } = req.body

    let realId = recurringId
    if (recurringId && recurringId.includes('_week')) {
      realId = recurringId.split('_week')[0]
    }

    // Buscar a recorrência
    const recurring = await Recurring.findOne({
      _id: realId,
      user: req.user._id
    })

    // Buscar TODOS os pagamentos desta recorrência
    const allPayments = await RecurringPayment.find({
      user: req.user._id,
      recurring: realId
    })

    // Buscar overrides
    const overrides = await RecurringOverride.find({
      user: req.user._id,
      recurring: realId
    })

    // Buscar transações relacionadas
    const transactions = await Transaction.find({
      user: req.user._id,
      recurringId: realId
    }).sort({ date: -1 }).limit(10)

    res.json({
      recurring: recurring ? {
        _id: recurring._id,
        name: recurring.name,
        frequency: recurring.frequency,
        amount: recurring.amount,
        isActive: recurring.isActive,
        startDate: recurring.startDate,
        dayOfWeek: recurring.dayOfWeek
      } : null,
      payments: allPayments.map(p => ({
        _id: p._id,
        month: p.month,
        year: p.year,
        dueDay: p.dueDay,
        amountPaid: p.amountPaid,
        paidAt: p.paidAt
      })),
      overrides: overrides.map(o => ({
        _id: o._id,
        month: o.month,
        year: o.year,
        type: o.type,
        amount: o.amount
      })),
      recentTransactions: transactions.map(t => ({
        _id: t._id,
        description: t.description,
        amount: t.amount,
        date: t.date
      }))
    })
  } catch (error) {
    console.error('[DIAGNOSE ERROR]', error)
    res.status(500).json({ error: error.message })
  }
})

// @route   POST /api/bills/nuke-recurring
// @desc    Deletar TUDO relacionado a uma recorrência em um mês específico
router.post('/nuke-recurring', async (req, res) => {
  try {
    const { recurringId, month, year } = req.body

    let realId = recurringId
    if (recurringId && recurringId.includes('_week')) {
      realId = recurringId.split('_week')[0]
    }

    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    const results = {
      paymentsDeleted: 0,
      overridesDeleted: 0,
      transactionsDeleted: 0
    }

    // Deletar pagamentos
    const payments = await RecurringPayment.find({
      user: req.user._id,
      recurring: realId,
      month: targetMonth,
      year: targetYear
    })

    for (const p of payments) {
      if (p.transaction) {
        await Transaction.findByIdAndDelete(p.transaction)
        results.transactionsDeleted++
      }
      await RecurringPayment.findByIdAndDelete(p._id)
      results.paymentsDeleted++
    }

    // Deletar overrides
    const deleteOverrides = await RecurringOverride.deleteMany({
      user: req.user._id,
      recurring: realId,
      month: targetMonth,
      year: targetYear
    })
    results.overridesDeleted = deleteOverrides.deletedCount

    // Criar override de skip para esconder este mês
    await RecurringOverride.create({
      user: req.user._id,
      recurring: realId,
      month: targetMonth,
      year: targetYear,
      type: 'skip',
      originalAmount: 0,
      amount: 0,
      notes: 'Removido via nuke'
    })

    res.json({
      message: 'Recorrência removida de ' + targetMonth + '/' + targetYear,
      results,
      skipped: true
    })
  } catch (error) {
    console.error('[NUKE ERROR]', error)
    res.status(500).json({ error: error.message })
  }
})

// @route   POST /api/bills/force-delete-payment
// @desc    Forçar exclusão de pagamento por recurringId (para casos problemáticos)
router.post('/force-delete-payment', async (req, res) => {
  try {
    const { recurringId, month, year } = req.body

    if (!recurringId) {
      return res.status(400).json({ message: 'recurringId é obrigatório' })
    }

    // Extrair ID real se for virtual
    let realId = recurringId
    if (recurringId.includes('_week')) {
      realId = recurringId.split('_week')[0]
    }

    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    // Buscar TODOS os pagamentos para este recurring neste mês
    const payments = await RecurringPayment.find({
      user: req.user._id,
      recurring: realId,
      month: targetMonth,
      year: targetYear
    })

    if (payments.length === 0) {
      return res.json({
        message: 'Nenhum pagamento encontrado para deletar',
        recurringId: realId,
        month: targetMonth,
        year: targetYear
      })
    }

    // Deletar todos os pagamentos encontrados
    const deleted = []
    for (const payment of payments) {
      // Deletar transação associada
      if (payment.transaction) {
        await Transaction.findByIdAndDelete(payment.transaction)
      }
      await RecurringPayment.findByIdAndDelete(payment._id)
      deleted.push({
        paymentId: payment._id,
        dueDay: payment.dueDay,
        amountPaid: payment.amountPaid
      })
    }

    res.json({
      message: `${deleted.length} pagamento(s) deletado(s) com sucesso!`,
      deleted,
      recurringId: realId,
      month: targetMonth,
      year: targetYear
    })
  } catch (error) {
    console.error('[FORCE DELETE ERROR]', error)
    res.status(500).json({ error: error.message })
  }
})

// @route   POST /api/bills/fix-all-payments
// @desc    Corrigir todos os pagamentos de recorrências semanais sem dueDay
router.post('/fix-all-payments', async (req, res) => {
  try {
    const { month, year } = req.body
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1
    const targetYear = year ? parseInt(year) : new Date().getFullYear()

    // Buscar todos os pagamentos do mês sem dueDay
    const payments = await RecurringPayment.find({
      user: req.user._id,
      month: targetMonth,
      year: targetYear,
      $or: [{ dueDay: null }, { dueDay: { $exists: false } }]
    }).populate('recurring', 'name frequency startDate dayOfWeek')

    const fixed = []
    const errors = []

    for (const payment of payments) {
      try {
        // Só corrigir se for recorrência semanal
        if (payment.recurring?.frequency === 'weekly') {
          // Usar a data do pagamento para determinar o dueDay
          const paidAt = new Date(payment.paidAt || payment.createdAt)
          const dueDay = paidAt.getUTCDate()

          payment.dueDay = dueDay
          await payment.save()

          fixed.push({
            name: payment.recurring.name,
            dueDay: dueDay,
            paidAt: payment.paidAt
          })
        }
      } catch (err) {
        errors.push({
          paymentId: payment._id,
          error: err.message
        })
      }
    }

    res.json({
      message: `${fixed.length} pagamento(s) corrigido(s)`,
      fixed,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('[FIX ALL PAYMENTS ERROR]', error)
    res.status(500).json({ error: error.message })
  }
})

// @route   GET /api/bills/debug-payments
// @desc    Debug: Ver pagamentos do mês atual
router.get('/debug-payments', async (req, res) => {
  try {
    const { month, year } = req.query
    const currentMonth = month ? parseInt(month) : new Date().getUTCMonth() + 1
    const currentYear = year ? parseInt(year) : new Date().getUTCFullYear()

    const payments = await RecurringPayment.find({
      user: req.user._id,
      month: currentMonth,
      year: currentYear
    }).populate('recurring', 'name frequency dayOfWeek')

    res.json({
      month: currentMonth,
      year: currentYear,
      count: payments.length,
      payments: payments.map(p => ({
        _id: p._id,
        recurringId: p.recurring?._id,
        recurringName: p.recurring?.name,
        frequency: p.recurring?.frequency,
        month: p.month,
        year: p.year,
        dueDay: p.dueDay,
        amountPaid: p.amountPaid,
        paidAt: p.paidAt,
        createdAt: p.createdAt
      }))
    })
  } catch (error) {
    console.error('[DEBUG ERROR]', error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
