const express = require('express')
const router = express.Router()
const Account = require('../models/Account')
const Transaction = require('../models/Transaction')
const { protect } = require('../middleware/auth')

router.use(protect)

// @route   GET /api/accounts
// @desc    Listar todas as contas do usuário
router.get('/', async (req, res) => {
  try {
    const { includeInactive } = req.query
    const query = { user: req.user._id }
    if (!includeInactive) query.isActive = true

    const accounts = await Account.find(query).sort({ name: 1 })

    // Calcular saldo atual baseado nas transações
    const accountsWithBalance = await Promise.all(accounts.map(async (account) => {
      const transactions = await Transaction.find({
        user: req.user._id,
        account: account._id,
        status: 'confirmed'
      })

      let calculatedBalance = account.initialBalance
      transactions.forEach(t => {
        if (t.type === 'income') calculatedBalance += t.amount
        else if (t.type === 'expense') calculatedBalance -= t.amount
        else if (t.type === 'transfer') {
          if (t.account.equals(account._id)) calculatedBalance -= t.amount
          if (t.toAccount && t.toAccount.equals(account._id)) calculatedBalance += t.amount
        }
      })

      return {
        ...account.toObject(),
        calculatedBalance,
        transactionCount: transactions.length
      }
    }))

    res.json({ accounts: accountsWithBalance })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao busdrive contas', error: error.message })
  }
})

// @route   GET /api/accounts/summary
// @desc    Resumo de todas as contas
router.get('/summary', async (req, res) => {
  try {
    const accounts = await Account.find({ user: req.user._id, isActive: true })

    let totalBalance = 0
    let totalCreditLimit = 0
    let totalCreditUsed = 0

    const summary = await Promise.all(accounts.map(async (account) => {
      const transactions = await Transaction.find({
        user: req.user._id,
        account: account._id,
        status: 'confirmed'
      })

      let balance = account.initialBalance
      transactions.forEach(t => {
        if (t.type === 'income') balance += t.amount
        else if (t.type === 'expense') balance -= t.amount
      })

      if (account.includeInTotal) {
        if (account.type === 'credit_card') {
          totalCreditLimit += account.creditLimit || 0
          totalCreditUsed += Math.abs(Math.min(balance, 0))
        } else {
          totalBalance += balance
        }
      }

      return { ...account.toObject(), balance }
    }))

    res.json({
      accounts: summary,
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
router.get('/:id', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.post('/:id/adjust', async (req, res) => {
  try {
    const { newBalance, description } = req.body

    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!account) {
      return res.status(404).json({ message: 'Conta não encontrada' })
    }

    // Calcular saldo atual
    const transactions = await Transaction.find({
      user: req.user._id,
      account: account._id,
      status: 'confirmed'
    })

    let currentBalance = account.initialBalance
    transactions.forEach(t => {
      if (t.type === 'income') currentBalance += t.amount
      else if (t.type === 'expense') currentBalance -= t.amount
    })

    const difference = newBalance - currentBalance

    if (difference !== 0) {
      // Criar transação de ajuste
      await Transaction.create({
        user: req.user._id,
        type: difference > 0 ? 'income' : 'expense',
        category: 'ajuste',
        description: description || 'Ajuste de saldo',
        amount: Math.abs(difference),
        account: account._id,
        date: new Date()
      })
    }

    res.json({ message: 'Saldo ajustado com sucesso', newBalance })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao ajustar saldo', error: error.message })
  }
})

// @route   POST /api/accounts/transfer
// @desc    Transferência entre contas
router.post('/transfer', async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, description, date } = req.body

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ message: 'Contas de origem e destino devem ser diferentes' })
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
router.delete('/:id', async (req, res) => {
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
