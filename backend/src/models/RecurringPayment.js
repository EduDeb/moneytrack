const mongoose = require('mongoose')

// Este modelo rastreia pagamentos de recorrências por mês/ano
// Permite saber se uma recorrência específica foi paga em um determinado mês
// Para recorrências semanais, usa dueDay para diferenciar cada semana
const recurringPaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recurring: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recurring',
    required: true
  },
  // Mês e ano do pagamento (para qual período este pagamento se refere)
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  // Dia do vencimento (usado para recorrências semanais - múltiplas por mês)
  dueDay: {
    type: Number,
    default: null
  },
  // Transação gerada pelo pagamento
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  // Data efetiva do pagamento
  paidAt: {
    type: Date,
    default: Date.now
  },
  // Valor pago (pode ser diferente do valor da recorrência)
  amountPaid: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
})

// Índice para pagamentos mensais (dueDay = null)
// Índice para pagamentos semanais inclui dueDay
recurringPaymentSchema.index({ user: 1, recurring: 1, month: 1, year: 1, dueDay: 1 })

// Índice para buscar pagamentos de um mês específico
recurringPaymentSchema.index({ user: 1, month: 1, year: 1 })

module.exports = mongoose.model('RecurringPayment', recurringPaymentSchema)
