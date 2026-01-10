const express = require('express')
const router = express.Router()
const Category = require('../models/Category')
const { protect } = require('../middleware/auth')

router.use(protect)

// Categorias padrão do sistema
const DEFAULT_CATEGORIES = {
  income: [
    { name: 'Salário', icon: 'Briefcase', color: '#22c55e' },
    { name: 'Freelance', icon: 'Laptop', color: '#3b82f6' },
    { name: 'Investimentos', icon: 'TrendingUp', color: '#8b5cf6' },
    { name: 'Presente', icon: 'Gift', color: '#ec4899' },
    { name: 'Outros', icon: 'Plus', color: '#6b7280' }
  ],
  expense: [
    { name: 'Alimentação', icon: 'Utensils', color: '#f97316' },
    { name: 'Supermercado', icon: 'ShoppingCart', color: '#84cc16' },
    { name: 'Transporte', icon: 'Car', color: '#06b6d4' },
    { name: 'Colaboradores', icon: 'Users', color: '#3b82f6' },
    { name: 'Moradia', icon: 'Home', color: '#8b5cf6' },
    { name: 'Carro', icon: 'CarFront', color: '#64748b' },
    { name: 'Manutenção Casa', icon: 'Wrench', color: '#78716c' },
    { name: 'Saúde', icon: 'Heart', color: '#ef4444' },
    { name: 'Educação', icon: 'GraduationCap', color: '#22c55e' },
    { name: 'Lazer', icon: 'Gamepad2', color: '#ec4899' },
    { name: 'Compras', icon: 'ShoppingBag', color: '#f59e0b' },
    { name: 'Contas', icon: 'Receipt', color: '#6366f1' },
    { name: 'Assinaturas', icon: 'CreditCard', color: '#14b8a6' },
    { name: 'Pets', icon: 'PawPrint', color: '#a855f7' },
    { name: 'Imposto', icon: 'FileText', color: '#dc2626' },
    { name: 'Outros', icon: 'MoreHorizontal', color: '#6b7280' }
  ]
}

// @route   GET /api/categories
// @desc    Listar todas as categorias do usuário (incluindo padrão)
router.get('/', async (req, res) => {
  try {
    const { type } = req.query

    // Buscar categorias do usuário
    const query = { user: req.user._id, isActive: true }
    if (type) query.type = type

    const userCategories = await Category.find(query).sort({ name: 1 })

    // Se usuário não tem categorias, criar as padrão
    if (userCategories.length === 0) {
      const defaultCats = []

      for (const t of ['income', 'expense']) {
        for (const cat of DEFAULT_CATEGORIES[t]) {
          defaultCats.push({
            user: req.user._id,
            type: t,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            isDefault: true
          })
        }
      }

      await Category.insertMany(defaultCats)

      // Buscar novamente
      const newCategories = await Category.find(query).sort({ name: 1 })
      return res.json({ categories: newCategories })
    }

    res.json({ categories: userCategories })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar categorias', error: error.message })
  }
})

// @route   GET /api/categories/grouped
// @desc    Listar categorias agrupadas por tipo
router.get('/grouped', async (req, res) => {
  try {
    const categories = await Category.find({
      user: req.user._id,
      isActive: true
    }).sort({ name: 1 })

    // Se não tem categorias, criar padrão
    if (categories.length === 0) {
      const defaultCats = []

      for (const t of ['income', 'expense']) {
        for (const cat of DEFAULT_CATEGORIES[t]) {
          defaultCats.push({
            user: req.user._id,
            type: t,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            isDefault: true
          })
        }
      }

      await Category.insertMany(defaultCats)

      const newCategories = await Category.find({
        user: req.user._id,
        isActive: true
      }).sort({ name: 1 })

      return res.json({
        income: newCategories.filter(c => c.type === 'income'),
        expense: newCategories.filter(c => c.type === 'expense')
      })
    }

    res.json({
      income: categories.filter(c => c.type === 'income'),
      expense: categories.filter(c => c.type === 'expense')
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar categorias', error: error.message })
  }
})

// @route   POST /api/categories
// @desc    Criar nova categoria
router.post('/', async (req, res) => {
  try {
    const { name, type, icon, color } = req.body

    if (!name || !type) {
      return res.status(400).json({ message: 'Nome e tipo são obrigatórios' })
    }

    // Verificar se já existe
    const existing = await Category.findOne({
      user: req.user._id,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      type
    })

    if (existing) {
      return res.status(400).json({ message: 'Categoria já existe' })
    }

    const category = await Category.create({
      user: req.user._id,
      name,
      type,
      icon: icon || 'Tag',
      color: color || '#6b7280',
      isDefault: false
    })

    res.status(201).json({ category })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar categoria', error: error.message })
  }
})

// @route   PUT /api/categories/:id
// @desc    Atualizar categoria
router.put('/:id', async (req, res) => {
  try {
    const { name, icon, color } = req.body

    const category = await Category.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada' })
    }

    // Verificar nome duplicado
    if (name && name !== category.name) {
      const existing = await Category.findOne({
        user: req.user._id,
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        type: category.type,
        _id: { $ne: req.params.id }
      })

      if (existing) {
        return res.status(400).json({ message: 'Já existe uma categoria com este nome' })
      }
    }

    if (name) category.name = name
    if (icon) category.icon = icon
    if (color) category.color = color

    await category.save()

    res.json({ category })
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar categoria', error: error.message })
  }
})

// @route   DELETE /api/categories/:id
// @desc    Desativar categoria (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada' })
    }

    // Soft delete - apenas desativa
    category.isActive = false
    await category.save()

    res.json({ message: 'Categoria removida com sucesso' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao remover categoria', error: error.message })
  }
})

// @route   POST /api/categories/reset
// @desc    Resetar categorias para o padrão
router.post('/reset', async (req, res) => {
  try {
    // Desativar todas as categorias do usuário
    await Category.updateMany(
      { user: req.user._id },
      { isActive: false }
    )

    // Criar novas categorias padrão
    const defaultCats = []

    for (const t of ['income', 'expense']) {
      for (const cat of DEFAULT_CATEGORIES[t]) {
        defaultCats.push({
          user: req.user._id,
          type: t,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          isDefault: true
        })
      }
    }

    await Category.insertMany(defaultCats)

    const categories = await Category.find({
      user: req.user._id,
      isActive: true
    }).sort({ name: 1 })

    res.json({
      message: 'Categorias resetadas com sucesso',
      categories
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao resetar categorias', error: error.message })
  }
})

// @route   POST /api/categories/sync
// @desc    Sincronizar categorias - adiciona categorias padrão que estão faltando
router.post('/sync', async (req, res) => {
  try {
    // Buscar categorias existentes do usuário
    const existingCategories = await Category.find({
      user: req.user._id,
      isActive: true
    })

    const existingNames = new Set(
      existingCategories.map(c => c.name.toLowerCase())
    )

    // Identificar e criar categorias que estão faltando
    const missingCategories = []

    for (const type of ['income', 'expense']) {
      for (const defaultCat of DEFAULT_CATEGORIES[type]) {
        if (!existingNames.has(defaultCat.name.toLowerCase())) {
          missingCategories.push({
            user: req.user._id,
            type,
            name: defaultCat.name,
            icon: defaultCat.icon,
            color: defaultCat.color,
            isDefault: true
          })
        }
      }
    }

    if (missingCategories.length > 0) {
      await Category.insertMany(missingCategories)
    }

    // Buscar todas as categorias atualizadas
    const categories = await Category.find({
      user: req.user._id,
      isActive: true
    }).sort({ name: 1 })

    res.json({
      message: `${missingCategories.length} categoria(s) adicionada(s)`,
      added: missingCategories.map(c => c.name),
      categories
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao sincronizar categorias', error: error.message })
  }
})

module.exports = router
