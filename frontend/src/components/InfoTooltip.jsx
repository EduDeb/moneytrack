import React, { useState, useRef, useEffect, useContext } from 'react';
import { HelpCircle } from 'lucide-react';
import { ThemeContext } from '../contexts/ThemeContext';

// Dicionário de termos financeiros com explicações didáticas
const FINANCIAL_TERMS = {
  'Patrimônio Líquido': 'É tudo que você possui (bens e investimentos) menos tudo que você deve (dívidas e contas a pagar). Em outras palavras, é o seu valor líquido total.',
  'Rentabilidade': 'É o ganho ou lucro que você obtém sobre um investimento. Por exemplo, se você investiu R$ 100 e ganhou R$ 10, sua rentabilidade foi de 10%.',
  'Fluxo de Caixa': 'É o registro de todo dinheiro que entra e sai da sua conta. Ajuda a entender para onde seu dinheiro está indo e se você está gastando mais do que ganha.',
  'Reserva de Emergência': 'É uma quantia guardada especificamente para imprevistos, como perda de emprego ou emergências médicas. Recomenda-se ter de 6 a 12 meses das suas despesas mensais.',
  'Diversificação': 'É a estratégia de não colocar todos os ovos na mesma cesta. Significa distribuir seus investimentos em diferentes tipos de aplicações para reduzir riscos.',
  'ROI': 'Return on Investment (Retorno sobre Investimento). Mede quanto você ganhou ou perdeu em relação ao valor investido. ROI = (Ganho - Custo) / Custo × 100%.',
  'Juros Compostos': 'São os "juros sobre juros". É quando você ganha rendimentos não apenas sobre o valor inicial, mas também sobre os juros já acumulados. É o segredo para fazer seu dinheiro crescer exponencialmente.',
  'Liquidez': 'É a facilidade e rapidez com que você pode transformar um investimento em dinheiro sem perder valor. Por exemplo, a poupança tem alta liquidez, enquanto um imóvel tem baixa liquidez.'
};

const InfoTooltip = ({ term, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const { isDark, colors } = useContext(ThemeContext);
  const tooltipRef = useRef(null);
  const iconRef = useRef(null);

  // Buscar explicação do dicionário ou usar children
  const explanation = term && FINANCIAL_TERMS[term] ? FINANCIAL_TERMS[term] : children;

  useEffect(() => {
    if (isVisible && iconRef.current && tooltipRef.current) {
      calculatePosition();
    }
  }, [isVisible, position]);

  const calculatePosition = () => {
    if (!iconRef.current || !tooltipRef.current) return;

    const iconRect = iconRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spacing = 8;

    let top = 0;
    let left = 0;
    let finalPosition = position;

    // Calcular posição baseada na prop position
    switch (position) {
      case 'top':
        top = iconRect.top - tooltipRect.height - spacing;
        left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);

        // Se não couber em cima, mudar para baixo
        if (top < 0) {
          finalPosition = 'bottom';
          top = iconRect.bottom + spacing;
        }
        break;

      case 'bottom':
        top = iconRect.bottom + spacing;
        left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);

        // Se não couber embaixo, mudar para cima
        if (top + tooltipRect.height > viewportHeight) {
          finalPosition = 'top';
          top = iconRect.top - tooltipRect.height - spacing;
        }
        break;

      case 'left':
        top = iconRect.top + (iconRect.height / 2) - (tooltipRect.height / 2);
        left = iconRect.left - tooltipRect.width - spacing;

        // Se não couber à esquerda, mudar para direita
        if (left < 0) {
          finalPosition = 'right';
          left = iconRect.right + spacing;
        }
        break;

      case 'right':
        top = iconRect.top + (iconRect.height / 2) - (tooltipRect.height / 2);
        left = iconRect.right + spacing;

        // Se não couber à direita, mudar para esquerda
        if (left + tooltipRect.width > viewportWidth) {
          finalPosition = 'left';
          left = iconRect.left - tooltipRect.width - spacing;
        }
        break;

      default:
        break;
    }

    // Ajustar horizontalmente para não sair da tela
    if (left < spacing) {
      left = spacing;
    } else if (left + tooltipRect.width > viewportWidth - spacing) {
      left = viewportWidth - tooltipRect.width - spacing;
    }

    // Ajustar verticalmente para não sair da tela
    if (top < spacing) {
      top = spacing;
    } else if (top + tooltipRect.height > viewportHeight - spacing) {
      top = viewportHeight - tooltipRect.height - spacing;
    }

    setTooltipPosition({ top, left });
    setAdjustedPosition(finalPosition);
  };

  const handleMouseEnter = () => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    setIsVisible(!isVisible);
  };

  // Fechar tooltip ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target) &&
        iconRef.current &&
        !iconRef.current.contains(event.target)
      ) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', () => setIsVisible(false), true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', () => setIsVisible(false), true);
    };
  }, [isVisible]);

  const iconContainerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '4px',
    cursor: 'pointer',
    position: 'relative',
    verticalAlign: 'middle'
  };

  const iconStyle = {
    width: '16px',
    height: '16px',
    color: isDark ? '#9ca3af' : '#6b7280',
    transition: 'color 0.2s ease',
  };

  const iconHoverStyle = {
    color: isDark ? '#60a5fa' : '#3b82f6',
  };

  const tooltipStyle = {
    position: 'fixed',
    top: `${tooltipPosition.top}px`,
    left: `${tooltipPosition.left}px`,
    maxWidth: '280px',
    minWidth: '200px',
    padding: '12px 16px',
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    color: isDark ? '#f3f4f6' : '#1f2937',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    borderRadius: '8px',
    boxShadow: isDark
      ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)'
      : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    zIndex: 9999,
    fontSize: '14px',
    lineHeight: '1.5',
    opacity: isVisible ? 1 : 0,
    visibility: isVisible ? 'visible' : 'hidden',
    transition: 'opacity 0.2s ease, visibility 0.2s ease',
    pointerEvents: isVisible ? 'auto' : 'none'
  };

  const titleStyle = {
    fontWeight: '600',
    marginBottom: '8px',
    fontSize: '15px',
    color: isDark ? '#60a5fa' : '#3b82f6',
    borderBottom: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    paddingBottom: '6px'
  };

  const textStyle = {
    fontSize: '13px',
    lineHeight: '1.6',
    color: isDark ? '#d1d5db' : '#4b5563'
  };

  const arrowStyle = {
    position: 'absolute',
    width: '8px',
    height: '8px',
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    transform: 'rotate(45deg)',
    zIndex: -1
  };

  const getArrowPosition = () => {
    const iconRect = iconRef.current?.getBoundingClientRect();
    if (!iconRect) return {};

    const arrowOffset = {
      top: {},
      bottom: {},
      left: {},
      right: {}
    };

    switch (adjustedPosition) {
      case 'top':
        arrowOffset.top = {
          bottom: '-4px',
          left: '50%',
          marginLeft: '-4px',
          borderBottom: 'none',
          borderRight: 'none'
        };
        break;
      case 'bottom':
        arrowOffset.bottom = {
          top: '-4px',
          left: '50%',
          marginLeft: '-4px',
          borderTop: 'none',
          borderLeft: 'none'
        };
        break;
      case 'left':
        arrowOffset.left = {
          right: '-4px',
          top: '50%',
          marginTop: '-4px',
          borderBottom: 'none',
          borderRight: 'none'
        };
        break;
      case 'right':
        arrowOffset.right = {
          left: '-4px',
          top: '50%',
          marginTop: '-4px',
          borderTop: 'none',
          borderLeft: 'none'
        };
        break;
      default:
        break;
    }

    return arrowOffset[adjustedPosition] || {};
  };

  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <span
        ref={iconRef}
        style={iconContainerStyle}
        onMouseEnter={() => {
          handleMouseEnter();
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          handleMouseLeave();
          setIsHovered(false);
        }}
        onClick={handleClick}
      >
        <HelpCircle
          style={isHovered ? { ...iconStyle, ...iconHoverStyle } : iconStyle}
        />
      </span>

      {(isVisible || tooltipPosition.top !== 0) && (
        <div
          ref={tooltipRef}
          style={tooltipStyle}
        >
          <div style={{ ...arrowStyle, ...getArrowPosition() }} />
          {term && (
            <div style={titleStyle}>{term}</div>
          )}
          <div style={textStyle}>{explanation}</div>
        </div>
      )}
    </>
  );
};

export default InfoTooltip;
