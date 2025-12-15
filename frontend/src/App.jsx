import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Investments from './pages/Investments'
import Debts from './pages/Debts'
import Bills from './pages/Bills'
import Budget from './pages/Budget'
import Reports from './pages/Reports'
import Goals from './pages/Goals'
import Categories from './pages/Categories'
import Accounts from './pages/Accounts'
import Recurring from './pages/Recurring'
import Settings from './pages/Settings'
import Profile from './pages/Profile'

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
    <ThemeProvider>
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
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="investments" element={<Investments />} />
          <Route path="debts" element={<Debts />} />
          <Route path="bills" element={<Bills />} />
          <Route path="budget" element={<Budget />} />
          <Route path="reports" element={<Reports />} />
          <Route path="goals" element={<Goals />} />
          <Route path="categories" element={<Categories />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="recurring" element={<Recurring />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}

export default App
