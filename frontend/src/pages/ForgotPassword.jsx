import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const { requestPasswordReset } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await requestPasswordReset(email)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao solicitar recuperação de senha')
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
        {/* Back link */}
        <Link
          to="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#6b7280',
            textDecoration: 'none',
            fontSize: '14px',
            marginBottom: '24px'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#3b82f6'}
          onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
        >
          <ArrowLeft size={16} />
          Voltar ao login
        </Link>

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
            Recuperar Senha
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: 0
          }}>
            Digite seu email para receber as instruções
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
              Email Enviado!
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha.
            </p>
            <p style={{
              fontSize: '13px',
              color: '#9ca3af',
              marginBottom: '24px'
            }}>
              Não recebeu? Verifique sua pasta de spam.
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
              Voltar ao Login
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
                border: '1px solid #fecaca'
              }}>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Email field */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Email
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
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
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    style={{
                      width: '100%',
                      padding: '14px 14px 14px 44px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
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
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
                }}
                onMouseOver={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(-1px)'
                    e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)'
                  }
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)'
                  e.target.style.boxShadow = '0 4px 14px rgba(59, 130, 246, 0.4)'
                }}
              >
                {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword
