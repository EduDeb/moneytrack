const mongoose = require('mongoose')

const accountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Nome da conta é obrigatório'],
    trim: true
  },
  type: {
    type: String,
    enum: ['checking', 'savings', 'credit_card', 'cash', 'investment', 'other'],
    default: 'checking'
  },
  institution: {
    type: String,
    trim: true // Ex: Nubank, Itaú, Bradesco
  },
  balance: {
    type: Number,
    default: 0
  },
  initialBalance: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  icon: {
    type: String,
    default: 'Wallet'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  includeInTotal: {
    type: Boolean,
    default: true
  },
  // Para cartão de crédito
  creditLimit: {
    type: Number,
    default: 0
  },
  closingDay: {
    type: Number,
    min: 1,
    max: 31
  },
  dueDay: {
    type: Number,
    min: 1,
    max: 31
  }
}, {
  timestamps: true
})

// Índice para busca rápida
accountSchema.index({ user: 1, isActive: 1 })

module.exports = mongoose.model('Account', accountSchema)
