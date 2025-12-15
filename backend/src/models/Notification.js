const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['bill_due', 'budget_warning', 'budget_exceeded', 'goal_reached', 'recurring_due', 'system'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed // Dados adicionais (ID da conta, transação, etc)
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
})

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 })

module.exports = mongoose.model('Notification', notificationSchema)
