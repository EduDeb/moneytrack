const express = require('express')
const router = express.Router()
const Notification = require('../models/Notification')
const { protect } = require('../middleware/auth')

router.use(protect)

// @route   GET /api/notifications
// @desc    Listar notificações do usuário
router.get('/', async (req, res) => {
  try {
    const { unreadOnly, limit = 20, page = 1 } = req.query
    const query = { user: req.user._id }
    if (unreadOnly === 'true') query.isRead = false

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false
    })

    res.json({ notifications, unreadCount })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar notificações', error: error.message })
  }
})

// @route   GET /api/notifications/unread-count
// @desc    Contagem de não lidas
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      isRead: false
    })
    res.json({ count })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao contar notificações', error: error.message })
  }
})

// @route   PUT /api/notifications/:id/read
// @desc    Marcar notificação como lida
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true, readAt: Date.now() },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ message: 'Notificação não encontrada' })
    }

    res.json({ notification })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar notificação', error: error.message })
  }
})

// @route   PUT /api/notifications/read-all
// @desc    Marcar todas como lidas
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true, readAt: Date.now() }
    )
    res.json({ message: 'Todas as notificações marcadas como lidas' })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar notificações', error: error.message })
  }
})

// @route   DELETE /api/notifications/:id
// @desc    Excluir notificação
router.delete('/:id', async (req, res) => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    })
    res.json({ message: 'Notificação excluída' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir notificação', error: error.message })
  }
})

// @route   DELETE /api/notifications/clear-all
// @desc    Limpar todas as notificações lidas
router.delete('/clear-all', async (req, res) => {
  try {
    await Notification.deleteMany({
      user: req.user._id,
      isRead: true
    })
    res.json({ message: 'Notificações lidas removidas' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao limpar notificações', error: error.message })
  }
})

module.exports = router
