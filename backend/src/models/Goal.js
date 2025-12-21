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

// Virtual para previsão de conclusão
goalSchema.virtual('forecast').get(function() {
  // Se já completou
  if (this.currentAmount >= this.targetAmount) {
    return {
      status: 'completed',
      monthlyNeeded: 0,
      monthsRemaining: 0,
      onTrack: true,
      estimatedDate: null,
      message: 'Meta atingida!'
    }
  }

  const remaining = this.targetAmount - this.currentAmount
  const today = new Date()

  // Calcular taxa média de progresso (baseado no tempo desde criação)
  const daysSinceCreation = Math.max(1, Math.ceil((today - this.createdAt) / (1000 * 60 * 60 * 24)))
  const monthsSinceCreation = Math.max(1, daysSinceCreation / 30)
  const monthlyRate = this.currentAmount / monthsSinceCreation // Média mensal depositada

  // Se tem deadline
  if (this.deadline) {
    const deadline = new Date(this.deadline)
    const daysToDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))
    const monthsToDeadline = Math.max(0.1, daysToDeadline / 30)

    // Quanto precisa depositar por mês para atingir no prazo
    const monthlyNeeded = remaining / monthsToDeadline

    // Está no ritmo? (taxa atual >= necessária)
    const onTrack = monthlyRate >= monthlyNeeded * 0.9 // 10% de tolerância

    // Estimativa de quando vai atingir com o ritmo atual
    let estimatedDate = null
    let monthsRemaining = null

    if (monthlyRate > 0) {
      monthsRemaining = remaining / monthlyRate
      estimatedDate = new Date(today)
      estimatedDate.setMonth(estimatedDate.getMonth() + Math.ceil(monthsRemaining))
    }

    let status, message
    if (daysToDeadline < 0) {
      status = 'overdue'
      message = 'Prazo expirado'
    } else if (onTrack) {
      status = 'on_track'
      message = `No ritmo! Deposite R$ ${monthlyNeeded.toFixed(0)}/mês`
    } else {
      status = 'behind'
      message = `Atrasado. Precisa R$ ${monthlyNeeded.toFixed(0)}/mês (atual: R$ ${monthlyRate.toFixed(0)}/mês)`
    }

    return {
      status,
      monthlyNeeded: Math.round(monthlyNeeded * 100) / 100,
      monthlyRate: Math.round(monthlyRate * 100) / 100,
      monthsRemaining: monthsRemaining ? Math.round(monthsRemaining * 10) / 10 : null,
      onTrack,
      estimatedDate,
      daysToDeadline,
      message
    }
  }

  // Sem deadline - apenas estimar com base no ritmo atual
  if (monthlyRate > 0) {
    const monthsRemaining = remaining / monthlyRate
    const estimatedDate = new Date(today)
    estimatedDate.setMonth(estimatedDate.getMonth() + Math.ceil(monthsRemaining))

    return {
      status: 'active',
      monthlyNeeded: null,
      monthlyRate: Math.round(monthlyRate * 100) / 100,
      monthsRemaining: Math.round(monthsRemaining * 10) / 10,
      onTrack: null,
      estimatedDate,
      daysToDeadline: null,
      message: `Ritmo atual: R$ ${monthlyRate.toFixed(0)}/mês. Conclusão em ~${Math.ceil(monthsRemaining)} meses`
    }
  }

  // Sem progresso ainda
  return {
    status: 'no_progress',
    monthlyNeeded: null,
    monthlyRate: 0,
    monthsRemaining: null,
    onTrack: null,
    estimatedDate: null,
    daysToDeadline: this.deadline ? Math.ceil((new Date(this.deadline) - today) / (1000 * 60 * 60 * 24)) : null,
    message: 'Comece a depositar para ver a previsão'
  }
})

goalSchema.set('toJSON', { virtuals: true })
goalSchema.set('toObject', { virtuals: true })

module.exports = mongoose.model('Goal', goalSchema)
