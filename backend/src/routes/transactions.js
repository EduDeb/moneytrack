const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const { protect, validateObjectId } = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(protect);

// @route   GET /api/transactions
// @desc    Obter todas as transações do usuário (com filtro por mês/ano)
router.get('/', async (req, res) => {
  try {
    const { type, category, startDate, endDate, month, year, limit = 100, page = 1 } = req.query;

    const query = { user: req.user._id };

    if (type) query.type = type;
    if (category) query.category = category;

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

    // Calcular receitas e despesas do mês
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthBalance = income - expenses;

    // SALDO ACUMULADO (como conta corrente)
    // Buscar TODAS as transações anteriores ao mês selecionado
    const previousTransactions = await Transaction.find({
      user: req.user._id,
      date: { $lt: startDate }
    });

    const previousIncome = previousTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const previousExpenses = previousTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const previousBalance = previousIncome - previousExpenses;

    // Saldo total acumulado (saldo anterior + saldo do mês atual)
    const accumulatedBalance = previousBalance + monthBalance;

    // Categorias do mês
    const byCategory = transactions.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = 0;
      }
      acc[t.category] += t.amount;
      return acc;
    }, {});

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

    // Despesas do mês atual
    const currentExpenses = currentTransactions.filter(t => t.type === 'expense');
    const currentTotal = currentExpenses.reduce((sum, t) => sum + t.amount, 0);

    // Despesas do mês anterior
    const lastExpenses = lastTransactions.filter(t => t.type === 'expense');
    const lastTotal = lastExpenses.reduce((sum, t) => sum + t.amount, 0);

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

    const transaction = await Transaction.create({
      ...req.body,
      user: req.user._id
    });

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

    const updatedTransaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
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

module.exports = router;
