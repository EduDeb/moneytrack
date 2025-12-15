const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Settings = require('../models/Settings')
const Transaction = require('../models/Transaction')
const Account = require('../models/Account')
const { protect } = require('../middleware/auth')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

router.use(protect)

// @route   GET /api/profile
// @desc    Obter perfil do usuário
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    const settings = await Settings.findOne({ user: req.user._id })

    // Estatísticas básicas
    const stats = await getQuickStats(req.user._id)

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        birthDate: user.birthDate,
        defaultCurrency: user.defaultCurrency,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      },
      settings,
      stats
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar perfil', error: error.message })
  }
})

// @route   PUT /api/profile
// @desc    Atualizar perfil
router.put('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)

    const allowedUpdates = ['name', 'phone', 'birthDate', 'avatar', 'defaultCurrency']

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field]
      }
    })

    await user.save()

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        birthDate: user.birthDate,
        defaultCurrency: user.defaultCurrency,
        plan: user.plan
      }
    })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar perfil', error: error.message })
  }
})

// @route   PUT /api/profile/email
// @desc    Alterar email
router.put('/email', async (req, res) => {
  try {
    const { newEmail, password } = req.body

    const user = await User.findById(req.user._id).select('+password')

    const isMatch = await user.matchPassword(password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Senha incorreta' })
    }

    // Verificar se email já existe
    const existing = await User.findOne({ email: newEmail.toLowerCase() })
    if (existing) {
      return res.status(400).json({ message: 'Este email já está em uso' })
    }

    user.email = newEmail.toLowerCase()
    user.isVerified = false // Requer nova verificação
    await user.save()

    res.json({ message: 'Email alterado com sucesso. Verifique sua caixa de entrada.' })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao alterar email', error: error.message })
  }
})

// @route   PUT /api/profile/password
// @desc    Alterar senha
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Nova senha deve ter pelo menos 6 caracteres' })
    }

    const user = await User.findById(req.user._id).select('+password')

    const isMatch = await user.matchPassword(currentPassword)
    if (!isMatch) {
      return res.status(400).json({ message: 'Senha atual incorreta' })
    }

    user.password = newPassword
    await user.save()

    res.json({ message: 'Senha alterada com sucesso' })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao alterar senha', error: error.message })
  }
})

// @route   POST /api/profile/avatar
// @desc    Upload de avatar (URL)
router.post('/avatar', async (req, res) => {
  try {
    const { avatarUrl } = req.body

    const user = await User.findById(req.user._id)
    user.avatar = avatarUrl
    await user.save()

    res.json({ avatar: user.avatar })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar avatar', error: error.message })
  }
})

// @route   DELETE /api/profile/avatar
// @desc    Remover avatar
router.delete('/avatar', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    user.avatar = null
    await user.save()

    res.json({ message: 'Avatar removido' })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao remover avatar', error: error.message })
  }
})

// @route   GET /api/profile/stats
// @desc    Estatísticas completas do usuário
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id

    // Totais gerais
    const [totalTransactions, totalAccounts, incomeTotal, expenseTotal] = await Promise.all([
      Transaction.countDocuments({ user: userId }),
      Account.countDocuments({ user: userId, isActive: true }),
      Transaction.aggregate([
        { $match: { user: userId, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { user: userId, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ])

    // Transações por mês (últimos 12 meses)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const monthlyData = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ])

    // Top categorias de despesa
    const topCategories = await Transaction.aggregate([
      { $match: { user: userId, type: 'expense' } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ])

    // Primeiro e última transação
    const [firstTransaction, lastTransaction] = await Promise.all([
      Transaction.findOne({ user: userId }).sort({ date: 1 }),
      Transaction.findOne({ user: userId }).sort({ date: -1 })
    ])

    res.json({
      totals: {
        transactions: totalTransactions,
        accounts: totalAccounts,
        income: incomeTotal[0]?.total || 0,
        expense: expenseTotal[0]?.total || 0,
        balance: (incomeTotal[0]?.total || 0) - (expenseTotal[0]?.total || 0)
      },
      monthlyData,
      topCategories,
      timeline: {
        firstTransaction: firstTransaction?.date,
        lastTransaction: lastTransaction?.date,
        accountAge: firstTransaction ? Math.floor((Date.now() - firstTransaction.date) / (1000 * 60 * 60 * 24)) : 0
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar estatísticas', error: error.message })
  }
})

// @route   POST /api/profile/export-data
// @desc    Exportar todos os dados do usuário (LGPD)
router.post('/export-data', async (req, res) => {
  try {
    const userId = req.user._id

    const [user, settings, transactions, accounts] = await Promise.all([
      User.findById(userId),
      Settings.findOne({ user: userId }),
      Transaction.find({ user: userId }),
      Account.find({ user: userId })
    ])

    const exportData = {
      exportDate: new Date(),
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        birthDate: user.birthDate,
        createdAt: user.createdAt
      },
      settings,
      accounts,
      transactions,
      totalRecords: {
        accounts: accounts.length,
        transactions: transactions.length
      }
    }

    res.json(exportData)
  } catch (error) {
    res.status(500).json({ message: 'Erro ao exportar dados', error: error.message })
  }
})

// @route   DELETE /api/profile/account
// @desc    Excluir conta (LGPD)
router.delete('/account', async (req, res) => {
  try {
    const { password, confirmation } = req.body

    if (confirmation !== 'EXCLUIR MINHA CONTA') {
      return res.status(400).json({
        message: 'Por favor, digite "EXCLUIR MINHA CONTA" para confirmar'
      })
    }

    const user = await User.findById(req.user._id).select('+password')

    const isMatch = await user.matchPassword(password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Senha incorreta' })
    }

    // Soft delete - desativar conta
    user.isActive = false
    user.email = `deleted_${Date.now()}_${user.email}`
    await user.save()

    // Opcional: Agendar exclusão definitiva em 30 dias
    // Ou excluir dados imediatamente:
    // await Promise.all([
    //   Transaction.deleteMany({ user: user._id }),
    //   Account.deleteMany({ user: user._id }),
    //   Settings.deleteOne({ user: user._id }),
    //   User.findByIdAndDelete(user._id)
    // ])

    res.json({ message: 'Conta desativada. Seus dados serão excluídos em 30 dias.' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir conta', error: error.message })
  }
})

// @route   GET /api/profile/sessions
// @desc    Sessões ativas (placeholder para futuro)
router.get('/sessions', async (req, res) => {
  try {
    // Placeholder - implementar com sistema de tokens
    res.json({
      sessions: [
        {
          id: 'current',
          device: 'Web Browser',
          location: 'Brasil',
          lastActive: new Date(),
          isCurrent: true
        }
      ]
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar sessões', error: error.message })
  }
})

// Função auxiliar para estatísticas rápidas
async function getQuickStats(userId) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [monthIncome, monthExpense, totalAccounts] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'income',
          date: { $gte: startOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: startOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Account.countDocuments({ user: userId, isActive: true })
  ])

  return {
    monthIncome: monthIncome[0]?.total || 0,
    monthExpense: monthExpense[0]?.total || 0,
    totalAccounts
  }
}

module.exports = router
