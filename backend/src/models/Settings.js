const mongoose = require('mongoose')

const settingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Aparência
  theme: {
    type: String,
    enum: ['light', 'dark', 'system'],
    default: 'light'
  },
  primaryColor: {
    type: String,
    default: '#3b82f6' // blue-500
  },
  language: {
    type: String,
    default: 'pt-BR'
  },
  currency: {
    type: String,
    default: 'BRL'
  },
  dateFormat: {
    type: String,
    default: 'DD/MM/YYYY'
  },
  // Notificações (estrutura plana para compatibilidade com frontend)
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    billReminders: { type: Boolean, default: true },
    goalAlerts: { type: Boolean, default: true },
    weeklyReport: { type: Boolean, default: false },
    monthlyReport: { type: Boolean, default: false },
    budgetAlerts: { type: Boolean, default: true },
    reminderDaysBefore: { type: Number, default: 3 }
  },
  // Privacidade
  privacy: {
    hideBalances: { type: Boolean, default: false },
    requirePasswordOnOpen: { type: Boolean, default: false },
    autoLock: { type: Boolean, default: false },
    autoLockMinutes: { type: Number, default: 5 },
    pin: { type: String }
  },
  // Dashboard
  dashboard: {
    showBills: { type: Boolean, default: true },
    showBudget: { type: Boolean, default: true },
    showGoals: { type: Boolean, default: true },
    showAnalytics: { type: Boolean, default: true },
    defaultAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' }
  },
  // Configurações regionais
  startOfWeek: {
    type: String,
    enum: ['sunday', 'monday'],
    default: 'sunday'
  },
  fiscalYearStart: {
    type: Number,
    min: 1,
    max: 12,
    default: 1
  },
  numberFormat: {
    type: String,
    default: 'pt-BR'
  },
  // Primeiro dia da semana (0 = Domingo, 1 = Segunda) - deprecated, use startOfWeek
  firstDayOfWeek: {
    type: Number,
    default: 0
  },
  // Categorias padrão para lançamento rápido
  quickCategories: [{
    type: String
  }]
}, {
  timestamps: true
})

module.exports = mongoose.model('Settings', settingsSchema)
