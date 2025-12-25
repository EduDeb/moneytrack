const mongoose = require('mongoose')

// Este modelo permite sobrescrever valores de uma recorrência para um mês específico
// Útil quando o valor de uma conta varia em determinado mês (ex: conta de luz mais cara no verão)
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
  // Campos que podem ser sobrescritos para este mês específico
  amount: {
    type: Number
  },
  name: {
    type: String
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
})

// Índice único para garantir apenas uma sobrescrita por recorrência/mês/ano
recurringOverrideSchema.index({ user: 1, recurring: 1, month: 1, year: 1 }, { unique: true })

// Índice para buscar sobrescritas de um mês específico
recurringOverrideSchema.index({ user: 1, month: 1, year: 1 })

module.exports = mongoose.model('RecurringOverride', recurringOverrideSchema)
