const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Nome da dívida é obrigatório'],
    trim: true
  },
  type: {
    type: String,
    enum: ['emprestimo', 'financiamento', 'cartao_credito', 'cheque_especial', 'outro'],
    required: [true, 'Tipo de dívida é obrigatório']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Valor total é obrigatório'],
    min: [0.01, 'Valor deve ser maior que zero']
  },
  remainingAmount: {
    type: Number,
    required: [true, 'Valor restante é obrigatório'],
    min: [0, 'Valor não pode ser negativo']
  },
  interestRate: {
    type: Number,
    default: 0,
    min: [0, 'Taxa de juros não pode ser negativa']
  },
  installments: {
    type: Number,
    default: 1,
    min: [1, 'Número de parcelas deve ser pelo menos 1']
  },
  paidInstallments: {
    type: Number,
    default: 0,
    min: [0, 'Parcelas pagas não pode ser negativo']
  },
  installmentAmount: {
    type: Number,
    min: [0, 'Valor da parcela não pode ser negativo']
  },
  dueDay: {
    type: Number,
    min: [1, 'Dia de vencimento deve ser entre 1 e 31'],
    max: [31, 'Dia de vencimento deve ser entre 1 e 31']
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  creditor: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'paid', 'overdue'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

debtSchema.virtual('progress').get(function() {
  if (this.totalAmount === 0) return 100;
  return ((this.totalAmount - this.remainingAmount) / this.totalAmount) * 100;
});

debtSchema.set('toJSON', { virtuals: true });

// Índices para otimização de queries
debtSchema.index({ user: 1 });
debtSchema.index({ user: 1, status: 1 });
debtSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('Debt', debtSchema);
