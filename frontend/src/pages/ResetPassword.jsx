import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { resetPassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const validatePassword = (pass) => {
    if (pass.length < 8) return 'Senha deve ter no minimo 8 caracteres'
    if (!/[a-z]/.test(pass)) return 'Senha deve conter letra minuscula'
    if (!/[A-Z]/.test(pass)) return 'Senha deve conter letra maiuscula'
    if (!/\d/.test(pass)) return 'Senha deve conter numero'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validar senha
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem')
      return
    }

    setLoading(true)

    try {
      await resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao redefinir senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
        width: '100%',
        maxWidth: '420px',
        padding: '48px 40px'
      }}>
        {/* Logo/Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '70px',
            height: '70px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)'
          }}>
            <span style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>$</span>
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#1f2937',
            margin: '0 0 8px 0'
          }}>
            Redefinir Senha
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: 0
          }}>
            Digite sua nova senha
          </p>
        </div>

        {success ? (
          /* Success state */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#dcfce7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <CheckCircle size={32} color="#22c55e" />
            </div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '12px'
            }}>
              Senha Alterada!
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              Sua senha foi redefinida com sucesso. Voce sera redirecionado para o login...
            </p>
            <Link
              to="/login"
              style={{
                display: 'inline-block',
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '15px'
              }}
            >
              Ir para Login
            </Link>
          </div>
        ) : (
          <>
            {/* Error message */}
            {error && (
              <div style={{
                background: '#fef2f2',
                color: '#dc2626',
                padding: '14px 16px',
                borderRadius: '10px',
                marginBottom: '24px',
                fontSize: '14px',
                border: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* New Password field */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Nova Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af'
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 8 caracteres"
                    required
                    style={{
                      width: '100%',
                      padding: '14px 48px 14px 44px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '15px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6'
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: '#9ca3af'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  Deve conter maiuscula, minuscula e numero
                </p>
              </div>

              {/* Confirm Password field */}
              <div style={{ marginBottom: '28px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Confirmar Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af'
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    required
                    style={{
                      width: '100%',
                      padding: '14px 14px 14px 44px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '15px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6'
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: loading ? '#93c5fd' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
                }}
              >
                {loading ? 'Salvando...' : 'Redefinir Senha'}
              </button>
            </form>

            {/* Back to login link */}
            <p style={{
              textAlign: 'center',
              marginTop: '24px',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              Lembrou a senha?{' '}
              <Link
                to="/login"
                style={{
                  color: '#3b82f6',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                Fazer login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ResetPassword
