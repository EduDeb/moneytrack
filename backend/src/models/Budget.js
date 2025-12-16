const mongoose = require('mongoose')

const budgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    trim: true
  },
  limit: {
    type: Number,
    required: [true, 'Limite é obrigatório'],
    min: [1, 'Limite deve ser maior que zero']
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
})

// Índice único para evitar duplicatas
budgetSchema.index({ user: 1, category: 1, month: 1, year: 1 }, { unique: true })

module.exports = mongoose.model('Budget', budgetSchema)
