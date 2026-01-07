const mongoose = require('mongoose')

const billSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Nome da conta é obrigatório']
  },
  category: {
    type: String,
    default: 'outros'
  },
  amount: {
    type: Number,
    required: [true, 'Valor é obrigatório'],
    min: [0.01, 'Valor deve ser maior que zero']
  },
  dueDay: {
    type: Number,
    required: [true, 'Dia de vencimento é obrigatório'],
    min: 1,
    max: 31
  },
  isRecurring: {
    type: Boolean,
    default: true
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: {
    type: Date
  },
  currentMonth: {
    type: Number,
    default: () => new Date().getMonth() + 1
  },
  currentYear: {
    type: Number,
    default: () => new Date().getFullYear()
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
})

// Virtual para calcular a data de vencimento completa
billSchema.virtual('dueDate').get(function() {
  const year = this.currentYear
  const month = this.currentMonth - 1
  const day = Math.min(this.dueDay, new Date(year, month + 1, 0).getDate())
  return new Date(year, month, day)
})

// Virtual para verificar status de urgência
billSchema.virtual('urgency').get(function() {
  if (this.isPaid) return 'paid'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueDate = this.dueDate
  dueDate.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 3) return 'soon'
  if (diffDays <= 7) return 'upcoming'
  return 'normal'
})

// Virtual para dias até vencimento
billSchema.virtual('daysUntilDue').get(function() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueDate = this.dueDate
  dueDate.setHours(0, 0, 0, 0)

  return Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
})

billSchema.set('toJSON', { virtuals: true })
billSchema.set('toObject', { virtuals: true })

// Índices para otimização de queries
billSchema.index({ user: 1, currentMonth: 1, currentYear: 1 })
billSchema.index({ user: 1, isPaid: 1, currentMonth: 1, currentYear: 1 })
billSchema.index({ user: 1, dueDay: 1 })

module.exports = mongoose.model('Bill', billSchema)
