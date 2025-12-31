import { useContext, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { ThemeContext } from '../contexts/ThemeContext'

function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md', // 'sm', 'md', 'lg', 'xl'
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  footer = null
}) {
  const { colors, isDark } = useContext(ThemeContext)
  const modalRef = useRef(null)
  const previousActiveElement = useRef(null)

  // Tamanhos do modal
  const sizes = {
    sm: '360px',
    md: '420px',
    lg: '560px',
    xl: '720px',
    full: '90vw'
  }

  // Fechar com ESC
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeOnEscape, onClose])

  // Focus trap e restaurar foco
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement
      // Pequeno delay para garantir que o modal está renderizado
      setTimeout(() => {
        modalRef.current?.focus()
      }, 50)
      // Prevenir scroll do body
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      previousActiveElement.current?.focus()
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        style={{
          backgroundColor: colors.backgroundCard,
          borderRadius: '16px',
          width: '100%',
          maxWidth: sizes[size] || sizes.md,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${colors.border}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: 'slideUp 0.3s ease-out',
          outline: 'none'
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: `1px solid ${colors.border}`
          }}>
            {title && (
              <h2
                id="modal-title"
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: colors.text,
                  margin: 0
                }}
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label="Fechar modal"
                style={{
                  padding: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.textSecondary,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = isDark ? '#334155' : '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px'
        }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}

// Componentes auxiliares para o Modal
export function ModalFooter({ children }) {
  return <>{children}</>
}

export function ModalButton({
  children,
  variant = 'secondary', // 'primary', 'secondary', 'danger'
  onClick,
  disabled = false,
  loading = false,
  type = 'button'
}) {
  const { colors, isDark } = useContext(ThemeContext)

  const variants = {
    primary: {
      bg: '#3b82f6',
      bgHover: '#2563eb',
      color: 'white',
      border: 'none'
    },
    secondary: {
      bg: colors.backgroundCard,
      bgHover: isDark ? '#334155' : '#f3f4f6',
      color: colors.textSecondary,
      border: `1px solid ${colors.border}`
    },
    danger: {
      bg: '#ef4444',
      bgHover: '#dc2626',
      color: 'white',
      border: 'none'
    },
    success: {
      bg: '#22c55e',
      bgHover: '#16a34a',
      color: 'white',
      border: 'none'
    }
  }

  const style = variants[variant] || variants.secondary

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: '10px 20px',
        borderRadius: '8px',
        backgroundColor: disabled ? (isDark ? '#475569' : '#e5e7eb') : style.bg,
        color: disabled ? colors.textSecondary : style.color,
        border: style.border,
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'background-color 0.2s',
        opacity: disabled ? 0.6 : 1
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.target.style.backgroundColor = style.bgHover
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.target.style.backgroundColor = style.bg
      }}
    >
      {loading && (
        <span style={{
          width: '16px',
          height: '16px',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          display: 'inline-block'
        }} />
      )}
      {children}
    </button>
  )
}

export default Modal
