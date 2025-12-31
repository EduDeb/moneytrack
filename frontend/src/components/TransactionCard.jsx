import { useContext } from 'react'
import { Edit2, Trash2, Check, Loader } from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'

// Card de transação para visualização mobile
function TransactionCard({
  transaction,
  getCategoryLabel,
  formatCurrency,
  formatDate,
  onEdit,
  onDelete,
  deleting,
  selectionMode = false,
  isSelected = false,
  onToggleSelect
}) {
  const { colors, isDark } = useContext(ThemeContext)
  const { _id, type, description, category, amount, date } = transaction

  const isIncome = type === 'income'

  return (
    <div
      role="article"
      aria-label={`${isIncome ? 'Receita' : 'Despesa'}: ${description}, ${formatCurrency(amount)}`}
      onClick={selectionMode ? onToggleSelect : undefined}
      style={{
        backgroundColor: isSelected ? (isDark ? '#1e3a5f' : '#dbeafe') : colors.backgroundCard,
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        border: `1px solid ${isSelected ? '#3b82f6' : colors.border}`,
        cursor: selectionMode ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        animation: 'fadeInUp 0.3s ease-out'
      }}
    >
      {/* Header com data e ações */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <span style={{
          fontSize: '12px',
          color: colors.textSecondary,
          fontWeight: '500'
        }}>
          {formatDate(date)}
        </span>

        {selectionMode ? (
          <div
            aria-checked={isSelected}
            role="checkbox"
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '6px',
              border: `2px solid ${isSelected ? '#3b82f6' : colors.border}`,
              backgroundColor: isSelected ? '#3b82f6' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isSelected && <Check size={14} color="white" />}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(transaction) }}
              disabled={deleting === _id}
              aria-label={`Editar transação: ${description}`}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isDark ? '#334155' : '#f3f4f6',
                cursor: 'pointer',
                color: colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(_id) }}
              disabled={deleting === _id}
              aria-label={`Excluir transação: ${description}`}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: deleting === _id ? '#fee2e2' : (isDark ? '#334155' : '#f3f4f6'),
                cursor: deleting === _id ? 'not-allowed' : 'pointer',
                color: deleting === _id ? '#ef4444' : colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {deleting === _id ? (
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Descrição e categoria */}
      <div style={{ marginBottom: '12px' }}>
        <h3 style={{
          fontSize: '15px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 6px 0'
        }}>
          {description || '-'}
        </h3>
        <span style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: isIncome ? '#dcfce7' : '#fef2f2',
          color: isIncome ? '#166534' : '#991b1b'
        }}>
          {getCategoryLabel(category)}
        </span>
      </div>

      {/* Valor */}
      <div style={{
        fontSize: '20px',
        fontWeight: '700',
        color: isIncome ? '#22c55e' : '#ef4444',
        textAlign: 'right'
      }}>
        {isIncome ? '+' : '-'}{formatCurrency(amount)}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Lista responsiva que mostra cards no mobile e tabela no desktop
export function ResponsiveTransactionList({
  transactions,
  getCategoryLabel,
  formatCurrency,
  formatDate,
  onEdit,
  onDelete,
  deleting,
  selectionMode,
  selectedItems,
  onToggleSelect,
  colors,
  isDark
}) {
  // Detectar se é mobile (< 768px)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    return (
      <div role="list" aria-label="Lista de transações">
        {transactions.map(t => (
          <TransactionCard
            key={t._id}
            transaction={t}
            getCategoryLabel={getCategoryLabel}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            onEdit={onEdit}
            onDelete={onDelete}
            deleting={deleting}
            selectionMode={selectionMode}
            isSelected={selectedItems?.includes(t._id)}
            onToggleSelect={() => onToggleSelect?.(t._id)}
          />
        ))}
      </div>
    )
  }

  // Desktop: retorna null para usar a tabela padrão
  return null
}

export default TransactionCard
