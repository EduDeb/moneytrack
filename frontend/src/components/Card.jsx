import { useContext } from 'react'
import { ThemeContext } from '../contexts/ThemeContext'

// Card base reutilizável
function Card({
  children,
  padding = '24px',
  borderRadius = '12px',
  hoverable = false,
  onClick = null,
  style = {},
  className = ''
}) {
  const { colors, isDark } = useContext(ThemeContext)

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        backgroundColor: colors.backgroundCard,
        borderRadius,
        padding,
        border: `1px solid ${colors.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        cursor: onClick || hoverable ? 'pointer' : 'default',
        ...style
      }}
      onMouseEnter={(e) => {
        if (hoverable || onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable || onClick) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
        }
      }}
    >
      {children}
    </div>
  )
}

// Card de estatística/resumo
export function StatCard({
  title,
  value,
  icon: Icon,
  iconBg = '#dbeafe',
  iconColor = '#3b82f6',
  valueColor = null,
  subtitle = null,
  trend = null, // { value: '+10%', positive: true }
  highlight = false,
  highlightColor = null,
  onClick = null
}) {
  const { colors, isDark } = useContext(ThemeContext)

  return (
    <Card
      onClick={onClick}
      hoverable={!!onClick}
      style={{
        padding: '20px',
        ...(highlight && highlightColor ? {
          border: `2px solid ${highlightColor}`,
          background: isDark ? `${highlightColor}15` : `${highlightColor}08`
        } : {})
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: '13px',
            color: colors.textSecondary,
            marginBottom: '8px',
            fontWeight: highlight ? '600' : '400'
          }}>
            {title}
          </p>
          <p style={{
            fontSize: '24px',
            fontWeight: '700',
            color: valueColor || colors.text,
            marginBottom: subtitle ? '4px' : 0
          }}>
            {value}
          </p>
          {subtitle && (
            <p style={{ fontSize: '12px', color: colors.textSecondary }}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '8px',
              fontSize: '12px',
              color: trend.positive ? '#22c55e' : '#ef4444'
            }}>
              <span>{trend.value}</span>
              <span style={{ color: colors.textSecondary }}>vs mês anterior</span>
            </div>
          )}
        </div>
        {Icon && (
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Icon size={20} color={iconColor} />
          </div>
        )}
      </div>
    </Card>
  )
}

// Card com header e conteúdo
export function ContentCard({
  title,
  subtitle = null,
  headerAction = null,
  children,
  padding = '0',
  noPadding = false
}) {
  const { colors } = useContext(ThemeContext)

  return (
    <Card padding="0">
      {/* Header */}
      {(title || headerAction) && (
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            {title && (
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: colors.text,
                margin: 0
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{
                fontSize: '13px',
                color: colors.textSecondary,
                margin: '4px 0 0'
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerAction}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: noPadding ? 0 : (padding || '20px') }}>
        {children}
      </div>
    </Card>
  )
}

// Card de ação/link
export function ActionCard({
  title,
  description,
  icon: Icon,
  iconBg = '#dbeafe',
  iconColor = '#3b82f6',
  onClick,
  rightIcon = null
}) {
  const { colors, isDark } = useContext(ThemeContext)

  return (
    <Card
      onClick={onClick}
      hoverable
      padding="16px"
      style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
    >
      {Icon && (
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon size={24} color={iconColor} />
        </div>
      )}
      <div style={{ flex: 1 }}>
        <h4 style={{
          fontSize: '15px',
          fontWeight: '600',
          color: colors.text,
          margin: 0
        }}>
          {title}
        </h4>
        {description && (
          <p style={{
            fontSize: '13px',
            color: colors.textSecondary,
            margin: '4px 0 0'
          }}>
            {description}
          </p>
        )}
      </div>
      {rightIcon}
    </Card>
  )
}

// Card de alerta/notificação
export function AlertCard({
  type = 'info', // 'info', 'success', 'warning', 'error'
  title,
  message,
  icon: CustomIcon = null,
  action = null
}) {
  const { isDark } = useContext(ThemeContext)

  const types = {
    info: { bg: '#eff6ff', border: '#3b82f6', color: '#1d4ed8', iconBg: '#dbeafe' },
    success: { bg: '#f0fdf4', border: '#22c55e', color: '#166534', iconBg: '#dcfce7' },
    warning: { bg: '#fffbeb', border: '#f59e0b', color: '#92400e', iconBg: '#fef3c7' },
    error: { bg: '#fef2f2', border: '#ef4444', color: '#991b1b', iconBg: '#fee2e2' }
  }

  const style = types[type] || types.info

  return (
    <div style={{
      backgroundColor: isDark ? `${style.border}15` : style.bg,
      borderLeft: `4px solid ${style.border}`,
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px'
    }}>
      <div style={{ flex: 1 }}>
        {title && (
          <h4 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: style.color,
            margin: 0
          }}>
            {title}
          </h4>
        )}
        {message && (
          <p style={{
            fontSize: '13px',
            color: style.color,
            margin: title ? '4px 0 0' : 0,
            opacity: 0.9
          }}>
            {message}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export default Card
