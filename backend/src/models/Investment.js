const mongoose = require('mongoose');
const { capitalize } = require('../utils/stringHelper');

const investmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['acao', 'fii', 'criptomoeda', 'renda_fixa', 'tesouro', 'fundo', 'outro'],
    required: [true, 'Tipo de investimento é obrigatório']
  },
  name: {
    type: String,
    required: [true, 'Nome do ativo é obrigatório'],
    trim: true
  },
  ticker: {
    type: String,
    trim: true,
    uppercase: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantidade é obrigatória'],
    min: [0, 'Quantidade não pode ser negativa']
  },
  purchasePrice: {
    type: Number,
    required: [true, 'Preço de compra é obrigatório'],
    min: [0.01, 'Preço deve ser maior que zero']
  },
  currentPrice: {
    type: Number,
    default: 0
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

investmentSchema.virtual('totalInvested').get(function() {
  return this.quantity * this.purchasePrice;
});

investmentSchema.virtual('currentValue').get(function() {
  return this.quantity * this.currentPrice;
});

investmentSchema.virtual('profit').get(function() {
  return this.currentValue - this.totalInvested;
});

investmentSchema.virtual('profitPercentage').get(function() {
  if (this.totalInvested === 0) return 0;
  return ((this.currentValue - this.totalInvested) / this.totalInvested) * 100;
});

investmentSchema.set('toJSON', { virtuals: true });

// Índices para otimização de queries
investmentSchema.index({ user: 1 });
investmentSchema.index({ user: 1, type: 1 });
investmentSchema.index({ user: 1, ticker: 1 });

// Capitalizar automaticamente nome (usando setter)
investmentSchema.path('name').set(function(v) {
  return v ? capitalize(v) : v;
});

module.exports = mongoose.model('Investment', investmentSchema);
