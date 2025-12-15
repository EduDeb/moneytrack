const express = require('express')
const router = express.Router()
const Settings = require('../models/Settings')
const { protect } = require('../middleware/auth')
const { testEmailConfiguration, createInAppNotification } = require('../services/notificationService')

router.use(protect)

// @route   GET /api/settings
// @desc    Obter configurações do usuário
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne({ user: req.user._id })

    if (!settings) {
      // Criar configurações padrão
      settings = await Settings.create({
        user: req.user._id
      })
    }

    res.json({ settings })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar configurações', error: error.message })
  }
})

// @route   PUT /api/settings
// @desc    Atualizar configurações
router.put('/', async (req, res) => {
  try {
    let settings = await Settings.findOne({ user: req.user._id })

    if (!settings) {
      settings = new Settings({ user: req.user._id })
    }

    const allowedUpdates = [
      'theme', 'primaryColor', 'language', 'currency', 'dateFormat',
      'numberFormat', 'startOfWeek', 'fiscalYearStart', 'firstDayOfWeek',
      'notifications', 'privacy', 'dashboard', 'quickCategories'
    ]

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] === 'object' && settings[field]) {
          // Merge objects
          settings[field] = { ...settings[field].toObject(), ...req.body[field] }
        } else {
          settings[field] = req.body[field]
        }
      }
    })

    await settings.save()
    res.json({ settings })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar configurações', error: error.message })
  }
})

// @route   PUT /api/settings/theme
// @desc    Alterar tema rapidamente
router.put('/theme', async (req, res) => {
  try {
    const { theme, primaryColor } = req.body

    let settings = await Settings.findOne({ user: req.user._id })

    if (!settings) {
      settings = new Settings({ user: req.user._id })
    }

    if (theme) settings.theme = theme
    if (primaryColor) settings.primaryColor = primaryColor

    await settings.save()
    res.json({ settings })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao alterar tema', error: error.message })
  }
})

// @route   PUT /api/settings/notifications
// @desc    Configurar notificações
router.put('/notifications', async (req, res) => {
  try {
    let settings = await Settings.findOne({ user: req.user._id })

    if (!settings) {
      settings = new Settings({ user: req.user._id })
    }

    const notificationFields = [
      'email', 'push', 'billReminders', 'goalAlerts',
      'weeklyReport', 'monthlyReport', 'budgetAlerts'
    ]

    notificationFields.forEach(field => {
      if (req.body[field] !== undefined) {
        settings.notifications[field] = req.body[field]
      }
    })

    await settings.save()
    res.json({ settings })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao configurar notificações', error: error.message })
  }
})

// @route   PUT /api/settings/dashboard
// @desc    Configurar widgets do dashboard
router.put('/dashboard', async (req, res) => {
  try {
    let settings = await Settings.findOne({ user: req.user._id })

    if (!settings) {
      settings = new Settings({ user: req.user._id })
    }

    const { widgets, defaultView, showBalance } = req.body

    if (widgets) settings.dashboard.widgets = widgets
    if (defaultView) settings.dashboard.defaultView = defaultView
    if (showBalance !== undefined) settings.dashboard.showBalance = showBalance

    await settings.save()
    res.json({ settings })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao configurar dashboard', error: error.message })
  }
})

// @route   POST /api/settings/reset
// @desc    Resetar para configurações padrão
router.post('/reset', async (req, res) => {
  try {
    await Settings.findOneAndDelete({ user: req.user._id })

    const settings = await Settings.create({
      user: req.user._id
    })

    res.json({ settings, message: 'Configurações resetadas com sucesso' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao resetar configurações', error: error.message })
  }
})

// @route   POST /api/settings/test-email
// @desc    Testar configuração de email
router.post('/test-email', async (req, res) => {
  try {
    const result = await testEmailConfiguration(req.user.email)

    if (result.success) {
      res.json({ success: true, message: 'Email de teste enviado com sucesso!' })
    } else {
      res.status(400).json({
        success: false,
        message: result.reason || 'Erro ao enviar email de teste',
        error: result.error
      })
    }
  } catch (error) {
    res.status(500).json({ message: 'Erro ao testar email', error: error.message })
  }
})

// @route   POST /api/settings/test-notification
// @desc    Enviar notificação de teste
router.post('/test-notification', async (req, res) => {
  try {
    const notification = await createInAppNotification(
      req.user._id,
      'system',
      'Teste de Notificação',
      'Esta é uma notificação de teste. Se você está vendo isso, as notificações estão funcionando!',
      {},
      'low'
    )

    if (notification) {
      res.json({ success: true, message: 'Notificação de teste criada!', notification })
    } else {
      res.status(400).json({ success: false, message: 'Erro ao criar notificação de teste' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar notificação de teste', error: error.message })
  }
})

// @route   GET /api/settings/colors
// @desc    Listar cores disponíveis
router.get('/colors', async (req, res) => {
  try {
    const colors = [
      { name: 'Azul', value: '#3b82f6', dark: '#2563eb' },
      { name: 'Verde', value: '#10b981', dark: '#059669' },
      { name: 'Roxo', value: '#8b5cf6', dark: '#7c3aed' },
      { name: 'Rosa', value: '#ec4899', dark: '#db2777' },
      { name: 'Laranja', value: '#f97316', dark: '#ea580c' },
      { name: 'Vermelho', value: '#ef4444', dark: '#dc2626' },
      { name: 'Amarelo', value: '#eab308', dark: '#ca8a04' },
      { name: 'Ciano', value: '#06b6d4', dark: '#0891b2' },
      { name: 'Indigo', value: '#6366f1', dark: '#4f46e5' },
      { name: 'Esmeralda', value: '#34d399', dark: '#10b981' },
      { name: 'Âmbar', value: '#fbbf24', dark: '#f59e0b' },
      { name: 'Cinza', value: '#6b7280', dark: '#4b5563' }
    ]

    res.json({ colors })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao listar cores', error: error.message })
  }
})

module.exports = router
