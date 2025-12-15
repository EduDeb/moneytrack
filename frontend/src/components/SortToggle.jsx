import { useContext } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'

function SortToggle({ sortOrder, onToggle, label = 'Data' }) {
  const { colors, isDark } = useContext(ThemeContext)

  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '8px',
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.backgroundCard,
        color: colors.text,
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      title={sortOrder === 'desc' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}
    >
      {sortOrder === 'desc' ? (
        <ArrowDown size={16} color={colors.primary || '#3b82f6'} />
      ) : (
        <ArrowUp size={16} color={colors.primary || '#3b82f6'} />
      )}
      <span>{label}</span>
      <span style={{
        fontSize: '11px',
        color: colors.textSecondary,
        marginLeft: '2px'
      }}>
        {sortOrder === 'desc' ? '(recentes)' : '(antigos)'}
      </span>
    </button>
  )
}

export default SortToggle
