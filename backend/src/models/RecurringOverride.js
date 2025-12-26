const mongoose = require('mongoose')

// Este modelo permite sobrescrever valores de uma recorrência para um mês específico
// Útil para: pular um mês, aplicar desconto pontual, pagamento parcial
const recurringOverrideSchema = new mongoose.Schema({
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
  // Mês e ano para o qual esta sobrescrita se aplica
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
  // Tipo de override
  type: {
    type: String,
    enum: ['custom_amount', 'skip', 'partial_payment'],
    default: 'custom_amount'
  },
  // Campos que podem ser sobrescritos para este mês específico
  amount: {
    type: Number  // Valor alterado (com desconto ou aumento)
  },
  originalAmount: {
    type: Number  // Valor original da recorrência (para referência)
  },
  paidAmount: {
    type: Number,  // Para pagamento parcial: quanto já foi pago
    default: 0
  },
  name: {
    type: String
  },
  notes: {
    type: String  // Motivo do desconto, pular, etc.
  }
}, {
  timestamps: true
})

// Índice único para garantir apenas uma sobrescrita por recorrência/mês/ano
recurringOverrideSchema.index({ user: 1, recurring: 1, month: 1, year: 1 }, { unique: true })

// Índice para buscar sobrescritas de um mês específico
recurringOverrideSchema.index({ user: 1, month: 1, year: 1 })

module.exports = mongoose.model('RecurringOverride', recurringOverrideSchema)
