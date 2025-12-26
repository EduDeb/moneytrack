const mongoose = require('mongoose')
const { capitalize } = require('../utils/stringHelper')

const categorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Nome da categoria é obrigatório'],
    trim: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: [true, 'Tipo da categoria é obrigatório']
  },
  icon: {
    type: String,
    default: 'Tag'
  },
  color: {
    type: String,
    default: '#6b7280'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Índice composto para garantir nome único por usuário e tipo
categorySchema.index({ user: 1, name: 1, type: 1 }, { unique: true })

// Capitalizar automaticamente nome (usando setter)
categorySchema.path('name').set(function(v) {
  return v ? capitalize(v) : v
})

module.exports = mongoose.model('Category', categorySchema)
