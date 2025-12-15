import { useContext } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

function MonthSelector({
  selectedMonth,
  selectedYear,
  onChange,
  showAllOption = false,
  showYearSelector = true,
  compact = false
}) {
  const { colors, isDark } = useContext(ThemeContext)
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const isCurrentMonth = selectedMonth === currentMonth && selectedYear === currentYear

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      onChange(12, selectedYear - 1)
    } else {
      onChange(selectedMonth - 1, selectedYear)
    }
  }

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      onChange(1, selectedYear + 1)
    } else {
      onChange(selectedMonth + 1, selectedYear)
    }
  }

  const goToCurrentMonth = () => {
    onChange(currentMonth, currentYear)
  }

  // Gerar lista de anos (5 anos para trás e 2 para frente)
  const years = []
  for (let y = currentYear - 5; y <= currentYear + 2; y++) {
    years.push(y)
  }

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: colors.backgroundCard,
        padding: '6px 12px',
        borderRadius: '8px',
        border: `1px solid ${colors.border}`
      }}>
        <button
          onClick={goToPreviousMonth}
          style={{
            padding: '4px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ChevronLeft size={16} color={colors.textSecondary} />
        </button>

        <span style={{
          fontSize: '13px',
          fontWeight: '500',
          color: colors.text,
          minWidth: '80px',
          textAlign: 'center'
        }}>
          {MONTH_NAMES_SHORT[selectedMonth - 1]} {selectedYear}
        </span>

        <button
          onClick={goToNextMonth}
          style={{
            padding: '4px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ChevronRight size={16} color={colors.textSecondary} />
        </button>

        {!isCurrentMonth && (
          <button
            onClick={goToCurrentMonth}
            style={{
              marginLeft: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: colors.primary,
              color: 'white',
              fontSize: '10px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Hoje
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: colors.backgroundCard,
      padding: '8px 16px',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: `1px solid ${colors.border}`
    }}>
      <Calendar size={18} color={colors.textSecondary} />

      <button
        onClick={goToPreviousMonth}
        style={{
          padding: '6px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: isDark ? colors.border : '#f3f4f6',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <ChevronLeft size={20} color={colors.textSecondary} />
      </button>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: showYearSelector ? '180px' : '120px',
        justifyContent: 'center'
      }}>
        <select
          value={selectedMonth}
          onChange={(e) => onChange(parseInt(e.target.value), selectedYear)}
          style={{
            padding: '6px 8px',
            borderRadius: '6px',
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.backgroundCard,
            color: colors.text,
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          {showAllOption && <option value={0}>Todos</option>}
          {MONTH_NAMES.map((month, index) => (
            <option key={index} value={index + 1}>{month}</option>
          ))}
        </select>

        {showYearSelector && (
          <select
            value={selectedYear}
            onChange={(e) => onChange(selectedMonth, parseInt(e.target.value))}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.backgroundCard,
              color: colors.text,
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        )}
      </div>

      <button
        onClick={goToNextMonth}
        style={{
          padding: '6px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: isDark ? colors.border : '#f3f4f6',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <ChevronRight size={20} color={colors.textSecondary} />
      </button>

      {!isCurrentMonth && (
        <button
          onClick={goToCurrentMonth}
          style={{
            marginLeft: '8px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: colors.primary,
            color: 'white',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Hoje
        </button>
      )}
    </div>
  )
}

export default MonthSelector
