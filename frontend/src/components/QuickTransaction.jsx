import { useState, useEffect, useContext } from 'react'
import { X, DollarSign, Tag } from 'lucide-react'
import api from '../services/api'
import { ThemeContext } from '../contexts/ThemeContext'

function QuickTransaction({ isOpen, onClose, onSuccess }) {
  const { colors, isDark } = useContext(ThemeContext)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    if (isOpen) {
      fetchCategories()
    }
  }, [isOpen])

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories?type=expense')
      setCategories(res.data.categories || [])
      if (res.data.categories?.length > 0 && !category) {
        setCategory(res.data.categories[0].name)
      }
    } catch (error) {
      console.error('Erro ao buscar categorias:', error)
    }
  }

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return

    setLoading(true)
    try {
      const selectedCat = categories.find(c => c.name === category)
      await api.post('/transactions', {
        type: 'expense',
        category: category.toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        description: description || category,
        amount: parseFloat(amount),
        date: new Date().toISOString().split('T')[0]
      })

      // Reset e fechar
      setAmount('')
      setCategory(categories[0]?.name || '')
      setDescription('')
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Erro ao salvar:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const selectedCategory = categories.find(c => c.name === category)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: colors.backgroundCard,
          borderRadius: '24px 24px 16px 16px',
          width: '100%',
          maxWidth: '420px',
          padding: '24px',
          animation: 'slideUp 0.3s ease-out',
          border: `1px solid ${colors.border}`
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>Lançamento Rápido</h2>
          <button
            onClick={onClose}
            style={{ padding: '8px', color: colors.textSecondary, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Valor em destaque */}
        <div style={{
          backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <label style={{ fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Valor do gasto
          </label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '8px' }}>
            <span style={{ fontSize: '24px', color: '#ef4444', marginRight: '4px' }}>R$</span>
            <input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                fontSize: '36px',
                fontWeight: '700',
                color: '#ef4444',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: '150px',
                textAlign: 'center'
              }}
              autoFocus
            />
          </div>
        </div>

        {/* Categorias como grid de botões */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'block' }}>
            Categoria
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {categories.map((cat) => {
              const isSelected = category === cat.name
              return (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setCategory(cat.name)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '12px 8px',
                    borderRadius: '12px',
                    border: isSelected ? `2px solid ${cat.color}` : `2px solid ${colors.border}`,
                    backgroundColor: isSelected ? `${cat.color}15` : colors.backgroundCard,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? `${cat.color}30` : (isDark ? colors.border : '#f3f4f6'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Tag size={16} color={isSelected ? cat.color : colors.textSecondary} />
                  </div>
                  <span style={{
                    fontSize: '11px',
                    marginTop: '4px',
                    color: isSelected ? cat.color : colors.textSecondary,
                    fontWeight: isSelected ? '600' : '400',
                    textAlign: 'center',
                    lineHeight: '1.2'
                  }}>
                    {cat.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Descrição opcional */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: colors.backgroundCard,
              color: colors.text
            }}
          />
        </div>

        {/* Botão de salvar */}
        <button
          onClick={handleSubmit}
          disabled={loading || !amount}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: amount ? '#ef4444' : (isDark ? colors.border : '#e5e7eb'),
            color: amount ? 'white' : colors.textSecondary,
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            cursor: amount ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <DollarSign size={18} />
          {loading ? 'Salvando...' : 'Registrar Gasto'}
        </button>

        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  )
}

export default QuickTransaction
