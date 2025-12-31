import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Laptop,
  Gift,
  Utensils,
  Car,
  Home,
  Heart,
  GraduationCap,
  Gamepad2,
  ShoppingBag,
  Receipt,
  CreditCard,
  MoreHorizontal,
  Palette
} from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'
import { useCategories } from '../contexts/CategoriesContext'

// Mapeamento de ícones disponíveis
const ICONS = {
  Tag, Briefcase, Laptop, TrendingUp, Gift, Plus,
  Utensils, Car, Home, Heart, GraduationCap, Gamepad2,
  ShoppingBag, Receipt, CreditCard, MoreHorizontal
}

const ICON_LIST = Object.keys(ICONS)

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#6b7280'
]

function Categories() {
  const { colors, isDark } = useContext(ThemeContext)
  const { refreshCategories: refreshGlobalCategories } = useCategories()
  const [categories, setCategories] = useState({ income: [], expense: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('expense')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense',
    icon: 'Tag',
    color: '#6b7280'
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories/grouped')
      setCategories(res.data)
    } catch (error) {
      console.error('Erro ao buscar categorias:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingCategory(null)
    setFormData({
      name: '',
      type: activeTab,
      icon: 'Tag',
      color: '#6b7280'
    })
    setModalOpen(true)
  }

  const openEditModal = (category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      type: category.type,
      icon: category.icon || 'Tag',
      color: category.color || '#6b7280'
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory._id}`, formData)
      } else {
        await api.post('/categories', formData)
      }
      setModalOpen(false)
      fetchCategories()
      // Atualizar contexto global para que outras páginas vejam as mudanças
      refreshGlobalCategories()
      toast.success(editingCategory ? 'Categoria atualizada!' : 'Categoria criada!')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao salvar categoria')
    }
  }

  const handleDelete = async (category) => {
    if (!confirm(`Deseja realmente remover a categoria "${category.name}"?`)) return

    try {
      await api.delete(`/categories/${category._id}`)
      fetchCategories()
      refreshGlobalCategories()
      toast.success('Categoria removida!')
    } catch (error) {
      toast.error('Erro ao remover categoria')
    }
  }

  const handleReset = async () => {
    if (!confirm('Isso vai restaurar todas as categorias para o padrão. Deseja continuar?')) return

    try {
      await api.post('/categories/reset')
      fetchCategories()
      refreshGlobalCategories()
      toast.success('Categorias restauradas!')
    } catch (error) {
      toast.error('Erro ao resetar categorias')
    }
  }

  const renderIcon = (iconName, size = 20, color = '#6b7280') => {
    const IconComponent = ICONS[iconName] || Tag
    return <IconComponent size={size} color={color} />
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>Categorias</h1>
          <p style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '4px' }}>
            Gerencie suas categorias de receitas e despesas
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.backgroundCard,
              color: colors.textSecondary,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} />
            Resetar
          </button>
          <button
            onClick={openCreateModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Plus size={18} />
            Nova Categoria
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '20px',
        backgroundColor: isDark ? colors.border : '#f3f4f6',
        padding: '4px',
        borderRadius: '10px',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setActiveTab('expense')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'expense' ? colors.backgroundCard : 'transparent',
            color: activeTab === 'expense' ? '#ef4444' : colors.textSecondary,
            fontWeight: activeTab === 'expense' ? '600' : '400',
            cursor: 'pointer',
            boxShadow: activeTab === 'expense' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <TrendingDown size={18} />
          Despesas ({categories.expense?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('income')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'income' ? colors.backgroundCard : 'transparent',
            color: activeTab === 'income' ? '#22c55e' : colors.textSecondary,
            fontWeight: activeTab === 'income' ? '600' : '400',
            cursor: 'pointer',
            boxShadow: activeTab === 'income' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <TrendingUp size={18} />
          Receitas ({categories.income?.length || 0})
        </button>
      </div>

      {/* Lista de Categorias */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '12px'
      }}>
        {(categories[activeTab] || []).map(category => (
          <div
            key={category._id}
            style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: '12px',
              padding: '16px',
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: `${category.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {renderIcon(category.icon, 22, category.color)}
              </div>
              <div>
                <p style={{ fontWeight: '600', color: colors.text }}>{category.name}</p>
                <p style={{ fontSize: '12px', color: colors.textSecondary }}>
                  {category.isDefault ? 'Categoria padrão' : 'Personalizada'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => openEditModal(category)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isDark ? colors.border : '#f3f4f6',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Pencil size={16} color={colors.textSecondary} />
              </button>
              <button
                onClick={() => handleDelete(category)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Trash2 size={16} color="#ef4444" />
              </button>
            </div>
          </div>
        ))}

        {(categories[activeTab] || []).length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '40px',
            color: colors.textSecondary
          }}>
            <Tag size={48} color={colors.textSecondary} style={{ margin: '0 auto 12px' }} />
            <p>Nenhuma categoria encontrada</p>
            <button
              onClick={openCreateModal}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Criar primeira categoria
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: colors.backgroundCard,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            maxHeight: '90vh',
            overflow: 'auto',
            border: `1px solid ${colors.border}`
          }}>
            {/* Header do Modal */}
            <div style={{
              padding: '20px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isDark ? colors.border : '#f3f4f6',
                  cursor: 'pointer'
                }}
              >
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              {/* Tipo */}
              {!editingCategory && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: colors.text }}>
                    Tipo
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'expense' })}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '8px',
                        border: formData.type === 'expense' ? '2px solid #ef4444' : `1px solid ${colors.border}`,
                        backgroundColor: formData.type === 'expense' ? (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2') : colors.backgroundCard,
                        color: formData.type === 'expense' ? '#ef4444' : colors.textSecondary,
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <TrendingDown size={18} />
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'income' })}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '8px',
                        border: formData.type === 'income' ? '2px solid #22c55e' : `1px solid ${colors.border}`,
                        backgroundColor: formData.type === 'income' ? (isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4') : colors.backgroundCard,
                        color: formData.type === 'income' ? '#22c55e' : colors.textSecondary,
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <TrendingUp size={18} />
                      Receita
                    </button>
                  </div>
                </div>
              )}

              {/* Nome */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: colors.text }}>
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Supermercado"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.backgroundCard,
                    color: colors.text,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Ícone */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: colors.text }}>
                  Ícone
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '8px'
                }}>
                  {ICON_LIST.map(iconName => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: iconName })}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: formData.icon === iconName ? `2px solid ${formData.color}` : `1px solid ${colors.border}`,
                        backgroundColor: formData.icon === iconName ? `${formData.color}15` : colors.backgroundCard,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {renderIcon(iconName, 20, formData.icon === iconName ? formData.color : colors.textSecondary)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '8px',
                  fontWeight: '500',
                  color: colors.text
                }}>
                  <Palette size={16} />
                  Cor
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '8px'
                }}>
                  {COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: '8px',
                        border: formData.color === color ? `3px solid ${colors.text}` : '2px solid transparent',
                        backgroundColor: color,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {formData.color === color && <Check size={16} color="white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div style={{
                padding: '16px',
                backgroundColor: isDark ? colors.border : '#f9fafb',
                borderRadius: '12px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '8px' }}>Preview</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: `${formData.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {renderIcon(formData.icon, 22, formData.color)}
                  </div>
                  <span style={{ fontWeight: '600', color: colors.text }}>
                    {formData.name || 'Nome da categoria'}
                  </span>
                </div>
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.backgroundCard,
                    color: colors.textSecondary,
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Check size={18} />
                  {editingCategory ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Categories
