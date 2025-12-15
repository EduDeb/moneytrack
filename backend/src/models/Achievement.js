const mongoose = require('mongoose')

const achievementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  achievementId: {
    type: String,
    required: true
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  },
  notified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

// Índice único para evitar duplicatas
achievementSchema.index({ user: 1, achievementId: 1 }, { unique: true })

// Índice para buscar conquistas não notificadas
achievementSchema.index({ user: 1, notified: 1 })

module.exports = mongoose.model('Achievement', achievementSchema)
