const mongoose = require('mongoose')

const goalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Nome da meta é obrigatório']
  },
  type: {
    type: String,
    enum: ['savings', 'expense_limit', 'income', 'investment', 'debt_payment'],
    default: 'savings'
  },
  targetAmount: {
    type: Number,
    required: [true, 'Valor alvo é obrigatório'],
    min: [1, 'Valor deve ser maior que zero']
  },
  currentAmount: {
    type: Number,
    default: 0
  },
  deadline: {
    type: Date
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  icon: {
    type: String,
    default: 'target'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
})

// Virtual para progresso
goalSchema.virtual('progress').get(function() {
  return this.targetAmount > 0 ? (this.currentAmount / this.targetAmount) * 100 : 0
})

// Virtual para valor restante
goalSchema.virtual('remaining').get(function() {
  return Math.max(this.targetAmount - this.currentAmount, 0)
})

// Virtual para dias restantes
goalSchema.virtual('daysRemaining').get(function() {
  if (!this.deadline) return null
  const today = new Date()
  const deadline = new Date(this.deadline)
  return Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))
})

goalSchema.set('toJSON', { virtuals: true })
goalSchema.set('toObject', { virtuals: true })

module.exports = mongoose.model('Goal', goalSchema)
