const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const { protect, validateObjectId } = require('../middleware/auth');
const { normalizeToUTC } = require('../utils/dateHelper');
const { roundMoney, sumMoney, subtractMoney } = require('../utils/moneyHelper');

// Todas as rotas requerem autenticação
router.use(protect);

// @route   GET /api/transactions
// @desc    Obter todas as transações do usuário (com filtro por mês/ano)
router.get('/', async (req, res) => {
  try {
    const { type, category, startDate, endDate, month, year, limit = 100, page = 1 } = req.query;

    const query = { user: req.user._id };

    if (type) query.type = type;
    if (category) query.category = { $regex: new RegExp(`^${category}$`, 'i') }; // Case-insensitive

    // Filtro por mês/ano específico
    if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      query.date = { $gte: monthStart, $lte: monthEnd };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   GET /api/transactions/summary
// @desc    Obter resumo financeiro com saldo acumulado (como conta corrente)
router.get('/summary', async (req, res) => {
  try {
    const { month, year } = req.query;

    let startDate, endDate;
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();

    // Período do mês selecionado
    startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

    // Buscar transações do mês atual
    const transactions = await Transaction.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    });

    // Calcular receitas e despesas do mês (usando funções monetárias para precisão)
    const income = sumMoney(...transactions
      .filter(t => t.type === 'income')
      .map(t => t.amount));

    const expenses = sumMoney(...transactions
      .filter(t => t.type === 'expense')
      .map(t => t.amount));

    const monthBalance = subtractMoney(income, expenses);

    // SALDO ACUMULADO (como conta corrente)
    // Buscar TODAS as transações anteriores ao mês selecionado
    const previousTransactions = await Transaction.find({
      user: req.user._id,
      date: { $lt: startDate }
    });

    const previousIncome = sumMoney(...previousTransactions
      .filter(t => t.type === 'income')
      .map(t => t.amount));

    const previousExpenses = sumMoney(...previousTransactions
      .filter(t => t.type === 'expense')
      .map(t => t.amount));

    const previousBalance = subtractMoney(previousIncome, previousExpenses);

    // Saldo total acumulado (saldo anterior + saldo do mês atual)
    const accumulatedBalance = sumMoney(previousBalance, monthBalance);

    // Categorias do mês (normalizadas - agrupa por nome case-insensitive)
    const byCategoryRaw = transactions.reduce((acc, t) => {
      // Normalizar: primeira letra maiúscula, resto minúsculo
      const normalizedCategory = t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase();
      if (!acc[normalizedCategory]) {
        acc[normalizedCategory] = 0;
      }
      acc[normalizedCategory] += t.amount;
      return acc;
    }, {});

    // Ordenar por valor (maior para menor) e arredondar valores
    const byCategory = Object.fromEntries(
      Object.entries(byCategoryRaw)
        .map(([cat, val]) => [cat, roundMoney(val)])
        .sort(([,a], [,b]) => b - a)
    );

    res.json({
      income,                    // Receitas do mês
      expenses,                  // Despesas do mês
      balance: monthBalance,     // Saldo do mês (receitas - despesas)
      previousBalance,           // Saldo acumulado dos meses anteriores
      accumulatedBalance,        // Saldo total (como conta corrente)
      byCategory,
      period: {
        month: m,
        year: y,
        startDate,
        endDate
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   GET /api/transactions/analytics
// @desc    Obter análise detalhada de gastos
router.get('/analytics', async (req, res) => {
  try {
    const { month, year } = req.query;

    let currentMonthStart, currentMonthEnd, lastMonthStart, lastMonthEnd;

    if (month && year) {
      // Usar mês/ano especificado (em UTC para consistência)
      const m = parseInt(month) - 1;
      const y = parseInt(year);
      currentMonthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      currentMonthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
      lastMonthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      lastMonthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    } else {
      const now = new Date();
      currentMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
      currentMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
      lastMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0));
      lastMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999));
    }

    // Buscar transações dos dois meses
    const [currentTransactions, lastTransactions] = await Promise.all([
      Transaction.find({
        user: req.user._id,
        date: { $gte: currentMonthStart, $lte: currentMonthEnd }
      }),
      Transaction.find({
        user: req.user._id,
        date: { $gte: lastMonthStart, $lte: lastMonthEnd }
      })
    ]);

    // Despesas do mês atual (usando função monetária para precisão)
    const currentExpenses = currentTransactions.filter(t => t.type === 'expense');
    const currentTotal = sumMoney(...currentExpenses.map(t => t.amount));

    // Despesas do mês anterior
    const lastExpenses = lastTransactions.filter(t => t.type === 'expense');
    const lastTotal = sumMoney(...lastExpenses.map(t => t.amount));

    // Top 5 categorias (mês atual)
    const categoryTotals = {};
    currentExpenses.forEach(t => {
      if (!categoryTotals[t.category]) {
        categoryTotals[t.category] = 0;
      }
      categoryTotals[t.category] += t.amount;
    });

    const top5Categories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Comparativo por categoria (mês atual vs anterior)
    const lastCategoryTotals = {};
    lastExpenses.forEach(t => {
      if (!lastCategoryTotals[t.category]) {
        lastCategoryTotals[t.category] = 0;
      }
      lastCategoryTotals[t.category] += t.amount;
    });

    const comparison = top5Categories.map(cat => ({
      ...cat,
      lastMonth: lastCategoryTotals[cat.category] || 0,
      change: lastCategoryTotals[cat.category]
        ? ((cat.amount - lastCategoryTotals[cat.category]) / lastCategoryTotals[cat.category] * 100).toFixed(1)
        : null
    }));

    // Média diária de gastos
    const now = new Date();
    let daysInMonth;
    if (month && year) {
      // Se mês passado, usa total de dias do mês
      const m = parseInt(month) - 1;
      const y = parseInt(year);
      const isCurrentMonth = now.getFullYear() === y && now.getMonth() === m;
      daysInMonth = isCurrentMonth ? now.getDate() : new Date(y, m + 1, 0).getDate();
    } else {
      daysInMonth = now.getDate();
    }
    const dailyAverage = daysInMonth > 0 ? currentTotal / daysInMonth : 0;

    // Variação total mês a mês
    const monthlyChange = lastTotal > 0
      ? ((currentTotal - lastTotal) / lastTotal * 100).toFixed(1)
      : null;

    res.json({
      currentMonth: {
        total: currentTotal,
        transactionCount: currentExpenses.length
      },
      lastMonth: {
        total: lastTotal,
        transactionCount: lastExpenses.length
      },
      monthlyChange,
      dailyAverage,
      top5Categories: comparison,
      period: {
        current: { start: currentMonthStart, end: currentMonthEnd },
        last: { start: lastMonthStart, end: lastMonthEnd }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   GET /api/transactions/suggest-category
// @desc    Sugerir categoria baseada no histórico de descrições
router.get('/suggest-category', async (req, res) => {
  try {
    const { description } = req.query;

    if (!description || description.trim().length < 2) {
      return res.json({ category: null, confidence: 0, suggestions: [] });
    }

    const searchTerm = description.trim().toLowerCase();

    // 1. Buscar correspondência EXATA primeiro (case insensitive)
    const exactMatch = await Transaction.findOne({
      user: req.user._id,
      description: { $regex: new RegExp(`^${searchTerm}$`, 'i') }
    }).sort({ date: -1 });

    if (exactMatch) {
      return res.json({
        category: exactMatch.category,
        type: exactMatch.type,
        confidence: 100,
        matchType: 'exact',
        suggestions: [{
          description: exactMatch.description,
          category: exactMatch.category,
          type: exactMatch.type,
          count: 1
        }]
      });
    }

    // 2. Buscar correspondência PARCIAL (começa com ou contém)
    const partialMatches = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          description: { $regex: new RegExp(searchTerm, 'i') }
        }
      },
      {
        $group: {
          _id: {
            descriptionLower: { $toLower: '$description' },
            category: '$category',
            type: '$type'
          },
          count: { $sum: 1 },
          lastUsed: { $max: '$date' },
          originalDescription: { $first: '$description' }
        }
      },
      {
        $sort: { count: -1, lastUsed: -1 }
      },
      {
        $limit: 5
      }
    ]);

    if (partialMatches.length > 0) {
      // Retorna a categoria mais usada
      const bestMatch = partialMatches[0];
      return res.json({
        category: bestMatch._id.category,
        type: bestMatch._id.type,
        confidence: partialMatches.length === 1 ? 90 : 70,
        matchType: 'partial',
        suggestions: partialMatches.map(m => ({
          description: m.originalDescription,
          category: m._id.category,
          type: m._id.type,
          count: m.count
        }))
      });
    }

    // 3. Nenhuma correspondência encontrada
    return res.json({
      category: null,
      type: null,
      confidence: 0,
      matchType: 'none',
      suggestions: []
    });

  } catch (error) {
    res.status(500).json({ message: 'Erro ao sugerir categoria', error: error.message });
  }
});

// @route   GET /api/transactions/autocomplete
// @desc    Autocomplete de descrições baseado no histórico
router.get('/autocomplete', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const searchTerm = q.trim();

    // Buscar descrições únicas que correspondem
    const suggestions = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          description: { $regex: new RegExp(searchTerm, 'i') }
        }
      },
      {
        $group: {
          _id: { $toLower: '$description' },
          description: { $first: '$description' },
          category: { $first: '$category' },
          type: { $first: '$type' },
          count: { $sum: 1 },
          lastUsed: { $max: '$date' }
        }
      },
      {
        $sort: { count: -1, lastUsed: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          _id: 0,
          description: 1,
          category: 1,
          type: 1,
          count: 1
        }
      }
    ]);

    return res.json({ suggestions });

  } catch (error) {
    res.status(500).json({ message: 'Erro no autocomplete', error: error.message });
  }
});

// @route   POST /api/transactions
// @desc    Criar nova transação
router.post('/', [
  body('type').isIn(['income', 'expense']).withMessage('Tipo deve ser income ou expense'),
  body('category').notEmpty().withMessage('Categoria é obrigatória'),
  body('description').trim().notEmpty().withMessage('Descrição é obrigatória'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Valor deve ser maior que zero')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Normalizar a data para UTC, preservando o dia informado pelo usuário
    const transactionData = {
      ...req.body,
      user: req.user._id
    };

    if (req.body.date) {
      transactionData.date = normalizeToUTC(req.body.date);
    }

    const transaction = await Transaction.create(transactionData);

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Atualizar transação
router.put('/:id', validateObjectId(), async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transação não encontrada' });
    }

    // Normalizar a data se estiver sendo atualizada
    const updateData = { ...req.body };
    if (req.body.date) {
      updateData.date = normalizeToUTC(req.body.date);
    }

    const updatedTransaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json(updatedTransaction);
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   DELETE /api/transactions/:id
// @desc    Deletar transação
router.delete('/:id', validateObjectId(), async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transação não encontrada' });
    }

    res.json({ message: 'Transação removida com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   POST /api/transactions/link-all-to-account
// @desc    Vincular todas as transações sem conta a uma conta específica
router.post('/link-all-to-account', async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ message: 'accountId é obrigatório' });
    }

    // Verificar se a conta pertence ao usuário
    const Account = require('../models/Account');
    const account = await Account.findOne({ _id: accountId, user: req.user._id });
    if (!account) {
      return res.status(404).json({ message: 'Conta não encontrada' });
    }

    // Atualizar todas as transações sem conta
    const result = await Transaction.updateMany(
      { user: req.user._id, account: { $exists: false } },
      { $set: { account: accountId } }
    );

    // Também atualizar transações com account null
    const result2 = await Transaction.updateMany(
      { user: req.user._id, account: null },
      { $set: { account: accountId } }
    );

    const totalUpdated = result.modifiedCount + result2.modifiedCount;

    res.json({
      message: `${totalUpdated} transações vinculadas à conta "${account.name}"`,
      modifiedCount: totalUpdated,
      accountName: account.name
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao vincular transações', error: error.message });
  }
});

// @route   POST /api/transactions/fix-account-refs
// @desc    Corrigir referências de account - vincular TODAS ao Banco Principal
router.post('/fix-account-refs', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Account = require('../models/Account');

    // Buscar a conta principal do usuário
    const mainAccount = await Account.findOne({ user: req.user._id, name: 'Banco Principal' });
    if (!mainAccount) {
      return res.status(404).json({ message: 'Conta "Banco Principal" não encontrada' });
    }

    const collection = mongoose.connection.collection('transactions');
    const userId = new mongoose.Types.ObjectId(req.user._id);

    // 1. Corrigir transações onde account é string
    const stringAccountTxs = await collection.find({
      user: userId,
      account: { $type: 'string' }
    }).toArray();

    let fixedStrings = 0;
    for (const tx of stringAccountTxs) {
      try {
        await collection.updateOne(
          { _id: tx._id },
          { $set: { account: mainAccount._id } }
        );
        fixedStrings++;
      } catch (e) {
        console.error('Erro ao corrigir tx:', tx._id, e.message);
      }
    }

    // 2. Vincular transações sem account
    const noAccountResult = await collection.updateMany(
      {
        user: userId,
        $or: [
          { account: { $exists: false } },
          { account: null }
        ]
      },
      { $set: { account: mainAccount._id } }
    );

    // 3. Vincular transações com account diferente do Banco Principal
    const wrongAccountResult = await collection.updateMany(
      {
        user: userId,
        account: { $ne: mainAccount._id }
      },
      { $set: { account: mainAccount._id } }
    );

    res.json({
      message: 'Todas as transações foram vinculadas ao Banco Principal',
      fixedStrings,
      linkedNoAccount: noAccountResult.modifiedCount,
      linkedWrongAccount: wrongAccountResult.modifiedCount,
      total: await collection.countDocuments({ user: userId })
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao corrigir referências', error: error.message });
  }
});

// @route   GET /api/transactions/diagnose-accounts
// @desc    Diagnosticar tipos de account field no MongoDB
router.get('/diagnose-accounts', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Account = require('../models/Account');
    const collection = mongoose.connection.collection('transactions');

    // Conta Principal
    const mainAccount = await Account.findOne({ user: req.user._id, name: 'Banco Principal' });

    // Contar por tipo de campo account
    const stats = await collection.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user._id) } },
      {
        $group: {
          _id: { $type: '$account' },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Contar transações por account ID (para ver quais accounts têm transações)
    const accountDistribution = await collection.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user._id) } },
      {
        $group: {
          _id: '$account',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Buscar transações que NÃO correspondem à conta principal
    const nonMatchingTxs = mainAccount ? await collection.find({
      user: new mongoose.Types.ObjectId(req.user._id),
      account: { $ne: mainAccount._id },
      status: 'confirmed'
    }).toArray() : [];

    // Contar transações que correspondem à conta pelo ID
    const matchingAccountId = mainAccount ? await collection.countDocuments({
      user: new mongoose.Types.ObjectId(req.user._id),
      account: mainAccount._id,
      status: 'confirmed'
    }) : 0;

    res.json({
      mainAccountId: mainAccount?._id,
      accountFieldTypes: stats,
      accountDistribution,
      matchingAccountId,
      nonMatchingCount: nonMatchingTxs.length,
      nonMatchingTxs: nonMatchingTxs.map(t => ({
        _id: t._id,
        description: t.description,
        amount: t.amount,
        type: t.type,
        account: t.account
      })),
      expectedTotal: await collection.countDocuments({
        user: new mongoose.Types.ObjectId(req.user._id),
        status: 'confirmed'
      })
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no diagnóstico', error: error.message });
  }
});

module.exports = router;
