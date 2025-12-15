const express = require('express')
const router = express.Router()
const Tag = require('../models/Tag')
const Transaction = require('../models/Transaction')
const { protect } = require('../middleware/auth')

router.use(protect)

// @route   GET /api/tags
// @desc    Listar todas as tags do usuário
router.get('/', async (req, res) => {
  try {
    const tags = await Tag.find({ user: req.user._id })
      .sort({ usageCount: -1, name: 1 })

    res.json({ tags })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar tags', error: error.message })
  }
})

// @route   GET /api/tags/popular
// @desc    Tags mais usadas
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query

    const tags = await Tag.find({ user: req.user._id })
      .sort({ usageCount: -1 })
      .limit(parseInt(limit))

    res.json({ tags })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar tags populares', error: error.message })
  }
})

// @route   GET /api/tags/:id/transactions
// @desc    Transações com uma tag específica
router.get('/:id/transactions', async (req, res) => {
  try {
    const tag = await Tag.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!tag) {
      return res.status(404).json({ message: 'Tag não encontrada' })
    }

    const { page = 1, limit = 20, startDate, endDate } = req.query

    const query = {
      user: req.user._id,
      tags: tag.name
    }

    if (startDate || endDate) {
      query.date = {}
      if (startDate) query.date.$gte = new Date(startDate)
      if (endDate) query.date.$lte = new Date(endDate)
    }

    const transactions = await Transaction.find(query)
      .populate('account', 'name color')
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))

    const total = await Transaction.countDocuments(query)

    // Calcular totais
    const totals = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ])

    res.json({
      tag,
      transactions,
      totals: totals.reduce((acc, t) => ({ ...acc, [t._id]: t.total }), {}),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar transações', error: error.message })
  }
})

// @route   POST /api/tags
// @desc    Criar nova tag
router.post('/', async (req, res) => {
  try {
    const { name, color, icon } = req.body

    // Verificar se já existe
    const existing = await Tag.findOne({
      user: req.user._id,
      name: name.toLowerCase().trim()
    })

    if (existing) {
      return res.status(400).json({ message: 'Tag já existe' })
    }

    const tag = await Tag.create({
      user: req.user._id,
      name: name.toLowerCase().trim(),
      color: color || '#6b7280',
      icon: icon || 'Tag'
    })

    res.status(201).json({ tag })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar tag', error: error.message })
  }
})

// @route   POST /api/tags/bulk
// @desc    Criar múltiplas tags
router.post('/bulk', async (req, res) => {
  try {
    const { tags } = req.body

    const created = []
    const skipped = []

    for (const tagData of tags) {
      const name = tagData.name ? tagData.name.toLowerCase().trim() : tagData.toLowerCase().trim()

      const existing = await Tag.findOne({
        user: req.user._id,
        name
      })

      if (existing) {
        skipped.push(name)
        continue
      }

      const tag = await Tag.create({
        user: req.user._id,
        name,
        color: tagData.color || '#6b7280',
        icon: tagData.icon || 'Tag'
      })

      created.push(tag)
    }

    res.status(201).json({
      message: `${created.length} tags criadas, ${skipped.length} já existiam`,
      created,
      skipped
    })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar tags', error: error.message })
  }
})

// @route   PUT /api/tags/:id
// @desc    Atualizar tag
router.put('/:id', async (req, res) => {
  try {
    const tag = await Tag.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!tag) {
      return res.status(404).json({ message: 'Tag não encontrada' })
    }

    const oldName = tag.name
    const { name, color, icon } = req.body

    if (name && name !== oldName) {
      // Verificar se novo nome já existe
      const existing = await Tag.findOne({
        user: req.user._id,
        name: name.toLowerCase().trim(),
        _id: { $ne: tag._id }
      })

      if (existing) {
        return res.status(400).json({ message: 'Tag com este nome já existe' })
      }

      tag.name = name.toLowerCase().trim()

      // Atualizar transações com a tag antiga
      await Transaction.updateMany(
        { user: req.user._id, tags: oldName },
        { $set: { 'tags.$': tag.name } }
      )
    }

    if (color) tag.color = color
    if (icon) tag.icon = icon

    await tag.save()
    res.json({ tag })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar tag', error: error.message })
  }
})

// @route   DELETE /api/tags/:id
// @desc    Excluir tag
router.delete('/:id', async (req, res) => {
  try {
    const { removeFromTransactions } = req.query

    const tag = await Tag.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!tag) {
      return res.status(404).json({ message: 'Tag não encontrada' })
    }

    // Remover tag das transações se solicitado
    if (removeFromTransactions === 'true') {
      await Transaction.updateMany(
        { user: req.user._id, tags: tag.name },
        { $pull: { tags: tag.name } }
      )
    }

    await Tag.findByIdAndDelete(tag._id)

    res.json({ message: 'Tag excluída com sucesso' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir tag', error: error.message })
  }
})

// @route   POST /api/tags/merge
// @desc    Mesclar duas tags
router.post('/merge', async (req, res) => {
  try {
    const { sourceId, targetId } = req.body

    const [source, target] = await Promise.all([
      Tag.findOne({ _id: sourceId, user: req.user._id }),
      Tag.findOne({ _id: targetId, user: req.user._id })
    ])

    if (!source || !target) {
      return res.status(404).json({ message: 'Tag não encontrada' })
    }

    // Substituir tag source por target nas transações
    await Transaction.updateMany(
      { user: req.user._id, tags: source.name },
      { $set: { 'tags.$': target.name } }
    )

    // Atualizar contagem
    const newCount = await Transaction.countDocuments({
      user: req.user._id,
      tags: target.name
    })

    target.usageCount = newCount
    await target.save()

    // Remover tag source
    await Tag.findByIdAndDelete(source._id)

    res.json({
      message: `Tag "${source.name}" mesclada com "${target.name}"`,
      tag: target
    })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao mesclar tags', error: error.message })
  }
})

// @route   GET /api/tags/stats
// @desc    Estatísticas das tags
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    const query = { user: req.user._id }
    if (startDate || endDate) {
      query.date = {}
      if (startDate) query.date.$gte = new Date(startDate)
      if (endDate) query.date.$lte = new Date(endDate)
    }

    // Agregação para estatísticas por tag
    const stats = await Transaction.aggregate([
      { $match: query },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          incomeAmount: {
            $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
          },
          expenseAmount: {
            $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
          }
        }
      },
      { $sort: { totalTransactions: -1 } }
    ])

    res.json({ stats })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar estatísticas', error: error.message })
  }
})

module.exports = router
