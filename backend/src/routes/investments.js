const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Investment = require('../models/Investment');
const { protect } = require('../middleware/auth');

router.use(protect);

// @route   GET /api/investments
// @desc    Obter todos os investimentos
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    const query = { user: req.user._id };
    if (type) query.type = type;

    const investments = await Investment.find(query).sort({ createdAt: -1 });
    res.json(investments);
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   GET /api/investments/summary
// @desc    Obter resumo da carteira
router.get('/summary', async (req, res) => {
  try {
    const investments = await Investment.find({ user: req.user._id });

    const totalInvested = investments.reduce((sum, inv) =>
      sum + (inv.quantity * inv.purchasePrice), 0);

    const currentValue = investments.reduce((sum, inv) =>
      sum + (inv.quantity * inv.currentPrice), 0);

    const byType = investments.reduce((acc, inv) => {
      if (!acc[inv.type]) {
        acc[inv.type] = { invested: 0, current: 0, count: 0 };
      }
      acc[inv.type].invested += inv.quantity * inv.purchasePrice;
      acc[inv.type].current += inv.quantity * inv.currentPrice;
      acc[inv.type].count += 1;
      return acc;
    }, {});

    res.json({
      totalInvested,
      currentValue,
      profit: currentValue - totalInvested,
      profitPercentage: totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0,
      byType,
      totalAssets: investments.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   POST /api/investments
// @desc    Adicionar novo investimento
router.post('/', [
  body('type').notEmpty().withMessage('Tipo é obrigatório'),
  body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('quantity').isFloat({ min: 0 }).withMessage('Quantidade deve ser positiva'),
  body('purchasePrice').isFloat({ min: 0.01 }).withMessage('Preço de compra é obrigatório')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const investment = await Investment.create({
      ...req.body,
      currentPrice: req.body.currentPrice || req.body.purchasePrice,
      user: req.user._id
    });

    res.status(201).json(investment);
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   PUT /api/investments/:id
// @desc    Atualizar investimento
router.put('/:id', async (req, res) => {
  try {
    const investment = await Investment.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!investment) {
      return res.status(404).json({ message: 'Investimento não encontrado' });
    }

    const updated = await Investment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// @route   DELETE /api/investments/:id
// @desc    Remover investimento
router.delete('/:id', async (req, res) => {
  try {
    const investment = await Investment.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!investment) {
      return res.status(404).json({ message: 'Investimento não encontrado' });
    }

    res.json({ message: 'Investimento removido com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

module.exports = router;
