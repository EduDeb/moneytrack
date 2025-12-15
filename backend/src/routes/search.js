const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Bill = require('../models/Bill');
const Goal = require('../models/Goal');
const Investment = require('../models/Investment');
const Debt = require('../models/Debt');
const Recurring = require('../models/Recurring');
const Category = require('../models/Category');

// Todas as rotas requerem autenticação
router.use(protect);

// @route   GET /api/search
// @desc    Busca global em todas as entidades
router.get('/', async (req, res) => {
  try {
    const { q, type, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'A busca deve ter pelo menos 2 caracteres' });
    }

    const searchRegex = new RegExp(q, 'i');
    const userId = req.user._id;
    const limitNum = Math.min(parseInt(limit), 50);

    const results = {
      transactions: [],
      accounts: [],
      bills: [],
      goals: [],
      investments: [],
      debts: [],
      recurring: [],
      categories: [],
      total: 0
    };

    // Se type específico, busca apenas nele
    const searchTypes = type ? [type] : ['transactions', 'accounts', 'bills', 'goals', 'investments', 'debts', 'recurring', 'categories'];

    const searches = [];

    if (searchTypes.includes('transactions')) {
      searches.push(
        Transaction.find({
          user: userId,
          $or: [
            { description: searchRegex },
            { category: searchRegex },
            { notes: searchRegex }
          ]
        })
        .sort({ date: -1 })
        .limit(limitNum)
        .lean()
        .then(items => {
          results.transactions = items.map(item => ({
            ...item,
            _type: 'transaction',
            _icon: item.type === 'income' ? 'trending-up' : 'trending-down',
            _color: item.type === 'income' ? '#22c55e' : '#ef4444',
            _subtitle: `${item.type === 'income' ? 'Receita' : 'Despesa'} - ${new Date(item.date).toLocaleDateString('pt-BR')}`,
            _link: '/transactions'
          }));
        })
      );
    }

    if (searchTypes.includes('accounts')) {
      searches.push(
        Account.find({
          user: userId,
          $or: [
            { name: searchRegex },
            { institution: searchRegex }
          ]
        })
        .limit(limitNum)
        .lean()
        .then(items => {
          results.accounts = items.map(item => ({
            ...item,
            _type: 'account',
            _icon: 'wallet',
            _color: item.color || '#3b82f6',
            _subtitle: `Saldo: R$ ${item.balance?.toFixed(2) || '0.00'}`,
            _link: '/accounts'
          }));
        })
      );
    }

    if (searchTypes.includes('bills')) {
      searches.push(
        Bill.find({
          user: userId,
          $or: [
            { name: searchRegex },
            { category: searchRegex },
            { notes: searchRegex }
          ]
        })
        .sort({ dueDay: 1 })
        .limit(limitNum)
        .lean()
        .then(items => {
          results.bills = items.map(item => ({
            ...item,
            _type: 'bill',
            _icon: 'file-text',
            _color: item.isPaid ? '#22c55e' : '#f97316',
            _subtitle: `Vence dia ${item.dueDay} - R$ ${item.amount?.toFixed(2)}`,
            _link: '/bills'
          }));
        })
      );
    }

    if (searchTypes.includes('goals')) {
      searches.push(
        Goal.find({
          user: userId,
          $or: [
            { name: searchRegex },
            { notes: searchRegex }
          ]
        })
        .limit(limitNum)
        .lean()
        .then(items => {
          results.goals = items.map(item => ({
            ...item,
            _type: 'goal',
            _icon: 'target',
            _color: item.color || '#8b5cf6',
            _subtitle: `${((item.currentAmount / item.targetAmount) * 100).toFixed(0)}% completo`,
            _link: '/goals'
          }));
        })
      );
    }

    if (searchTypes.includes('investments')) {
      searches.push(
        Investment.find({
          user: userId,
          $or: [
            { name: searchRegex },
            { ticker: searchRegex },
            { type: searchRegex }
          ]
        })
        .limit(limitNum)
        .lean()
        .then(items => {
          results.investments = items.map(item => ({
            ...item,
            _type: 'investment',
            _icon: 'bar-chart-2',
            _color: '#10b981',
            _subtitle: `${item.ticker || item.type} - ${item.quantity} unidades`,
            _link: '/investments'
          }));
        })
      );
    }

    if (searchTypes.includes('debts')) {
      searches.push(
        Debt.find({
          user: userId,
          $or: [
            { name: searchRegex },
            { creditor: searchRegex },
            { notes: searchRegex }
          ]
        })
        .limit(limitNum)
        .lean()
        .then(items => {
          results.debts = items.map(item => ({
            ...item,
            _type: 'debt',
            _icon: 'credit-card',
            _color: '#ef4444',
            _subtitle: `Restante: R$ ${item.remainingAmount?.toFixed(2)}`,
            _link: '/debts'
          }));
        })
      );
    }

    if (searchTypes.includes('recurring')) {
      searches.push(
        Recurring.find({
          user: userId,
          $or: [
            { name: searchRegex },
            { category: searchRegex }
          ]
        })
        .limit(limitNum)
        .lean()
        .then(items => {
          results.recurring = items.map(item => ({
            ...item,
            _type: 'recurring',
            _icon: 'repeat',
            _color: item.type === 'income' ? '#22c55e' : '#f97316',
            _subtitle: `${item.frequency} - R$ ${item.amount?.toFixed(2)}`,
            _link: '/recurring'
          }));
        })
      );
    }

    if (searchTypes.includes('categories')) {
      searches.push(
        Category.find({
          user: userId,
          name: searchRegex
        })
        .limit(limitNum)
        .lean()
        .then(items => {
          results.categories = items.map(item => ({
            ...item,
            _type: 'category',
            _icon: item.icon || 'tag',
            _color: item.color || '#6b7280',
            _subtitle: item.type === 'income' ? 'Receita' : 'Despesa',
            _link: '/categories'
          }));
        })
      );
    }

    await Promise.all(searches);

    // Calcular total
    results.total =
      results.transactions.length +
      results.accounts.length +
      results.bills.length +
      results.goals.length +
      results.investments.length +
      results.debts.length +
      results.recurring.length +
      results.categories.length;

    res.json(results);
  } catch (error) {
    console.error('Erro na busca global:', error);
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   GET /api/search/suggestions
// @desc    Sugestões de busca baseadas no histórico
router.get('/suggestions', async (req, res) => {
  try {
    const userId = req.user._id;

    // Buscar categorias mais usadas
    const topCategories = await Transaction.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Buscar descrições mais frequentes
    const topDescriptions = await Transaction.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$description', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      categories: topCategories.map(c => c._id),
      descriptions: topDescriptions.map(d => d._id).filter(Boolean)
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

module.exports = router;
