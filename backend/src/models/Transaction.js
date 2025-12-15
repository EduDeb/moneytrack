const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense', 'transfer'],
    required: [true, 'Tipo é obrigatório']
  },
  category: {
    type: String,
    required: [true, 'Categoria é obrigatória']
  },
  description: {
    type: String,
    required: [true, 'Descrição é obrigatória'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Valor é obrigatório'],
    min: [0.01, 'Valor deve ser maior que zero']
  },
  date: {
    type: Date,
    default: Date.now
  },
  // Conta bancária
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  // Para transferências
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  // Tags
  tags: [{
    type: String,
    trim: true
  }],
  // Anexos (URLs ou paths)
  attachments: [{
    name: String,
    url: String,
    type: String, // 'image', 'pdf', 'other'
    uploadedAt: { type: Date, default: Date.now }
  }],
  // Notas adicionais
  notes: {
    type: String,
    trim: true
  },
  // Parcelamento
  isInstallment: {
    type: Boolean,
    default: false
  },
  installmentNumber: {
    type: Number
  },
  totalInstallments: {
    type: Number
  },
  installmentGroupId: {
    type: String // ID para agrupar parcelas
  },
  // Recorrência
  recurringId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recurring'
  },
  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'confirmed'
  },
  // Localização (opcional)
  location: {
    name: String,
    latitude: Number,
    longitude: Number
  },
  // Campos de controle
  isReconciled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Índices para performance
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1 });
transactionSchema.index({ user: 1, account: 1, date: -1 });
transactionSchema.index({ installmentGroupId: 1 });
transactionSchema.index({ tags: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
