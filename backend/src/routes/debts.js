const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Debt = require('../models/Debt');
const { protect } = require('../middleware/auth');

router.use(protect);

// @route   GET /api/debts
// @desc    Obter todas as dívidas
router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;
    if (type) query.type = type;

    const debts = await Debt.find(query).sort({ dueDay: 1 });
    res.json(debts);
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   GET /api/debts/summary
// @desc    Obter resumo das dívidas
router.get('/summary', async (req, res) => {
  try {
    const debts = await Debt.find({ user: req.user._id });

    const totalDebt = debts.reduce((sum, d) => sum + d.remainingAmount, 0);
    const activeDebts = debts.filter(d => d.status === 'active');
    const paidDebts = debts.filter(d => d.status === 'paid');

    const byType = debts.reduce((acc, d) => {
      if (!acc[d.type]) {
        acc[d.type] = { total: 0, remaining: 0, count: 0 };
      }
      acc[d.type].total += d.totalAmount;
      acc[d.type].remaining += d.remainingAmount;
      acc[d.type].count += 1;
      return acc;
    }, {});

    const monthlyPayment = activeDebts.reduce((sum, d) =>
      sum + (d.installmentAmount || 0), 0);

    res.json({
      totalDebt,
      totalOriginal: debts.reduce((sum, d) => sum + d.totalAmount, 0),
      activeCount: activeDebts.length,
      paidCount: paidDebts.length,
      monthlyPayment,
      byType
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   POST /api/debts
// @desc    Adicionar nova dívida
router.post('/', [
  body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('type').notEmpty().withMessage('Tipo é obrigatório'),
  body('totalAmount').isFloat({ min: 0.01 }).withMessage('Valor total é obrigatório'),
  body('remainingAmount').isFloat({ min: 0 }).withMessage('Valor restante é obrigatório')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const debt = await Debt.create({
      ...req.body,
      user: req.user._id
    });

    res.status(201).json(debt);
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   PUT /api/debts/:id
// @desc    Atualizar dívida
router.put('/:id', async (req, res) => {
  try {
    const debt = await Debt.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!debt) {
      return res.status(404).json({ message: 'Dívida não encontrada' });
    }

    const updated = await Debt.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   POST /api/debts/:id/payment
// @desc    Registrar pagamento de parcela
router.post('/:id/payment', [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valor do pagamento é obrigatório')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const debt = await Debt.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!debt) {
      return res.status(404).json({ message: 'Dívida não encontrada' });
    }

    debt.remainingAmount = Math.max(0, debt.remainingAmount - req.body.amount);
    debt.paidInstallments += 1;

    if (debt.remainingAmount === 0) {
      debt.status = 'paid';
    }

    await debt.save();
    res.json(debt);
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   DELETE /api/debts/:id
// @desc    Remover dívida
router.delete('/:id', async (req, res) => {
  try {
    const debt = await Debt.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!debt) {
      return res.status(404).json({ message: 'Dívida não encontrada' });
    }

    res.json({ message: 'Dívida removida com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

module.exports = router;
