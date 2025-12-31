import { useContext } from 'react'
import { ThemeContext } from '../contexts/ThemeContext'

// Componente base de Skeleton
function Skeleton({ width, height, borderRadius = '8px', style = {} }) {
  const { isDark } = useContext(ThemeContext)

  return (
    <div
      style={{
        width: width || '100%',
        height: height || '20px',
        borderRadius,
        background: isDark
          ? 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)'
          : 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style
      }}
    />
  )
}

// Skeleton para Card de resumo
export function CardSkeleton() {
  const { colors } = useContext(ThemeContext)

  return (
    <div style={{
      backgroundColor: colors.backgroundCard,
      borderRadius: '12px',
      padding: '20px',
      border: `1px solid ${colors.border}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <Skeleton width="40px" height="40px" borderRadius="10px" />
        <Skeleton width="100px" height="14px" />
      </div>
      <Skeleton width="140px" height="28px" />
    </div>
  )
}

// Skeleton para linha de tabela
export function TableRowSkeleton({ columns = 5 }) {
  const { colors } = useContext(ThemeContext)

  return (
    <tr style={{ borderTop: `1px solid ${colors.border}` }}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <Skeleton
            width={i === 0 ? '80px' : i === columns - 1 ? '60px' : '120px'}
            height="16px"
          />
        </td>
      ))}
    </tr>
  )
}

// Skeleton para lista de transações
export function TransactionListSkeleton({ count = 5 }) {
  const { colors, isDark } = useContext(ThemeContext)

  return (
    <div style={{
      backgroundColor: colors.backgroundCard,
      borderRadius: '12px',
      overflow: 'hidden',
      border: `1px solid ${colors.border}`
    }}>
      <div style={{
        backgroundColor: isDark ? colors.border : '#f8fafc',
        padding: '12px 16px',
        display: 'flex',
        gap: '16px'
      }}>
        <Skeleton width="60px" height="12px" />
        <Skeleton width="100px" height="12px" />
        <Skeleton width="80px" height="12px" />
        <div style={{ flex: 1 }} />
        <Skeleton width="60px" height="12px" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <Skeleton width="70px" height="16px" />
          <Skeleton width="150px" height="16px" />
          <Skeleton width="80px" height="24px" borderRadius="20px" />
          <div style={{ flex: 1 }} />
          <Skeleton width="90px" height="16px" />
        </div>
      ))}
    </div>
  )
}

// Skeleton para Dashboard
export function DashboardSkeleton() {
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <Skeleton width="120px" height="32px" />
        <Skeleton width="200px" height="40px" borderRadius="12px" />
      </div>

      {/* Cards de resumo */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Cards grandes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <Skeleton height="200px" borderRadius="16px" />
        <Skeleton height="200px" borderRadius="16px" />
      </div>
    </div>
  )
}

// Skeleton para gráfico de pizza
export function ChartSkeleton() {
  const { colors } = useContext(ThemeContext)

  return (
    <div style={{
      backgroundColor: colors.backgroundCard,
      borderRadius: '12px',
      padding: '24px',
      border: `1px solid ${colors.border}`
    }}>
      <Skeleton width="180px" height="20px" style={{ marginBottom: '16px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <Skeleton width="200px" height="200px" borderRadius="50%" />
        <div style={{ flex: 1 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Skeleton width="12px" height="12px" borderRadius="3px" />
              <Skeleton width="80px" height="14px" />
              <div style={{ flex: 1 }} />
              <Skeleton width="70px" height="14px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// CSS para animação shimmer
export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `}</style>
  )
}

export default Skeleton
