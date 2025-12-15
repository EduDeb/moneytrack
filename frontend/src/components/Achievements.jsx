import React, { useState, useEffect, useContext } from 'react';
import { Trophy, Star, Award, Medal, Lock, Sparkles, Target, TrendingUp, Coins, Shield, PiggyBank, Zap } from 'lucide-react';
import { ThemeContext } from '../contexts/ThemeContext';

// Achievement Badge Component
const AchievementBadge = ({ achievement, unlocked, onClick, showAnimation }) => {
  const { colors } = useContext(ThemeContext);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (showAnimation) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [showAnimation]);

  const getIcon = (iconName) => {
    const iconMap = {
      trophy: Trophy,
      star: Star,
      award: Award,
      medal: Medal,
      target: Target,
      trending: TrendingUp,
      coins: Coins,
      shield: Shield,
      piggy: PiggyBank,
      zap: Zap,
      sparkles: Sparkles,
    };
    const Icon = iconMap[iconName] || Trophy;
    return <Icon size={32} />;
  };

  const baseStyles = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    borderRadius: '12px',
    border: `2px solid ${unlocked ? colors.primary : colors.border}`,
    backgroundColor: unlocked ? `${colors.primary}10` : colors.backgroundCard,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    minWidth: '160px',
    opacity: unlocked ? 1 : 0.6,
  };

  const animationStyles = isAnimating ? {
    animation: 'unlock 1s ease-out',
    transform: 'scale(1.1)',
  } : {};

  return (
    <>
      <style>{`
        @keyframes unlock {
          0% {
            transform: scale(0.8) rotate(-10deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(5deg);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        .achievement-badge:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
        }

        .achievement-icon {
          animation: ${unlocked && isAnimating ? 'pulse 0.5s ease-in-out 2' : 'none'};
        }

        .achievement-badge.unlocked::after {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(90deg, transparent, ${colors.primary}40, transparent);
          background-size: 2000px 100%;
          animation: shimmer 3s infinite;
          border-radius: 12px;
          z-index: -1;
        }
      `}</style>

      <div
        className={`achievement-badge ${unlocked ? 'unlocked' : ''}`}
        style={{ ...baseStyles, ...animationStyles }}
        onClick={onClick}
      >
        {!unlocked && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            color: colors.textSecondary,
          }}>
            <Lock size={16} />
          </div>
        )}

        <div
          className="achievement-icon"
          style={{
            color: unlocked ? colors.primary : colors.textSecondary,
            marginBottom: '12px',
          }}
        >
          {getIcon(achievement.icon)}
        </div>

        <h4 style={{
          margin: '0 0 8px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: unlocked ? colors.text : colors.textSecondary,
          textAlign: 'center',
        }}>
          {achievement.name}
        </h4>

        <p style={{
          margin: '0 0 8px 0',
          fontSize: '13px',
          color: colors.textSecondary,
          textAlign: 'center',
          lineHeight: '1.4',
        }}>
          {achievement.description}
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 12px',
          borderRadius: '12px',
          backgroundColor: unlocked ? colors.primary : colors.border,
          color: unlocked ? '#fff' : colors.textSecondary,
          fontSize: '12px',
          fontWeight: '600',
        }}>
          <Star size={12} fill={unlocked ? '#fff' : 'none'} />
          {achievement.xp} XP
        </div>

        {unlocked && achievement.unlockedAt && (
          <div style={{
            marginTop: '8px',
            fontSize: '11px',
            color: colors.textSecondary,
          }}>
            {new Date(achievement.unlockedAt).toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>
    </>
  );
};

// Achievement Toast Component
const AchievementToast = ({ achievement, onClose }) => {
  const { colors } = useContext(ThemeContext);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }

        @keyframes glow {
          0%, 100% {
            box-shadow: 0 4px 20px ${colors.primary}40;
          }
          50% {
            box-shadow: 0 4px 30px ${colors.primary}60;
          }
        }
      `}</style>

      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        maxWidth: '350px',
        padding: '20px',
        borderRadius: '12px',
        backgroundColor: colors.backgroundCard,
        border: `2px solid ${colors.primary}`,
        animation: visible ? 'slideIn 0.3s ease-out, glow 2s ease-in-out infinite' : 'slideOut 0.3s ease-in',
        zIndex: 1000,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
        }}>
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: `${colors.primary}20`,
            color: colors.primary,
          }}>
            <Trophy size={32} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}>
              <Sparkles size={16} color={colors.warning} />
              <h4 style={{
                margin: 0,
                fontSize: '14px',
                color: colors.textSecondary,
                textTransform: 'uppercase',
                fontWeight: '600',
                letterSpacing: '0.5px',
              }}>
                Conquista Desbloqueada!
              </h4>
            </div>

            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: '700',
              color: colors.text,
            }}>
              {achievement.name}
            </h3>

            <p style={{
              margin: '0 0 12px 0',
              fontSize: '14px',
              color: colors.textSecondary,
              lineHeight: '1.4',
            }}>
              {achievement.description}
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: colors.primary,
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              width: 'fit-content',
            }}>
              <Star size={14} fill="#fff" />
              +{achievement.xp} XP
            </div>
          </div>

          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onClose, 300);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
              fontSize: '20px',
              lineHeight: 1,
              padding: '4px',
            }}
          >
            &times;
          </button>
        </div>
      </div>
    </>
  );
};

// Main Achievements Component
const Achievements = () => {
  const { colors } = useContext(ThemeContext);

  // Achievement definitions
  const achievementDefinitions = [
    {
      id: 'first_transaction',
      name: 'Primeiro Passo',
      description: 'Registrou sua primeira transação',
      icon: 'coins',
      xp: 10,
      category: 'basics',
    },
    {
      id: 'first_account',
      name: 'Bancarizado',
      description: 'Criou sua primeira conta',
      icon: 'shield',
      xp: 10,
      category: 'basics',
    },
    {
      id: 'first_goal',
      name: 'Sonhador',
      description: 'Criou sua primeira meta financeira',
      icon: 'target',
      xp: 15,
      category: 'basics',
    },
    {
      id: 'first_budget',
      name: 'Planejador',
      description: 'Criou seu primeiro orçamento',
      icon: 'trending',
      xp: 15,
      category: 'basics',
    },
    {
      id: 'week_streak',
      name: 'Constância',
      description: '7 dias seguidos registrando transações',
      icon: 'zap',
      xp: 50,
      category: 'habits',
    },
    {
      id: 'month_streak',
      name: 'Dedicado',
      description: '30 dias seguidos registrando transações',
      icon: 'award',
      xp: 200,
      category: 'habits',
    },
    {
      id: 'budget_master',
      name: 'Mestre do Orçamento',
      description: '3 meses consecutivos dentro do limite',
      icon: 'medal',
      xp: 100,
      category: 'mastery',
    },
    {
      id: 'saver',
      name: 'Poupador',
      description: 'Guardou dinheiro por 3 meses seguidos',
      icon: 'piggy',
      xp: 100,
      category: 'mastery',
    },
    {
      id: 'debt_free',
      name: 'Livre!',
      description: 'Quitou todas as suas dívidas',
      icon: 'sparkles',
      xp: 200,
      category: 'milestones',
    },
    {
      id: 'emergency_fund',
      name: 'Prevenido',
      description: 'Construiu reserva de emergência de 6 meses',
      icon: 'shield',
      xp: 300,
      category: 'milestones',
    },
    {
      id: 'investor',
      name: 'Investidor',
      description: 'Realizou seu primeiro investimento',
      icon: 'trending',
      xp: 50,
      category: 'investment',
    },
    {
      id: 'diversified',
      name: 'Diversificado',
      description: 'Possui 3 tipos diferentes de investimento',
      icon: 'star',
      xp: 150,
      category: 'investment',
    },
  ];

  // Level definitions
  const levels = [
    { name: 'Iniciante', minXP: 0, maxXP: 100, color: '#6B7280' },
    { name: 'Aprendiz', minXP: 101, maxXP: 300, color: '#3B82F6' },
    { name: 'Intermediário', minXP: 301, maxXP: 600, color: '#8B5CF6' },
    { name: 'Avançado', minXP: 601, maxXP: 1000, color: '#EC4899' },
    { name: 'Expert', minXP: 1001, maxXP: Infinity, color: '#F59E0B' },
  ];

  // State
  const [userAchievements, setUserAchievements] = useState([
    { id: 'first_transaction', unlocked: true, unlockedAt: '2025-12-01T10:00:00' },
    { id: 'first_account', unlocked: true, unlockedAt: '2025-12-01T09:30:00' },
    { id: 'first_goal', unlocked: true, unlockedAt: '2025-12-05T14:20:00' },
    { id: 'week_streak', unlocked: true, unlockedAt: '2025-12-08T08:15:00' },
  ]);

  const [totalXP, setTotalXP] = useState(85);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [newAchievement, setNewAchievement] = useState(null);
  const [filter, setFilter] = useState('all');

  // Calculate current level
  const getCurrentLevel = () => {
    return levels.find(level => totalXP >= level.minXP && totalXP <= level.maxXP) || levels[0];
  };

  const currentLevel = getCurrentLevel();
  const nextLevel = levels[levels.indexOf(currentLevel) + 1];
  const progressInLevel = nextLevel
    ? ((totalXP - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100
    : 100;

  // Merge achievement definitions with user data
  const achievements = achievementDefinitions.map(def => {
    const userAch = userAchievements.find(ua => ua.id === def.id);
    return {
      ...def,
      unlocked: userAch?.unlocked || false,
      unlockedAt: userAch?.unlockedAt,
    };
  });

  // Filter achievements
  const filteredAchievements = filter === 'all'
    ? achievements
    : filter === 'unlocked'
    ? achievements.filter(a => a.unlocked)
    : achievements.filter(a => !a.unlocked);

  // Group by category
  const groupedAchievements = filteredAchievements.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = [];
    }
    acc[achievement.category].push(achievement);
    return acc;
  }, {});

  const categoryNames = {
    basics: 'Primeiros Passos',
    habits: 'Hábitos',
    mastery: 'Maestria',
    milestones: 'Marcos Importantes',
    investment: 'Investimentos',
  };

  // Simulate unlocking achievement (for demo)
  const simulateUnlock = () => {
    const lockedAchievements = achievements.filter(a => !a.unlocked);
    if (lockedAchievements.length > 0) {
      const randomAch = lockedAchievements[Math.floor(Math.random() * lockedAchievements.length)];
      const newUnlock = {
        id: randomAch.id,
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      };

      setUserAchievements([...userAchievements, newUnlock]);
      setTotalXP(totalXP + randomAch.xp);
      setNewAchievement(randomAch);
    }
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage = (unlockedCount / totalCount) * 100;

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
    }}>
      {/* Header Section */}
      <div style={{
        marginBottom: '32px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '32px',
              fontWeight: '700',
              color: colors.text,
            }}>
              Conquistas
            </h1>
            <p style={{
              margin: 0,
              fontSize: '16px',
              color: colors.textSecondary,
            }}>
              Desbloqueie conquistas e evolua sua jornada financeira
            </p>
          </div>

          {/* Debug button - remove in production */}
          <button
            onClick={simulateUnlock}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: `1px solid ${colors.primary}`,
              backgroundColor: colors.primary,
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            Simular Conquista
          </button>
        </div>

        {/* Level and XP Section */}
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          backgroundColor: colors.backgroundCard,
          border: `1px solid ${colors.border}`,
          marginBottom: '24px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: `${currentLevel.color}20`,
                border: `3px solid ${currentLevel.color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
              }}>
                <Trophy size={40} color={currentLevel.color} />
              </div>

              <div>
                <div style={{
                  fontSize: '14px',
                  color: colors.textSecondary,
                  marginBottom: '4px',
                }}>
                  Nível Atual
                </div>
                <h2 style={{
                  margin: '0 0 4px 0',
                  fontSize: '28px',
                  fontWeight: '700',
                  color: currentLevel.color,
                }}>
                  {currentLevel.name}
                </h2>
                <div style={{
                  fontSize: '16px',
                  color: colors.text,
                  fontWeight: '600',
                }}>
                  {totalXP} XP
                  {nextLevel && ` / ${nextLevel.minXP} XP`}
                </div>
              </div>
            </div>

            <div style={{
              textAlign: 'right',
            }}>
              <div style={{
                fontSize: '14px',
                color: colors.textSecondary,
                marginBottom: '8px',
              }}>
                Progresso Geral
              </div>
              <div style={{
                fontSize: '32px',
                fontWeight: '700',
                color: colors.primary,
              }}>
                {unlockedCount}/{totalCount}
              </div>
              <div style={{
                fontSize: '14px',
                color: colors.textSecondary,
              }}>
                {completionPercentage.toFixed(0)}% completo
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {nextLevel && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '13px',
                color: colors.textSecondary,
              }}>
                <span>Próximo nível: {nextLevel.name}</span>
                <span>{nextLevel.minXP - totalXP} XP restantes</span>
              </div>
              <div style={{
                width: '100%',
                height: '12px',
                backgroundColor: colors.background,
                borderRadius: '6px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progressInLevel}%`,
                  height: '100%',
                  backgroundColor: currentLevel.color,
                  borderRadius: '6px',
                  transition: 'width 0.5s ease',
                }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: `1px solid ${colors.border}`,
        }}>
          {['all', 'unlocked', 'locked'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '12px 24px',
                border: 'none',
                backgroundColor: 'transparent',
                color: filter === f ? colors.primary : colors.textSecondary,
                borderBottom: filter === f ? `2px solid ${colors.primary}` : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s',
              }}
            >
              {f === 'all' ? 'Todas' : f === 'unlocked' ? 'Desbloqueadas' : 'Bloqueadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Achievements Grid */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
      }}>
        {Object.entries(groupedAchievements).map(([category, categoryAchievements]) => (
          <div key={category}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '20px',
              fontWeight: '600',
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              {categoryNames[category]}
              <span style={{
                fontSize: '14px',
                color: colors.textSecondary,
                fontWeight: '400',
              }}>
                ({categoryAchievements.filter(a => a.unlocked).length}/{categoryAchievements.length})
              </span>
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '16px',
            }}>
              {categoryAchievements.map(achievement => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                  unlocked={achievement.unlocked}
                  onClick={() => setSelectedAchievement(achievement)}
                  showAnimation={newAchievement?.id === achievement.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Achievement Detail Modal */}
      {selectedAchievement && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
          onClick={() => setSelectedAchievement(null)}
        >
          <div
            style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '90%',
              border: `2px solid ${selectedAchievement.unlocked ? colors.primary : colors.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}>
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                backgroundColor: selectedAchievement.unlocked ? `${colors.primary}20` : colors.background,
                border: `3px solid ${selectedAchievement.unlocked ? colors.primary : colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                color: selectedAchievement.unlocked ? colors.primary : colors.textSecondary,
              }}>
                {selectedAchievement.unlocked ? (
                  <Trophy size={50} />
                ) : (
                  <Lock size={50} />
                )}
              </div>

              <h2 style={{
                margin: '0 0 12px 0',
                fontSize: '28px',
                fontWeight: '700',
                color: colors.text,
              }}>
                {selectedAchievement.name}
              </h2>

              <p style={{
                margin: '0 0 24px 0',
                fontSize: '16px',
                color: colors.textSecondary,
                lineHeight: '1.5',
              }}>
                {selectedAchievement.description}
              </p>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '12px',
                backgroundColor: selectedAchievement.unlocked ? colors.primary : colors.border,
                color: selectedAchievement.unlocked ? '#fff' : colors.textSecondary,
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '24px',
              }}>
                <Star size={16} fill={selectedAchievement.unlocked ? '#fff' : 'none'} />
                {selectedAchievement.xp} XP
              </div>

              {selectedAchievement.unlocked && selectedAchievement.unlockedAt && (
                <div style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  backgroundColor: colors.background,
                  fontSize: '14px',
                  color: colors.textSecondary,
                  marginBottom: '24px',
                }}>
                  Desbloqueada em {new Date(selectedAchievement.unlockedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              )}

              <button
                onClick={() => setSelectedAchievement(null)}
                style={{
                  padding: '12px 32px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Toast Notification */}
      {newAchievement && (
        <AchievementToast
          achievement={newAchievement}
          onClose={() => setNewAchievement(null)}
        />
      )}
    </div>
  );
};

export default Achievements;
