const express = require('express')
const router = express.Router()
const Achievement = require('../models/Achievement')
const Transaction = require('../models/Transaction')
const Account = require('../models/Account')
const Goal = require('../models/Goal')
const Budget = require('../models/Budget')
const Investment = require('../models/Investment')
const Debt = require('../models/Debt')
const { protect } = require('../middleware/auth')

router.use(protect)

// Definição de todas as conquistas disponíveis
const ACHIEVEMENTS = {
  first_transaction: {
    id: 'first_transaction',
    name: 'Primeira Transação',
    description: 'Registre sua primeira transação',
    icon: 'Receipt',
    color: '#3b82f6'
  },
  first_account: {
    id: 'first_account',
    name: 'Conta Criada',
    description: 'Adicione sua primeira conta',
    icon: 'Wallet',
    color: '#10b981'
  },
  first_goal: {
    id: 'first_goal',
    name: 'Meta Definida',
    description: 'Crie sua primeira meta financeira',
    icon: 'Target',
    color: '#f59e0b'
  },
  first_budget: {
    id: 'first_budget',
    name: 'Orçamento Planejado',
    description: 'Configure seu primeiro orçamento',
    icon: 'PiggyBank',
    color: '#8b5cf6'
  },
  investor: {
    id: 'investor',
    name: 'Investidor',
    description: 'Registre seu primeiro investimento',
    icon: 'TrendingUp',
    color: '#06b6d4'
  },
  debt_free: {
    id: 'debt_free',
    name: 'Livre de Dívidas',
    description: 'Quite todas as suas dívidas',
    icon: 'CheckCircle',
    color: '#14b8a6'
  },
  diversified: {
    id: 'diversified',
    name: 'Portfólio Diversificado',
    description: 'Tenha investimentos em 3 tipos diferentes',
    icon: 'PieChart',
    color: '#ec4899'
  }
}

// @route   GET /api/achievements
// @desc    Listar todas as conquistas do usuário
router.get('/', async (req, res) => {
  try {
    const unlockedAchievements = await Achievement.find({ user: req.user._id }).sort({ unlockedAt: -1 })

    // Criar objeto com informações completas das conquistas
    const achievements = Object.values(ACHIEVEMENTS).map(achievement => {
      const unlocked = unlockedAchievements.find(a => a.achievementId === achievement.id)

      return {
        ...achievement,
        unlocked: !!unlocked,
        unlockedAt: unlocked ? unlocked.unlockedAt : null,
        notified: unlocked ? unlocked.notified : false,
        _id: unlocked ? unlocked._id : null
      }
    })

    const stats = {
      total: Object.keys(ACHIEVEMENTS).length,
      unlocked: unlockedAchievements.length,
      remaining: Object.keys(ACHIEVEMENTS).length - unlockedAchievements.length,
      progress: (unlockedAchievements.length / Object.keys(ACHIEVEMENTS).length) * 100
    }

    res.json({ achievements, stats })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar conquistas', error: error.message })
  }
})

// @route   GET /api/achievements/check
// @desc    Verificar e desbloquear conquistas pendentes
router.get('/check', async (req, res) => {
  try {
    const userId = req.user._id
    const newAchievements = []

    // Buscar conquistas já desbloqueadas
    const unlockedAchievements = await Achievement.find({ user: userId })
    const unlockedIds = unlockedAchievements.map(a => a.achievementId)

    // Verificar cada conquista
    const checks = [
      {
        id: 'first_transaction',
        check: async () => {
          const count = await Transaction.countDocuments({ user: userId })
          return count >= 1
        }
      },
      {
        id: 'first_account',
        check: async () => {
          const count = await Account.countDocuments({ user: userId })
          return count >= 1
        }
      },
      {
        id: 'first_goal',
        check: async () => {
          const count = await Goal.countDocuments({ user: userId })
          return count >= 1
        }
      },
      {
        id: 'first_budget',
        check: async () => {
          const count = await Budget.countDocuments({ user: userId })
          return count >= 1
        }
      },
      {
        id: 'investor',
        check: async () => {
          const count = await Investment.countDocuments({ user: userId })
          return count >= 1
        }
      },
      {
        id: 'debt_free',
        check: async () => {
          const count = await Debt.countDocuments({
            user: userId,
            status: { $ne: 'paid' }
          })
          return count === 0
        }
      },
      {
        id: 'diversified',
        check: async () => {
          const types = await Investment.distinct('type', { user: userId })
          return types.length >= 3
        }
      }
    ]

    // Executar verificações em paralelo
    for (const { id, check } of checks) {
      // Pular se já desbloqueada
      if (unlockedIds.includes(id)) continue

      const isUnlocked = await check()

      if (isUnlocked) {
        try {
          const achievement = await Achievement.create({
            user: userId,
            achievementId: id,
            unlockedAt: new Date(),
            notified: false
          })

          newAchievements.push({
            ...ACHIEVEMENTS[id],
            _id: achievement._id,
            unlocked: true,
            unlockedAt: achievement.unlockedAt,
            notified: false
          })
        } catch (error) {
          // Ignorar erro de duplicação (caso ocorra race condition)
          if (error.code !== 11000) {
            throw error
          }
        }
      }
    }

    res.json({
      newAchievements,
      count: newAchievements.length,
      message: newAchievements.length > 0
        ? `Parabéns! Você desbloqueou ${newAchievements.length} nova(s) conquista(s)!`
        : 'Nenhuma nova conquista desbloqueada'
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao verificar conquistas', error: error.message })
  }
})

// @route   PUT /api/achievements/:id/notify
// @desc    Marcar conquista como notificada
router.put('/:id/notify', async (req, res) => {
  try {
    const achievement = await Achievement.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!achievement) {
      return res.status(404).json({ message: 'Conquista não encontrada' })
    }

    achievement.notified = true
    await achievement.save()

    res.json({
      achievement,
      message: 'Conquista marcada como notificada'
    })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar conquista', error: error.message })
  }
})

// @route   GET /api/achievements/unnotified
// @desc    Buscar conquistas não notificadas
router.get('/unnotified', async (req, res) => {
  try {
    const unnotifiedAchievements = await Achievement.find({
      user: req.user._id,
      notified: false
    }).sort({ unlockedAt: -1 })

    const achievements = unnotifiedAchievements.map(achievement => ({
      ...ACHIEVEMENTS[achievement.achievementId],
      _id: achievement._id,
      unlocked: true,
      unlockedAt: achievement.unlockedAt,
      notified: false
    }))

    res.json({
      achievements,
      count: achievements.length
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar conquistas não notificadas', error: error.message })
  }
})

module.exports = router
