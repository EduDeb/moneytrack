import { Routes, Route, Navigate } from 'react-router-dom'
import { Component, Suspense, lazy } from 'react'
import { useAuth } from './context/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { CategoriesProvider } from './contexts/CategoriesContext'
import Layout from './components/Layout'

// Páginas de autenticação - carregamento direto (primeira interação)
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// Lazy loading para páginas internas (code splitting)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Investments = lazy(() => import('./pages/Investments'))
const Debts = lazy(() => import('./pages/Debts'))
const Bills = lazy(() => import('./pages/Bills'))
const Budget = lazy(() => import('./pages/Budget'))
const Reports = lazy(() => import('./pages/Reports'))
const Goals = lazy(() => import('./pages/Goals'))
const Categories = lazy(() => import('./pages/Categories'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Recurring = lazy(() => import('./pages/Recurring'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))

// Componente de loading para Suspense
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '50vh',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #e2e8f0',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ color: '#64748b', fontSize: '14px' }}>Carregando...</p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Error Boundary para capturar erros em componentes filhos
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '500px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <span style={{ fontSize: '32px' }}>⚠️</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', marginBottom: '12px' }}>
              Ops! Algo deu errado
            </h1>
            <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
              Ocorreu um erro inesperado. Por favor, tente recarregar a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Recarregar Página
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return user ? children : <Navigate to="/login" />
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <CategoriesProvider>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="transactions" element={<Suspense fallback={<PageLoader />}><Transactions /></Suspense>} />
          <Route path="investments" element={<Suspense fallback={<PageLoader />}><Investments /></Suspense>} />
          <Route path="debts" element={<Suspense fallback={<PageLoader />}><Debts /></Suspense>} />
          <Route path="bills" element={<Suspense fallback={<PageLoader />}><Bills /></Suspense>} />
          <Route path="budget" element={<Suspense fallback={<PageLoader />}><Budget /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
          <Route path="goals" element={<Suspense fallback={<PageLoader />}><Goals /></Suspense>} />
          <Route path="categories" element={<Suspense fallback={<PageLoader />}><Categories /></Suspense>} />
          <Route path="accounts" element={<Suspense fallback={<PageLoader />}><Accounts /></Suspense>} />
          <Route path="recurring" element={<Suspense fallback={<PageLoader />}><Recurring /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
        </Route>
        </Routes>
        </CategoriesProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
