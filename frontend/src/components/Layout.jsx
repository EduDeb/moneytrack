import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useContext, useState, useEffect } from 'react'
import { ThemeContext } from '../contexts/ThemeContext'
import api from '../services/api'
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  CreditCard,
  LogOut,
  Menu,
  X,
  Plus,
  Receipt,
  Target,
  FileText,
  Flag,
  Tag,
  Wallet,
  RefreshCw,
  Settings,
  User,
  Bell,
  ChevronDown,
  Moon,
  Sun,
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle
} from 'lucide-react'
import QuickTransaction from './QuickTransaction'
import GlobalSearch from './GlobalSearch'

function Layout() {
  const { user, logout } = useAuth()
  const { theme, setTheme, primaryColor, isDark, colors } = useContext(ThemeContext)
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [quickTransactionOpen, setQuickTransactionOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Atalho de teclado para busca (Cmd+K ou Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    const fetchNotificationsInternal = async () => {
      try {
        const { data } = await api.get('/notifications?limit=10', {
          signal: abortController.signal
        })
        if (isMounted) {
          setNotifications(data.notifications || [])
          setUnreadCount(data.unreadCount || 0)
        }
      } catch (error) {
        if (error.name !== 'AbortError' && isMounted) {
          console.error('Erro ao buscar notificações:', error)
        }
      }
    }

    const generateAndFetch = async () => {
      try {
        await api.post('/notifications/generate', {}, {
          signal: abortController.signal
        })
        if (isMounted) {
          fetchNotificationsInternal()
        }
      } catch (error) {
        if (error.name !== 'AbortError' && isMounted) {
          console.error('Erro ao gerar notificações:', error)
          fetchNotificationsInternal()
        }
      }
    }

    generateAndFetch()
    const interval = setInterval(() => {
      if (isMounted) fetchNotificationsInternal()
    }, 5 * 60 * 1000)

    return () => {
      isMounted = false
      abortController.abort()
      clearInterval(interval)
    }
  }, [])

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications?limit=10')
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      console.error('Erro ao buscar notificações:', error)
    }
  }

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      fetchNotifications()
    } catch (error) {
      console.error('Erro ao marcar como lida:', error)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navGroups = [
    {
      title: 'Principal',
      items: [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
        { path: '/accounts', icon: Wallet, label: 'Contas' }
      ]
    },
    {
      title: 'Gestão',
      items: [
        { path: '/bills', icon: Receipt, label: 'Contas a Pagar' },
        { path: '/recurring', icon: RefreshCw, label: 'Recorrências' },
        { path: '/budget', icon: Target, label: 'Orçamento' },
        { path: '/goals', icon: Flag, label: 'Metas' }
      ]
    },
    {
      title: 'Análise',
      items: [
        { path: '/reports', icon: FileText, label: 'Relatórios' },
        { path: '/categories', icon: Tag, label: 'Categorias' }
      ]
    },
    {
      title: 'Patrimônio',
      items: [
        { path: '/investments', icon: TrendingUp, label: 'Investimentos' },
        { path: '/debts', icon: CreditCard, label: 'Dívidas' }
      ]
    }
  ]

  const sidebarStyle = {
    background: isDark ? colors.backgroundCard : '#fff',
    borderRight: `1px solid ${colors.border}`
  }

  const mainStyle = {
    background: colors.background,
    minHeight: '100vh'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Overlay Mobile */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        role="navigation"
        aria-label="Menu principal"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '260px',
          ...sidebarStyle,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          '@media (min-width: 1024px)': {
            transform: 'translateX(0)',
            position: 'static'
          }
        }}
        className="sidebar-desktop"
      >
        {/* Logo */}
        <div style={{
          padding: '1.5rem',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.75rem',
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Wallet size={22} style={{ color: '#fff' }} />
            </div>
            <div>
              <h1 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: colors.text,
                margin: 0
              }}>
                MoneyTrack
              </h1>
              <p style={{
                fontSize: '0.75rem',
                color: colors.textSecondary,
                margin: 0
              }}>
                Suas finanças em dia · v1.0.2
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label="Navegação principal" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
          {navGroups.map((group, groupIndex) => (
            <div key={group.title} role="group" aria-labelledby={`nav-group-${groupIndex}`} style={{ marginBottom: groupIndex < navGroups.length - 1 ? '1.5rem' : 0 }}>
              <p id={`nav-group-${groupIndex}`} style={{
                fontSize: '0.6875rem',
                fontWeight: '600',
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0 0.75rem',
                marginBottom: '0.5rem'
              }}>
                {group.title}
              </p>
              {group.items.map(({ path, icon: Icon, label }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  aria-label={`Ir para ${label}`}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '0.5rem',
                    marginBottom: '0.25rem',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: isActive ? '600' : '400',
                    background: isActive ? `${primaryColor}15` : 'transparent',
                    color: isActive ? primaryColor : colors.textSecondary,
                    transition: 'all 0.15s'
                  })}
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${colors.border}`
        }}>
          <NavLink
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '0.5rem',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: isActive ? '600' : '400',
              background: isActive ? `${primaryColor}15` : 'transparent',
              color: isActive ? primaryColor : colors.textSecondary
            })}
          >
            <Settings size={18} />
            Configurações
          </NavLink>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 0.75rem',
              width: '100%',
              border: 'none',
              borderRadius: '0.5rem',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: '#ef4444'
            }}
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '260px' }} className="main-content">
        {/* Top Bar */}
        <header style={{
          background: isDark ? colors.backgroundCard : '#fff',
          borderBottom: `1px solid ${colors.border}`,
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 30
        }}>
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              padding: '0.5rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'none'
            }}
            className="mobile-menu-btn"
          >
            <Menu size={24} style={{ color: colors.text }} />
          </button>

          {/* Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              background: isDark ? '#1e293b' : '#f8fafc',
              cursor: 'pointer',
              color: colors.textSecondary,
              minWidth: '200px'
            }}
          >
            <Search size={16} />
            <span style={{ flex: 1, textAlign: 'left', fontSize: '14px' }}>Buscar...</span>
            <span style={{
              padding: '2px 6px',
              borderRadius: '4px',
              background: isDark ? '#334155' : '#e2e8f0',
              fontSize: '11px',
              fontWeight: '500'
            }}>
              Ctrl K
            </span>
          </button>

          <div style={{ flex: 1 }} />

          {/* Right Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{
                padding: '0.625rem',
                border: 'none',
                borderRadius: '0.5rem',
                background: isDark ? '#334155' : '#f1f5f9',
                cursor: 'pointer'
              }}
              title={isDark ? 'Modo Claro' : 'Modo Escuro'}
            >
              {isDark ? <Sun size={18} style={{ color: '#fbbf24' }} /> : <Moon size={18} style={{ color: '#64748b' }} />}
            </button>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  padding: '0.625rem',
                  border: 'none',
                  borderRadius: '0.5rem',
                  background: isDark ? '#334155' : '#f1f5f9',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <Bell size={18} style={{ color: colors.textSecondary }} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '8px',
                    height: '8px',
                    background: '#ef4444',
                    borderRadius: '50%'
                  }} />
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  width: '320px',
                  background: isDark ? colors.backgroundCard : '#fff',
                  borderRadius: '0.75rem',
                  border: `1px solid ${colors.border}`,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                  zIndex: 100
                }}>
                  <div style={{
                    padding: '1rem',
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h3 style={{ margin: 0, fontWeight: '600', color: colors.text }}>Notificações</h3>
                    {unreadCount > 0 && (
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.125rem 0.5rem',
                        background: '#fee2e2',
                        color: '#dc2626',
                        borderRadius: '9999px'
                      }}>
                        {unreadCount} novas
                      </span>
                    )}
                  </div>
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {notifications.length > 0 ? (
                      notifications.map(notif => {
                        const notifConfig = {
                          alert: { icon: AlertCircle, color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2' },
                          warning: { icon: AlertTriangle, color: '#f97316', bg: isDark ? 'rgba(249,115,22,0.15)' : '#fff7ed' },
                          info: { icon: Info, color: '#3b82f6', bg: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff' },
                          success: { icon: CheckCircle, color: '#22c55e', bg: isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4' }
                        }[notif.type] || { icon: Bell, color: colors.textSecondary, bg: 'transparent' }
                        const NotifIcon = notifConfig.icon

                        return (
                          <div
                            key={notif._id}
                            onClick={() => markAsRead(notif._id)}
                            style={{
                              display: 'flex',
                              gap: '12px',
                              padding: '12px 16px',
                              borderBottom: `1px solid ${colors.border}`,
                              cursor: 'pointer',
                              background: notif.isRead ? 'transparent' : notifConfig.bg
                            }}
                          >
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: `${notifConfig.color}20`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <NotifIcon size={16} style={{ color: notifConfig.color }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                margin: 0,
                                fontSize: '13px',
                                color: colors.text,
                                fontWeight: notif.isRead ? '400' : '600'
                              }}>
                                {notif.title}
                              </p>
                              <p style={{
                                margin: '4px 0 0',
                                fontSize: '12px',
                                color: colors.textSecondary,
                                lineHeight: '1.4'
                              }}>
                                {notif.message}
                              </p>
                              <p style={{
                                margin: '4px 0 0',
                                fontSize: '11px',
                                color: colors.textSecondary,
                                opacity: 0.7
                              }}>
                                {new Date(notif.createdAt).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: colors.textSecondary }}>
                        <Bell size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                        <p style={{ margin: 0 }}>Nenhuma notificação</p>
                        <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Você está em dia!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '9999px',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: `${primaryColor}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User size={16} style={{ color: primaryColor }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: colors.text }}>
                  {user?.name?.split(' ')[0]}
                </span>
                <ChevronDown size={16} style={{ color: colors.textSecondary }} />
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  width: '200px',
                  background: isDark ? colors.backgroundCard : '#fff',
                  borderRadius: '0.75rem',
                  border: `1px solid ${colors.border}`,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                  zIndex: 100,
                  overflow: 'hidden'
                }}>
                  <NavLink
                    to="/profile"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.875rem 1rem',
                      textDecoration: 'none',
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`
                    }}
                  >
                    <User size={18} style={{ color: colors.textSecondary }} />
                    Meu Perfil
                  </NavLink>
                  <NavLink
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.875rem 1rem',
                      textDecoration: 'none',
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`
                    }}
                  >
                    <Settings size={18} style={{ color: colors.textSecondary }} />
                    Configurações
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.875rem 1rem',
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#ef4444',
                      textAlign: 'left'
                    }}
                  >
                    <LogOut size={18} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{
          flex: 1,
          padding: '1.5rem',
          paddingBottom: '80px', // Espaço extra para o FAB não sobrepor conteúdo
          background: colors.background,
          overflowY: 'auto'
        }}>
          <Outlet />
        </main>
      </div>

      {/* Floating Action Button - Refined */}
      <button
        onClick={() => setQuickTransactionOpen(true)}
        className="fab-button"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          height: '48px',
          paddingLeft: '16px',
          paddingRight: '18px',
          borderRadius: '24px',
          background: primaryColor,
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          zIndex: 40,
          transition: 'all 0.2s ease',
          fontSize: '14px',
          fontWeight: '600'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.25), 0 3px 6px rgba(0,0,0,0.15)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1)'
        }}
        title="Lançamento Rápido"
      >
        <Plus size={20} strokeWidth={2.5} />
        <span>Novo</span>
      </button>

      {/* Quick Transaction Modal */}
      <QuickTransaction
        isOpen={quickTransactionOpen}
        onClose={() => setQuickTransactionOpen(false)}
        onSuccess={() => {
          window.dispatchEvent(new Event('transaction-added'))
        }}
      />

      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {/* Close dropdowns on outside click */}
      {(showNotifications || showUserMenu) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 20 }}
          onClick={() => { setShowNotifications(false); setShowUserMenu(false) }}
        />
      )}

      {/* Responsive Styles */}
      <style>{`
        @media (min-width: 1024px) {
          .sidebar-desktop {
            transform: translateX(0) !important;
            position: static !important;
          }
          .main-content {
            margin-left: 0 !important;
          }
          .mobile-menu-btn {
            display: none !important;
          }
        }
        @media (max-width: 1023px) {
          .main-content {
            margin-left: 0 !important;
          }
          .mobile-menu-btn {
            display: block !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        /* FAB responsive styles */
        @media (max-width: 640px) {
          .fab-button {
            width: 48px !important;
            height: 48px !important;
            padding: 0 !important;
            border-radius: 50% !important;
          }
          .fab-button span {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}

export default Layout
