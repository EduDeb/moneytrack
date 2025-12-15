import { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ThemeContext } from '../contexts/ThemeContext'
import api from '../services/api'
import {
  Search,
  X,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileText,
  Target,
  BarChart2,
  CreditCard,
  Repeat,
  Tag,
  Clock,
  ArrowRight
} from 'lucide-react'

const iconMap = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'wallet': Wallet,
  'file-text': FileText,
  'target': Target,
  'bar-chart-2': BarChart2,
  'credit-card': CreditCard,
  'repeat': Repeat,
  'tag': Tag
}

const typeLabels = {
  transaction: 'Transação',
  account: 'Conta',
  bill: 'Conta a Pagar',
  goal: 'Meta',
  investment: 'Investimento',
  debt: 'Dívida',
  recurring: 'Recorrência',
  category: 'Categoria'
}

function GlobalSearch({ isOpen, onClose }) {
  const { colors, isDark } = useContext(ThemeContext)
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [recentSearches, setRecentSearches] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(-1)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      loadSuggestions()
      loadRecentSearches()
    } else {
      setQuery('')
      setResults(null)
      setSelectedIndex(-1)
    }
  }, [isOpen])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length >= 2) {
        performSearch()
      } else {
        setResults(null)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  const loadSuggestions = async () => {
    try {
      const { data } = await api.get('/search/suggestions')
      setSuggestions(data)
    } catch (error) {
      console.error('Erro ao carregar sugestões:', error)
    }
  }

  const loadRecentSearches = () => {
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    setRecentSearches(recent)
  }

  const saveRecentSearch = (searchQuery) => {
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    const updated = [searchQuery, ...recent.filter(r => r !== searchQuery)].slice(0, 5)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
  }

  const performSearch = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`)
      setResults(data)
      setSelectedIndex(-1)
    } catch (error) {
      console.error('Erro na busca:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (item) => {
    saveRecentSearch(query)
    onClose()
    navigate(item._link)
  }

  const handleKeyDown = (e) => {
    const allItems = getAllItems()

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSelect(allItems[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const getAllItems = () => {
    if (!results) return []
    return [
      ...results.transactions,
      ...results.accounts,
      ...results.bills,
      ...results.goals,
      ...results.investments,
      ...results.debts,
      ...results.recurring,
      ...results.categories
    ]
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  if (!isOpen) return null

  const allItems = getAllItems()
  let itemIndex = -1

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          margin: '0 16px',
          background: colors.backgroundCard,
          borderRadius: '16px',
          border: `1px solid ${colors.border}`,
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <Search size={20} style={{ color: colors.textSecondary, marginRight: '12px' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar transações, contas, metas..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '16px',
              color: colors.text
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                padding: '4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: colors.textSecondary
              }}
            >
              <X size={18} />
            </button>
          )}
          <div style={{
            marginLeft: '12px',
            padding: '4px 8px',
            borderRadius: '6px',
            background: isDark ? '#374151' : '#f3f4f6',
            fontSize: '12px',
            color: colors.textSecondary
          }}>
            ESC
          </div>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" style={{ margin: '0 auto' }}></div>
              <p style={{ marginTop: '12px' }}>Buscando...</p>
            </div>
          )}

          {!loading && results && results.total === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>
              <Search size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p>Nenhum resultado encontrado para "{query}"</p>
            </div>
          )}

          {!loading && results && results.total > 0 && (
            <div style={{ padding: '8px 0' }}>
              {/* Transactions */}
              {results.transactions.length > 0 && (
                <ResultGroup
                  title="Transações"
                  items={results.transactions}
                  colors={colors}
                  isDark={isDark}
                  onSelect={handleSelect}
                  selectedIndex={selectedIndex}
                  startIndex={(itemIndex += 1, itemIndex - 1)}
                  formatCurrency={formatCurrency}
                />
              )}

              {/* Accounts */}
              {results.accounts.length > 0 && (
                <ResultGroup
                  title="Contas"
                  items={results.accounts}
                  colors={colors}
                  isDark={isDark}
                  onSelect={handleSelect}
                  selectedIndex={selectedIndex}
                  startIndex={(itemIndex += results.transactions.length, itemIndex - results.transactions.length)}
                  formatCurrency={formatCurrency}
                />
              )}

              {/* Bills */}
              {results.bills.length > 0 && (
                <ResultGroup
                  title="Contas a Pagar"
                  items={results.bills}
                  colors={colors}
                  isDark={isDark}
                  onSelect={handleSelect}
                  selectedIndex={selectedIndex}
                  startIndex={(itemIndex += results.accounts.length, itemIndex - results.accounts.length)}
                  formatCurrency={formatCurrency}
                />
              )}

              {/* Goals */}
              {results.goals.length > 0 && (
                <ResultGroup
                  title="Metas"
                  items={results.goals}
                  colors={colors}
                  isDark={isDark}
                  onSelect={handleSelect}
                  selectedIndex={selectedIndex}
                  startIndex={(itemIndex += results.bills.length, itemIndex - results.bills.length)}
                  formatCurrency={formatCurrency}
                />
              )}

              {/* Investments */}
              {results.investments.length > 0 && (
                <ResultGroup
                  title="Investimentos"
                  items={results.investments}
                  colors={colors}
                  isDark={isDark}
                  onSelect={handleSelect}
                  selectedIndex={selectedIndex}
                  startIndex={(itemIndex += results.goals.length, itemIndex - results.goals.length)}
                  formatCurrency={formatCurrency}
                />
              )}

              {/* Debts */}
              {results.debts.length > 0 && (
                <ResultGroup
                  title="Dívidas"
                  items={results.debts}
                  colors={colors}
                  isDark={isDark}
                  onSelect={handleSelect}
                  selectedIndex={selectedIndex}
                  startIndex={(itemIndex += results.investments.length, itemIndex - results.investments.length)}
                  formatCurrency={formatCurrency}
                />
              )}

              {/* Recurring */}
              {results.recurring.length > 0 && (
                <ResultGroup
                  title="Recorrências"
                  items={results.recurring}
                  colors={colors}
                  isDark={isDark}
                  onSelect={handleSelect}
                  selectedIndex={selectedIndex}
                  startIndex={(itemIndex += results.debts.length, itemIndex - results.debts.length)}
                  formatCurrency={formatCurrency}
                />
              )}

              {/* Categories */}
              {results.categories.length > 0 && (
                <ResultGroup
                  title="Categorias"
                  items={results.categories}
                  colors={colors}
                  isDark={isDark}
                  onSelect={handleSelect}
                  selectedIndex={selectedIndex}
                  startIndex={(itemIndex += results.recurring.length, itemIndex - results.recurring.length)}
                  formatCurrency={formatCurrency}
                />
              )}
            </div>
          )}

          {/* Initial State - Suggestions and Recent */}
          {!loading && !results && (
            <div style={{ padding: '16px' }}>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                    padding: '0 4px'
                  }}>
                    Buscas Recentes
                  </p>
                  {recentSearches.map((search, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(search)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: colors.text,
                        borderRadius: '8px',
                        textAlign: 'left'
                      }}
                    >
                      <Clock size={16} style={{ color: colors.textSecondary }} />
                      {search}
                    </button>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {suggestions && (
                <div>
                  {suggestions.categories?.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: colors.textSecondary,
                        textTransform: 'uppercase',
                        marginBottom: '8px',
                        padding: '0 4px'
                      }}>
                        Categorias Frequentes
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {suggestions.categories.map((cat, i) => (
                          <button
                            key={i}
                            onClick={() => setQuery(cat)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '9999px',
                              border: `1px solid ${colors.border}`,
                              background: 'transparent',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: colors.text
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {suggestions.descriptions?.length > 0 && (
                    <div>
                      <p style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: colors.textSecondary,
                        textTransform: 'uppercase',
                        marginBottom: '8px',
                        padding: '0 4px'
                      }}>
                        Descrições Frequentes
                      </p>
                      {suggestions.descriptions.slice(0, 5).map((desc, i) => (
                        <button
                          key={i}
                          onClick={() => setQuery(desc)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: colors.text,
                            borderRadius: '8px',
                            textAlign: 'left'
                          }}
                        >
                          <ArrowRight size={16} style={{ color: colors.textSecondary }} />
                          {desc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!suggestions && recentSearches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: colors.textSecondary }}>
                  <Search size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p>Digite para buscar em transações, contas, metas e mais</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: colors.textSecondary
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span><kbd style={{ padding: '2px 6px', borderRadius: '4px', background: isDark ? '#374151' : '#f3f4f6' }}>↑↓</kbd> navegar</span>
            <span><kbd style={{ padding: '2px 6px', borderRadius: '4px', background: isDark ? '#374151' : '#f3f4f6' }}>Enter</kbd> selecionar</span>
          </div>
          {results && results.total > 0 && (
            <span>{results.total} resultado{results.total !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultGroup({ title, items, colors, isDark, onSelect, selectedIndex, startIndex, formatCurrency }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <p style={{
        fontSize: '12px',
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        padding: '8px 20px 4px'
      }}>
        {title}
      </p>
      {items.map((item, i) => {
        const Icon = iconMap[item._icon] || Tag
        const globalIndex = startIndex + i
        const isSelected = selectedIndex === globalIndex

        return (
          <button
            key={item._id}
            onClick={() => onSelect(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 20px',
              width: '100%',
              border: 'none',
              background: isSelected ? (isDark ? '#374151' : '#f3f4f6') : 'transparent',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: `${item._color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon size={18} style={{ color: item._color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: '500',
                color: colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.name || item.description || item.ticker}
              </p>
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: colors.textSecondary
              }}>
                {item._subtitle}
              </p>
            </div>
            {item.amount && (
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: item._color
              }}>
                {formatCurrency(item.amount)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default GlobalSearch
