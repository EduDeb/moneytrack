const mongoose = require('mongoose')

const tagSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Nome da tag é obrigatório'],
    trim: true
  },
  color: {
    type: String,
    default: '#6b7280'
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
})

// Índice único por usuário e nome
tagSchema.index({ user: 1, name: 1 }, { unique: true })

module.exports = mongoose.model('Tag', tagSchema)
