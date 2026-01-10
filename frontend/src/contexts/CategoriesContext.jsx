import { createContext, useState, useEffect, useContext, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

// Categorias padrão fallback (caso API falhe)
const DEFAULT_CATEGORIES = {
  income: [
    { name: 'Salário', value: 'salario', icon: 'Briefcase', color: '#22c55e' },
    { name: 'Freelance', value: 'freelance', icon: 'Laptop', color: '#3b82f6' },
    { name: 'Investimentos', value: 'investimentos', icon: 'TrendingUp', color: '#8b5cf6' },
    { name: 'Outros', value: 'outros_receita', icon: 'Plus', color: '#6b7280' }
  ],
  expense: [
    { name: 'Alimentação', value: 'alimentacao', icon: 'Utensils', color: '#f97316' },
    { name: 'Supermercado', value: 'supermercado', icon: 'ShoppingCart', color: '#84cc16' },
    { name: 'Transporte', value: 'transporte', icon: 'Car', color: '#06b6d4' },
    { name: 'Colaboradores', value: 'colaboradores', icon: 'Users', color: '#3b82f6' },
    { name: 'Moradia', value: 'moradia', icon: 'Home', color: '#8b5cf6' },
    { name: 'Carro', value: 'carro', icon: 'CarFront', color: '#64748b' },
    { name: 'Manutenção Casa', value: 'manutencao_casa', icon: 'Wrench', color: '#78716c' },
    { name: 'Saúde', value: 'saude', icon: 'Heart', color: '#ef4444' },
    { name: 'Educação', value: 'educacao', icon: 'GraduationCap', color: '#22c55e' },
    { name: 'Lazer', value: 'lazer', icon: 'Gamepad2', color: '#ec4899' },
    { name: 'Compras', value: 'compras', icon: 'ShoppingBag', color: '#f59e0b' },
    { name: 'Contas', value: 'contas', icon: 'Receipt', color: '#6366f1' },
    { name: 'Assinaturas', value: 'assinaturas', icon: 'CreditCard', color: '#14b8a6' },
    { name: 'Pets', value: 'pets', icon: 'PawPrint', color: '#a855f7' },
    { name: 'Imposto', value: 'imposto', icon: 'FileText', color: '#dc2626' },
    { name: 'Outros', value: 'outros_despesa', icon: 'MoreHorizontal', color: '#6b7280' }
  ]
}

export const CategoriesContext = createContext()

export function CategoriesProvider({ children }) {
  const { user } = useAuth()
  const [categories, setCategories] = useState({ income: [], expense: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Converter categoria da API para formato usado no frontend
  const formatCategory = (cat) => ({
    _id: cat._id,
    name: cat.name,
    value: cat.name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]/g, '_'), // Substitui caracteres especiais
    label: cat.name,
    icon: cat.icon || 'Tag',
    color: cat.color || '#6b7280',
    isDefault: cat.isDefault
  })

  const fetchCategories = useCallback(async () => {
    if (!user) {
      setCategories(DEFAULT_CATEGORIES)
      setLoading(false)
      return
    }

    try {
      setError(null)
      const res = await api.get('/categories/grouped')

      const formattedCategories = {
        income: (res.data.income || []).map(formatCategory),
        expense: (res.data.expense || []).map(formatCategory)
      }

      setCategories(formattedCategories)
    } catch (err) {
      console.error('Erro ao buscar categorias:', err)
      setError(err.message)
      // Usar categorias padrão como fallback
      setCategories(DEFAULT_CATEGORIES)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Atualiza categorias (chamado após criar/editar/deletar)
  const refreshCategories = useCallback(() => {
    return fetchCategories()
  }, [fetchCategories])

  // Buscar categoria por value (busca robusta)
  const getCategoryByValue = useCallback((value) => {
    if (!value) return null
    const allCats = [...categories.income, ...categories.expense]

    // 1. Busca exata por value
    let found = allCats.find(c => c.value === value)
    if (found) return found

    // 2. Busca por nome (case insensitive)
    const valueLower = value.toLowerCase()
    found = allCats.find(c => c.name.toLowerCase() === valueLower)
    if (found) return found

    // 3. Busca normalizada (remove acentos e compara)
    const valueNormalized = value.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')

    found = allCats.find(c => {
      const nameNormalized = c.name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
      return c.value === valueNormalized || nameNormalized === valueNormalized
    })

    return found || null
  }, [categories])

  // Buscar cor de categoria
  const getCategoryColor = useCallback((value) => {
    const cat = getCategoryByValue(value)
    return cat?.color || '#6b7280'
  }, [getCategoryByValue])

  // Buscar label de categoria
  const getCategoryLabel = useCallback((value) => {
    const cat = getCategoryByValue(value)
    return cat?.label || cat?.name || value
  }, [getCategoryByValue])

  // Mapa de labels (compatibilidade com código antigo)
  const categoryLabels = {
    ...Object.fromEntries(categories.income.map(c => [c.value, c.label || c.name])),
    ...Object.fromEntries(categories.expense.map(c => [c.value, c.label || c.name]))
  }

  // Mapa completo de categorias
  const categoryMap = {
    ...Object.fromEntries(categories.income.map(c => [c.value, c])),
    ...Object.fromEntries(categories.expense.map(c => [c.value, c]))
  }

  return (
    <CategoriesContext.Provider value={{
      categories,
      incomeCategories: categories.income,
      expenseCategories: categories.expense,
      allCategories: [...categories.income, ...categories.expense],
      loading,
      error,
      refreshCategories,
      getCategoryByValue,
      getCategoryColor,
      getCategoryLabel,
      categoryLabels,
      categoryMap
    }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  const context = useContext(CategoriesContext)
  if (!context) {
    throw new Error('useCategories deve ser usado dentro de CategoriesProvider')
  }
  return context
}

export default CategoriesContext
