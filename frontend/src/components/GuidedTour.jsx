import { useState, useEffect, useContext, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ThemeContext } from '../contexts/ThemeContext'
import {
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Wallet,
  TrendingUp,
  Heart,
  Calendar,
  Search,
  Menu
} from 'lucide-react'

// Passos padrão do tour para o Dashboard
export const defaultDashboardSteps = [
  {
    target: null, // Sem target = modal central
    title: 'Bem-vindo ao MoneyTrack!',
    content: 'Vamos fazer um tour rápido pelas principais funcionalidades para você aproveitar ao máximo sua experiência de gestão financeira.',
    icon: Sparkles,
    position: 'center'
  },
  {
    target: '[data-tour="summary-cards"]',
    title: 'Cards de Resumo',
    content: 'Aqui você visualiza o resumo das suas finanças: total de receitas (verde), despesas (vermelho) e seu saldo atual. Esses valores são atualizados em tempo real.',
    icon: Wallet,
    position: 'bottom'
  },
  {
    target: '[data-tour="net-worth"]',
    title: 'Patrimônio Líquido',
    content: 'O patrimônio líquido é a soma de todos os seus ativos (contas bancárias, investimentos) menos seus passivos (dívidas). Acompanhe a evolução do seu patrimônio ao longo do tempo.',
    icon: TrendingUp,
    position: 'top'
  },
  {
    target: '[data-tour="financial-health"]',
    title: 'Saúde Financeira',
    content: 'Este score analisa diversos fatores como: relação receita/despesa, consistência de economia, diversificação e controle de dívidas. Quanto maior o score, melhor sua saúde financeira!',
    icon: Heart,
    position: 'top'
  },
  {
    target: '[data-tour="upcoming-bills"]',
    title: 'Próximas Contas',
    content: 'Visualize as contas que vencem em breve. Clique no botão "Pagar" para registrar o pagamento e manter suas finanças em dia. Contas atrasadas aparecem em vermelho.',
    icon: Calendar,
    position: 'left'
  },
  {
    target: '[data-tour="global-search"]',
    title: 'Busca Global',
    content: 'Use Ctrl+K (ou Cmd+K no Mac) para abrir a busca global. Encontre rapidamente transações, categorias, contas e navegue entre páginas sem sair do teclado.',
    icon: Search,
    position: 'bottom'
  },
  {
    target: '[data-tour="navigation"]',
    title: 'Menu de Navegação',
    content: 'Explore todas as funcionalidades pelo menu lateral: Dashboard, Transações, Contas, Categorias, Relatórios e Configurações. Clique no ícone de menu para expandir/recolher.',
    icon: Menu,
    position: 'right'
  }
]

export default function GuidedTour({
  steps = defaultDashboardSteps,
  onComplete,
  onSkip,
  storageKey = 'guidedTour_completed'
}) {
  const { colors, isDark } = useContext(ThemeContext)
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [highlightRect, setHighlightRect] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const observerRef = useRef(null)
  const currentTargetRef = useRef(null)

  // Verificar se o tour já foi completado
  useEffect(() => {
    const completed = localStorage.getItem(storageKey)
    if (!completed) {
      // Pequeno delay para garantir que o DOM está pronto
      setTimeout(() => setIsActive(true), 500)
    }
  }, [storageKey])

  // Função para calcular a posição do elemento destacado
  const calculateHighlight = useCallback((element) => {
    if (!element) return null

    const rect = element.getBoundingClientRect()
    const padding = 8

    return {
      top: rect.top + window.scrollY - padding,
      left: rect.left + window.scrollX - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    }
  }, [])

  // Função para calcular a posição do tooltip
  const calculateTooltipPosition = useCallback((element, position, tooltipEl) => {
    if (!element || !tooltipEl) {
      // Posição central para modais
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }
    }

    const rect = element.getBoundingClientRect()
    const tooltipRect = tooltipEl.getBoundingClientRect()
    const spacing = 20
    const padding = 16

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = rect.top + window.scrollY - tooltipRect.height - spacing
        left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2)
        break
      case 'bottom':
        top = rect.bottom + window.scrollY + spacing
        left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2)
        break
      case 'left':
        top = rect.top + window.scrollY + (rect.height / 2) - (tooltipRect.height / 2)
        left = rect.left + window.scrollX - tooltipRect.width - spacing
        break
      case 'right':
        top = rect.top + window.scrollY + (rect.height / 2) - (tooltipRect.height / 2)
        left = rect.right + window.scrollX + spacing
        break
      default:
        top = rect.bottom + window.scrollY + spacing
        left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2)
    }

    // Ajustar para não sair da tela
    if (left < padding) left = padding
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding
    }
    if (top < padding) top = padding

    return { top, left }
  }, [])

  // Atualizar posições quando mudar de step
  useEffect(() => {
    if (!isActive) return

    const step = steps[currentStep]
    if (!step) return

    const updatePositions = () => {
      const element = step.target ? document.querySelector(step.target) : null
      currentTargetRef.current = element

      if (element) {
        const rect = calculateHighlight(element)
        setHighlightRect(rect)

        // Scroll suave até o elemento
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })

        // Aguardar o tooltip renderizar para calcular posição
        setTimeout(() => {
          const tooltipEl = document.querySelector('[data-guided-tour-tooltip]')
          const pos = calculateTooltipPosition(element, step.position, tooltipEl)
          setTooltipPosition(pos)
        }, 100)
      } else {
        setHighlightRect(null)
        setTooltipPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
      }
    }

    updatePositions()

    // Observer para reposicionar se o elemento mudar de tamanho/posição
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    if (step.target) {
      const element = document.querySelector(step.target)
      if (element) {
        observerRef.current = new ResizeObserver(updatePositions)
        observerRef.current.observe(element)
      }
    }

    // Listener para resize da janela
    window.addEventListener('resize', updatePositions)
    window.addEventListener('scroll', updatePositions)

    return () => {
      window.removeEventListener('resize', updatePositions)
      window.removeEventListener('scroll', updatePositions)
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [isActive, currentStep, steps, calculateHighlight, calculateTooltipPosition])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
      // Salvar progresso
      localStorage.setItem(`${storageKey}_progress`, currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      localStorage.setItem(`${storageKey}_progress`, currentStep - 1)
    }
  }

  const handleComplete = () => {
    setIsActive(false)
    localStorage.setItem(storageKey, 'true')
    localStorage.removeItem(`${storageKey}_progress`)
    if (onComplete) onComplete()
  }

  const handleSkip = () => {
    setIsActive(false)
    localStorage.setItem(storageKey, 'true')
    localStorage.removeItem(`${storageKey}_progress`)
    if (onSkip) onSkip()
  }

  if (!isActive) return null

  const step = steps[currentStep]
  const StepIcon = step.icon || Sparkles
  const isLastStep = currentStep === steps.length - 1
  const isFirstStep = currentStep === 0

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      {/* Overlay escuro */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(2px)',
          transition: 'opacity 300ms ease',
          pointerEvents: 'auto'
        }}
        onClick={handleSkip}
      />

      {/* Highlight do elemento */}
      {highlightRect && (
        <>
          {/* Box branco ao redor do elemento */}
          <div
            style={{
              position: 'absolute',
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
              border: `3px solid ${colors.primary}`,
              borderRadius: '8px',
              boxShadow: `0 0 0 4px ${colors.primary}40, 0 0 20px ${colors.primary}60`,
              transition: 'all 300ms ease',
              pointerEvents: 'none',
              animation: 'pulse 2s infinite'
            }}
          />
          {/* Área transparente para permitir interação */}
          <div
            style={{
              position: 'absolute',
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
              borderRadius: '8px',
              backgroundColor: colors.backgroundCard,
              pointerEvents: 'auto'
            }}
          />
        </>
      )}

      {/* Tooltip */}
      <div
        data-guided-tour-tooltip
        style={{
          position: 'absolute',
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: tooltipPosition.transform,
          maxWidth: '400px',
          backgroundColor: colors.backgroundCard,
          borderRadius: '12px',
          padding: '24px',
          boxShadow: isDark
            ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)'
            : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          pointerEvents: 'auto',
          transition: 'all 300ms ease',
          border: `1px solid ${colors.border}`,
          zIndex: 10000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: `${colors.primary}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              flexShrink: 0
            }}
          >
            <StepIcon size={22} color={colors.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: colors.text,
                marginBottom: '8px'
              }}
            >
              {step.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                lineHeight: '1.6',
                color: colors.textSecondary
              }}
            >
              {step.content}
            </p>
          </div>
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: colors.textSecondary,
              marginLeft: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 200ms',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.backgroundSecondary
              e.currentTarget.style.color = colors.text
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = colors.textSecondary
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress indicator */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {steps.map((_, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  height: '3px',
                  borderRadius: '2px',
                  backgroundColor: index <= currentStep ? colors.primary : colors.border,
                  transition: 'all 300ms ease'
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: '12px', color: colors.textSecondary }}>
            Passo {currentStep + 1} de {steps.length}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '10px 16px',
              cursor: 'pointer',
              color: colors.textSecondary,
              fontSize: '14px',
              fontWeight: '500',
              borderRadius: '8px',
              transition: 'all 200ms'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.backgroundSecondary
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Pular tour
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                style={{
                  background: colors.backgroundSecondary,
                  border: `1px solid ${colors.border}`,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: colors.text,
                  fontSize: '14px',
                  fontWeight: '500',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 200ms'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
            )}

            <button
              onClick={handleNext}
              style={{
                background: colors.primary,
                border: 'none',
                padding: '10px 20px',
                cursor: 'pointer',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 200ms'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = `0 8px 16px ${colors.primary}40`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {isLastStep ? 'Finalizar' : 'Próximo'}
              {!isLastStep && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Animação de pulse */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              box-shadow: 0 0 0 4px ${colors.primary}40, 0 0 20px ${colors.primary}60;
            }
            50% {
              box-shadow: 0 0 0 8px ${colors.primary}20, 0 0 30px ${colors.primary}40;
            }
          }
        `}
      </style>
    </div>,
    document.body
  )
}
