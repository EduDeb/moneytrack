import { useState, useContext } from 'react';
import { X, Lightbulb, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { ThemeContext } from '../contexts/ThemeContext';

const TipCard = ({
  type = 'info',
  icon: CustomIcon,
  title,
  children,
  actionLabel,
  onAction,
  dismissable = true,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const { isDark, colors } = useContext(ThemeContext);

  // Mapeamento de ícones padrão por tipo
  const defaultIcons = {
    success: CheckCircle,
    warning: AlertTriangle,
    danger: AlertTriangle,
    info: Lightbulb,
  };

  // Seleciona o ícone (customizado ou padrão)
  const Icon = CustomIcon || defaultIcons[type] || Info;

  // Configurações de cores para cada variante (light mode)
  const variantStylesLight = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      textColor: 'text-green-800',
      buttonBg: 'bg-green-600 hover:bg-green-700',
      buttonText: 'text-white',
      closeHover: 'hover:bg-green-100',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-900',
      textColor: 'text-yellow-800',
      buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
      buttonText: 'text-white',
      closeHover: 'hover:bg-yellow-100',
    },
    danger: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      textColor: 'text-red-800',
      buttonBg: 'bg-red-600 hover:bg-red-700',
      buttonText: 'text-white',
      closeHover: 'hover:bg-red-100',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      textColor: 'text-blue-800',
      buttonBg: 'bg-blue-600 hover:bg-blue-700',
      buttonText: 'text-white',
      closeHover: 'hover:bg-blue-100',
    },
  };

  // Configurações de cores para cada variante (dark mode)
  const variantStylesDark = {
    success: {
      bg: 'bg-green-900/20',
      border: 'border-green-800/30',
      iconBg: 'bg-green-800/30',
      iconColor: 'text-green-400',
      titleColor: 'text-green-300',
      textColor: 'text-green-200',
      buttonBg: 'bg-green-700 hover:bg-green-600',
      buttonText: 'text-white',
      closeHover: 'hover:bg-green-800/40',
    },
    warning: {
      bg: 'bg-yellow-900/20',
      border: 'border-yellow-800/30',
      iconBg: 'bg-yellow-800/30',
      iconColor: 'text-yellow-400',
      titleColor: 'text-yellow-300',
      textColor: 'text-yellow-200',
      buttonBg: 'bg-yellow-700 hover:bg-yellow-600',
      buttonText: 'text-white',
      closeHover: 'hover:bg-yellow-800/40',
    },
    danger: {
      bg: 'bg-red-900/20',
      border: 'border-red-800/30',
      iconBg: 'bg-red-800/30',
      iconColor: 'text-red-400',
      titleColor: 'text-red-300',
      textColor: 'text-red-200',
      buttonBg: 'bg-red-700 hover:bg-red-600',
      buttonText: 'text-white',
      closeHover: 'hover:bg-red-800/40',
    },
    info: {
      bg: 'bg-blue-900/20',
      border: 'border-blue-800/30',
      iconBg: 'bg-blue-800/30',
      iconColor: 'text-blue-400',
      titleColor: 'text-blue-300',
      textColor: 'text-blue-200',
      buttonBg: 'bg-blue-700 hover:bg-blue-600',
      buttonText: 'text-white',
      closeHover: 'hover:bg-blue-800/40',
    },
  };

  // Seleciona o conjunto de estilos baseado no modo
  const variantStyles = isDark ? variantStylesDark : variantStylesLight;
  const styles = variantStyles[type] || variantStyles.info;

  const handleDismiss = () => {
    setIsExiting(true);

    // Aguarda a animação de saída antes de esconder
    setTimeout(() => {
      setIsVisible(false);
      if (onDismiss) {
        onDismiss();
      }
    }, 300);
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`
        ${styles.bg} ${styles.border}
        border rounded-lg p-4 shadow-sm
        transition-all duration-300 ease-in-out
        ${isExiting
          ? 'opacity-0 scale-95 translate-y-2'
          : 'opacity-100 scale-100 translate-y-0'
        }
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Ícone */}
        <div className={`${styles.iconBg} rounded-lg p-2 flex-shrink-0`}>
          <Icon className={`${styles.iconColor} w-5 h-5`} />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {/* Título */}
          <h3 className={`${styles.titleColor} font-semibold text-sm mb-1`}>
            {title}
          </h3>

          {/* Descrição/Children */}
          <div className={`${styles.textColor} text-sm leading-relaxed`}>
            {children}
          </div>

          {/* Botão de ação */}
          {actionLabel && onAction && (
            <button
              onClick={handleAction}
              className={`
                ${styles.buttonBg} ${styles.buttonText}
                mt-3 px-4 py-2 rounded-md text-sm font-medium
                transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-offset-2
                ${isDark ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'}
              `}
            >
              {actionLabel}
            </button>
          )}
        </div>

        {/* Botão de fechar */}
        {dismissable && (
          <button
            onClick={handleDismiss}
            className={`
              ${styles.closeHover}
              flex-shrink-0 rounded-md p-1.5
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-2
              ${isDark ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white'}
            `}
            aria-label="Fechar dica"
          >
            <X className={`${styles.iconColor} w-4 h-4`} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TipCard;
