const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const Account = require('../models/Account')
const Transaction = require('../models/Transaction')
const { protect, validateObjectId } = require('../middleware/auth')

router.use(protect)

// @route   GET /api/accounts
// @desc    Listar todas as contas do usuário
router.get('/', async (req, res) => {
  try {
    const { includeInactive } = req.query
    const matchQuery = { user: req.user._id }
    if (!includeInactive) matchQuery.isActive = true

    // Usar aggregation com $lookup para evitar N+1 queries
    const accountsWithBalance = await Account.aggregate([
      { $match: matchQuery },
      { $sort: { name: 1 } },
      // Lookup para transações onde esta conta é a origem
      {
        $lookup: {
          from: 'transactions',
          let: { accountId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$account', '$$accountId'] },
                    { $eq: ['$status', 'confirmed'] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                income: {
                  $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
                },
                expense: {
                  $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
                },
                transferOut: {
                  $sum: { $cond: [{ $eq: ['$type', 'transfer'] }, '$amount', 0] }
                },
                count: { $sum: 1 }
              }
            }
          ],
          as: 'outTotals'
        }
      },
      // Lookup para transferências onde esta conta é o destino
      {
        $lookup: {
          from: 'transactions',
          let: { accountId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$toAccount', '$$accountId'] },
                    { $eq: ['$type', 'transfer'] },
                    { $eq: ['$status', 'confirmed'] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                transferIn: { $sum: '$amount' }
              }
            }
          ],
          as: 'inTotals'
        }
      },
      {
        $addFields: {
          outData: { $arrayElemAt: ['$outTotals', 0] },
          inData: { $arrayElemAt: ['$inTotals', 0] }
        }
      },
      {
        $addFields: {
          calculatedBalance: {
            $add: [
              '$initialBalance',
              { $ifNull: ['$outData.income', 0] },
              { $multiply: [{ $ifNull: ['$outData.expense', 0] }, -1] },
              { $multiply: [{ $ifNull: ['$outData.transferOut', 0] }, -1] },
              { $ifNull: ['$inData.transferIn', 0] }
            ]
          },
          transactionCount: { $ifNull: ['$outData.count', 0] }
        }
      },
      {
        $project: {
          outTotals: 0,
          inTotals: 0,
          outData: 0,
          inData: 0
        }
      }
    ])

    res.json({ accounts: accountsWithBalance })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar contas', error: error.message })
  }
})

// @route   GET /api/accounts/summary
// @desc    Resumo de todas as contas
router.get('/summary', async (req, res) => {
  try {
    // Usar aggregation com $lookup para evitar N+1 queries
    const accountsWithBalance = await Account.aggregate([
      { $match: { user: req.user._id, isActive: true } },
      {
        $lookup: {
          from: 'transactions',
          let: { accountId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$account', '$$accountId'] },
                    { $eq: ['$status', 'confirmed'] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                income: {
                  $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
                },
                expense: {
                  $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
                }
              }
            }
          ],
          as: 'totals'
        }
      },
      {
        $addFields: {
          totalsData: { $arrayElemAt: ['$totals', 0] }
        }
      },
      {
        $addFields: {
          balance: {
            $add: [
              '$initialBalance',
              { $ifNull: ['$totalsData.income', 0] },
              { $multiply: [{ $ifNull: ['$totalsData.expense', 0] }, -1] }
            ]
          }
        }
      },
      {
        $project: {
          totals: 0,
          totalsData: 0
        }
      }
    ])

    // Calcular totais
    let totalBalance = 0
    let totalCreditLimit = 0
    let totalCreditUsed = 0

    accountsWithBalance.forEach(account => {
      if (account.includeInTotal !== false) {
        if (account.type === 'credit_card') {
          totalCreditLimit += account.creditLimit || 0
          totalCreditUsed += Math.abs(Math.min(account.balance, 0))
        } else {
          totalBalance += account.balance
        }
      }
    })

    res.json({
      accounts: accountsWithBalance,
      totals: {
        balance: totalBalance,
        creditLimit: totalCreditLimit,
        creditUsed: totalCreditUsed,
        creditAvailable: totalCreditLimit - totalCreditUsed,
        netWorth: totalBalance - totalCreditUsed
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar resumo', error: error.message })
  }
})

// @route   GET /api/accounts/:id
// @desc    Obter uma conta específica
router.get('/:id', validateObjectId(), async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!account) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    // Buscar transações recentes
    const recentTransactions = await Transaction.find({
      user: req.user._id,
      account: account._id
    }).sort({ date: -1 }).limit(10)

    res.json({ account, recentTransactions })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar conta', error: error.message })
  }
})

// @route   GET /api/accounts/:id/diagnose
// @desc    Diagnosticar composição do saldo (debug)
router.get('/:id/diagnose', validateObjectId(), async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!account) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    // Buscar todas as transações que afetam esta conta
    const transactions = await Transaction.find({
      user: req.user._id,
      $or: [
        { account: account._id },
        { toAccount: account._id }
      ],
      status: 'confirmed'
    }).sort({ date: 1 })

    // Calcular contribuição de cada transação
    let runningBalance = account.initialBalance
    const breakdown = [{
      type: 'initialBalance',
      description: 'Saldo inicial da conta',
      amount: account.initialBalance,
      change: account.initialBalance,
      balance: runningBalance,
      date: account.createdAt
    }]

    transactions.forEach(t => {
      let change = 0
      if (t.type === 'income' && t.account.equals(account._id)) {
        change = t.amount
      } else if (t.type === 'expense' && t.account.equals(account._id)) {
        change = -t.amount
      } else if (t.type === 'transfer') {
        if (t.account.equals(account._id)) change = -t.amount
        if (t.toAccount && t.toAccount.equals(account._id)) change = t.amount
      }

      if (change !== 0) {
        runningBalance += change
        breakdown.push({
          id: t._id,
          date: t.date,
          type: t.type,
          category: t.category,
          description: t.description,
          amount: t.amount,
          change: change,
          balance: Math.round(runningBalance * 100) / 100
        })
      }
    })

    res.json({
      account: {
        id: account._id,
        name: account.name,
        type: account.type,
        initialBalance: account.initialBalance
      },
      currentBalance: Math.round(runningBalance * 100) / 100,
      transactionCount: transactions.length,
      breakdown
    })
  } catch (error) {
    console.error('[DIAGNOSE ERROR]', error)
    res.status(500).json({ message: 'Erro ao diagnosticar conta', error: error.message })
  }
})

// @route   POST /api/accounts
// @desc    Criar nova conta
router.post('/', async (req, res) => {
  try {
    const {
      name, type, institution, initialBalance,
      color, icon, creditLimit, closingDay, dueDay
    } = req.body

    const account = await Account.create({
      user: req.user._id,
      name,
      type: type || 'checking',
      institution,
      initialBalance: initialBalance || 0,
      balance: initialBalance || 0,
      color: color || '#3b82f6',
      icon: icon || 'Wallet',
      creditLimit,
      closingDay,
      dueDay
    })

    res.status(201).json({ account })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar conta', error: error.message })
  }
})

// @route   PUT /api/accounts/:id
// @desc    Atualizar conta
router.put('/:id', validateObjectId(), async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!account) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    const allowedUpdates = [
      'name', 'type', 'institution', 'color', 'icon',
      'includeInTotal', 'creditLimit', 'closingDay', 'dueDay', 'isActive'
    ]

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        account[field] = req.body[field]
      }
    })

    await account.save()
    res.json({ account })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar conta', error: error.message })
  }
})

// @route   POST /api/accounts/:id/adjust
// @desc    Ajustar saldo da conta
router.post('/:id/adjust', validateObjectId(), async (req, res) => {
  // Usar transação MongoDB para evitar race condition
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { newBalance, description } = req.body

    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user._id
    }).session(session)

    if (!account) {
      await session.abortTransaction()
      session.endSession()
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    // Calcular saldo atual usando aggregation (mais eficiente)
    const totals = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          account: account._id,
          status: 'confirmed'
        }
      },
      {
        $group: {
          _id: null,
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } }
        }
      }
    ]).session(session)

    const totalsData = totals[0] || { income: 0, expense: 0 }
    const currentBalance = account.initialBalance + totalsData.income - totalsData.expense
    const difference = newBalance - currentBalance

    if (difference !== 0) {
      // Criar transação de ajuste dentro da transação MongoDB
      await Transaction.create([{
        user: req.user._id,
        type: difference > 0 ? 'income' : 'expense',
        category: 'ajuste',
        description: description || 'Ajuste de saldo',
        amount: Math.abs(difference),
        account: account._id,
        date: new Date(),
        status: 'confirmed'
      }], { session })
    }

    await session.commitTransaction()
    session.endSession()

    res.json({ message: 'Saldo ajustado com sucesso', newBalance })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(400).json({ message: 'Erro ao ajustar saldo', error: error.message })
  }
})

// @route   POST /api/accounts/transfer
// @desc    Transferência entre contas
router.post('/transfer', async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, description, date } = req.body

    // Validação dos IDs
    if (!fromAccountId || !mongoose.Types.ObjectId.isValid(fromAccountId)) {
      return res.status(400).json({ message: 'ID de conta de origem inválido' })
    }
    if (!toAccountId || !mongoose.Types.ObjectId.isValid(toAccountId)) {
      return res.status(400).json({ message: 'ID de conta de destino inválido' })
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ message: 'Contas de origem e destino devem ser diferentes' })
    }

    // Validação do valor
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valor da transferência deve ser maior que zero' })
    }

    const [fromAccount, toAccount] = await Promise.all([
      Account.findOne({ _id: fromAccountId, user: req.user._id }),
      Account.findOne({ _id: toAccountId, user: req.user._id })
    ])

    if (!fromAccount || !toAccount) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    // Criar transação de transferência
    const transfer = await Transaction.create({
      user: req.user._id,
      type: 'transfer',
      category: 'transferencia',
      description: description || `Transferência: ${fromAccount.name} → ${toAccount.name}`,
      amount,
      account: fromAccountId,
      toAccount: toAccountId,
      date: date || new Date()
    })

    res.status(201).json({ transfer })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao realizar transferência', error: error.message })
  }
})

// @route   DELETE /api/accounts/:id
// @desc    Desativar conta (soft delete)
router.delete('/:id', validateObjectId(), async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!account) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    account.isActive = false
    await account.save()

    res.json({ message: 'Conta desativada com sucesso' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desativar conta', error: error.message })
  }
})

module.exports = router
