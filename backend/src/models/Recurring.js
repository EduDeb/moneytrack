const mongoose = require('mongoose')

const recurringSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Valor é obrigatório'],
    min: 0.01
  },
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  // Frequência
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'],
    default: 'monthly'
  },
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31
  },
  dayOfWeek: {
    type: Number,
    min: 0,
    max: 6 // 0 = Domingo
  },
  // Controle
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  lastGeneratedDate: {
    type: Date
  },
  nextDueDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Para parcelamentos
  isInstallment: {
    type: Boolean,
    default: false
  },
  totalInstallments: {
    type: Number,
    default: 1
  },
  currentInstallment: {
    type: Number,
    default: 1
  },
  // Notificação
  notifyDaysBefore: {
    type: Number,
    default: 3
  },
  notifyByEmail: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

// Calcular próxima data de vencimento
recurringSchema.methods.calculateNextDueDate = function() {
  const now = new Date()
  let nextDate = new Date(this.nextDueDate || this.startDate)

  while (nextDate <= now) {
    switch (this.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1)
        break
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7)
        break
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14)
        break
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1)
        if (this.dayOfMonth) {
          nextDate.setDate(Math.min(this.dayOfMonth, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()))
        }
        break
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1)
        break
    }
  }

  return nextDate
}

recurringSchema.index({ user: 1, isActive: 1 })
recurringSchema.index({ nextDueDate: 1 })

module.exports = mongoose.model('Recurring', recurringSchema)
