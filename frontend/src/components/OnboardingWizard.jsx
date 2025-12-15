import { useState, useContext } from 'react'
import { ThemeContext } from '../contexts/ThemeContext'
import api from '../services/api'
import {
  Wallet,
  Target,
  PiggyBank,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  CreditCard,
  Building2,
  Banknote,
  TrendingUp
} from 'lucide-react'

const accountTypes = [
  { value: 'checking', label: 'Conta Corrente', icon: Building2, color: '#3b82f6' },
  { value: 'savings', label: 'Poupança', icon: PiggyBank, color: '#22c55e' },
  { value: 'credit_card', label: 'Cartão de Crédito', icon: CreditCard, color: '#ef4444' },
  { value: 'cash', label: 'Dinheiro', icon: Banknote, color: '#f59e0b' },
  { value: 'investment', label: 'Investimentos', icon: TrendingUp, color: '#8b5cf6' }
]

function OnboardingWizard({ onComplete, userName }) {
  const { colors, isDark, primaryColor } = useContext(ThemeContext)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [currentAccount, setCurrentAccount] = useState({
    name: '',
    type: 'checking',
    balance: '',
    institution: ''
  })
  const [goal, setGoal] = useState({
    name: '',
    targetAmount: '',
    deadline: ''
  })
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [monthlyExpense, setMonthlyExpense] = useState('')

  const totalSteps = 4

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.backgroundCard,
    color: colors.text,
    fontSize: '15px',
    boxSizing: 'border-box'
  }

  const handleAddAccount = () => {
    if (currentAccount.name && currentAccount.balance) {
      setAccounts([...accounts, { ...currentAccount, id: Date.now() }])
      setCurrentAccount({ name: '', type: 'checking', balance: '', institution: '' })
    }
  }

  const handleRemoveAccount = (id) => {
    setAccounts(accounts.filter(a => a.id !== id))
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      // Criar contas
      for (const account of accounts) {
        await api.post('/accounts', {
          name: account.name,
          type: account.type,
          balance: parseFloat(account.balance),
          institution: account.institution || undefined
        })
      }

      // Criar meta (se preenchida)
      if (goal.name && goal.targetAmount) {
        await api.post('/goals', {
          name: goal.name,
          type: 'savings',
          targetAmount: parseFloat(goal.targetAmount),
          deadline: goal.deadline || undefined
        })
      }

      // Criar orçamentos básicos se tiver renda mensal
      if (monthlyExpense) {
        const expense = parseFloat(monthlyExpense)
        const categories = [
          { category: 'alimentacao', percentage: 0.30 },
          { category: 'transporte', percentage: 0.15 },
          { category: 'moradia', percentage: 0.30 },
          { category: 'lazer', percentage: 0.10 },
          { category: 'outros_despesa', percentage: 0.15 }
        ]

        const now = new Date()
        for (const cat of categories) {
          await api.post('/budget', {
            category: cat.category,
            limit: Math.round(expense * cat.percentage),
            month: now.getMonth() + 1,
            year: now.getFullYear()
          })
        }
      }

      // Salvar no localStorage que o onboarding foi concluído
      localStorage.setItem('onboardingCompleted', 'true')

      onComplete()
    } catch (error) {
      console.error('Erro ao salvar dados:', error)
      alert('Erro ao salvar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '24px',
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: `0 8px 24px ${primaryColor}40`
              }}>
                <Sparkles size={36} color="white" />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: colors.text, marginBottom: '8px' }}>
                Bem-vindo, {userName}!
              </h2>
              <p style={{ color: colors.textSecondary, lineHeight: '1.5' }}>
                Vamos configurar sua conta em poucos passos para você começar a controlar suas finanças.
              </p>
            </div>

            <div style={{
              backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontWeight: '600', color: colors.text, marginBottom: '12px' }}>
                O que vamos configurar:
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px', color: colors.textSecondary }}>
                <li style={{ marginBottom: '8px' }}>Suas contas bancárias</li>
                <li style={{ marginBottom: '8px' }}>Sua primeira meta financeira</li>
                <li style={{ marginBottom: '8px' }}>Orçamento mensal básico</li>
              </ul>
            </div>

            <p style={{ textAlign: 'center', fontSize: '14px', color: colors.textSecondary }}>
              Leva menos de 2 minutos!
            </p>
          </div>
        )

      case 2:
        return (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Wallet size={28} color="#3b82f6" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: colors.text, marginBottom: '8px' }}>
                Adicione suas contas
              </h2>
              <p style={{ color: colors.textSecondary, fontSize: '14px' }}>
                Cadastre suas contas para acompanhar seu saldo total
              </p>
            </div>

            {/* Lista de contas adicionadas */}
            {accounts.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                {accounts.map((acc) => {
                  const typeConfig = accountTypes.find(t => t.value === acc.type)
                  const Icon = typeConfig?.icon || Wallet
                  return (
                    <div key={acc.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: isDark ? colors.border : '#f9fafb',
                      borderRadius: '10px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          backgroundColor: `${typeConfig?.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon size={18} color={typeConfig?.color} />
                        </div>
                        <div>
                          <p style={{ fontWeight: '500', color: colors.text, margin: 0 }}>{acc.name}</p>
                          <p style={{ fontSize: '12px', color: colors.textSecondary, margin: 0 }}>
                            R$ {parseFloat(acc.balance).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAccount(acc.id)}
                        style={{
                          padding: '4px 8px',
                          border: 'none',
                          background: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Formulário de nova conta */}
            <div style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: '12px',
              padding: '16px',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: colors.text }}>
                  Nome da conta
                </label>
                <input
                  type="text"
                  value={currentAccount.name}
                  onChange={(e) => setCurrentAccount({ ...currentAccount, name: e.target.value })}
                  placeholder="Ex: Nubank, Itaú, Carteira"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: colors.text }}>
                  Tipo
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {accountTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.value}
                        onClick={() => setCurrentAccount({ ...currentAccount, type: type.value })}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: currentAccount.type === type.value ? `2px solid ${type.color}` : `1px solid ${colors.border}`,
                          backgroundColor: currentAccount.type === type.value ? `${type.color}15` : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          color: currentAccount.type === type.value ? type.color : colors.textSecondary
                        }}
                      >
                        <Icon size={16} />
                        {type.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: colors.text }}>
                  Saldo atual (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={currentAccount.balance}
                  onChange={(e) => setCurrentAccount({ ...currentAccount, balance: e.target.value })}
                  placeholder="0,00"
                  style={inputStyle}
                />
              </div>

              <button
                onClick={handleAddAccount}
                disabled={!currentAccount.name || !currentAccount.balance}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: (!currentAccount.name || !currentAccount.balance) ? colors.border : primaryColor,
                  color: 'white',
                  fontWeight: '500',
                  cursor: (!currentAccount.name || !currentAccount.balance) ? 'not-allowed' : 'pointer'
                }}
              >
                + Adicionar conta
              </button>
            </div>

            {accounts.length === 0 && (
              <p style={{ textAlign: 'center', fontSize: '13px', color: colors.textSecondary, marginTop: '16px' }}>
                Adicione pelo menos uma conta para continuar
              </p>
            )}
          </div>
        )

      case 3:
        return (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Target size={28} color="#8b5cf6" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: colors.text, marginBottom: '8px' }}>
                Defina sua primeira meta
              </h2>
              <p style={{ color: colors.textSecondary, fontSize: '14px' }}>
                Metas ajudam a manter o foco nos seus objetivos
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: colors.text }}>
                Nome da meta
              </label>
              <input
                type="text"
                value={goal.name}
                onChange={(e) => setGoal({ ...goal, name: e.target.value })}
                placeholder="Ex: Reserva de emergência, Viagem, Carro novo"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: colors.text }}>
                Valor da meta (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={goal.targetAmount}
                onChange={(e) => setGoal({ ...goal, targetAmount: e.target.value })}
                placeholder="10000,00"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: colors.text }}>
                Prazo (opcional)
              </label>
              <input
                type="date"
                value={goal.deadline}
                onChange={(e) => setGoal({ ...goal, deadline: e.target.value })}
                style={inputStyle}
              />
            </div>

            <p style={{ textAlign: 'center', fontSize: '13px', color: colors.textSecondary, marginTop: '20px' }}>
              Você pode pular esta etapa e criar metas depois
            </p>
          </div>
        )

      case 4:
        return (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <PiggyBank size={28} color="#22c55e" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: colors.text, marginBottom: '8px' }}>
                Configure seu orçamento
              </h2>
              <p style={{ color: colors.textSecondary, fontSize: '14px' }}>
                Informe sua média de gastos para criarmos orçamentos iniciais
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: colors.text }}>
                Renda mensal média (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="5000,00"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: colors.text }}>
                Gastos mensais médios (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={monthlyExpense}
                onChange={(e) => setMonthlyExpense(e.target.value)}
                placeholder="4000,00"
                style={inputStyle}
              />
            </div>

            {monthlyExpense && (
              <div style={{
                backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4',
                borderRadius: '12px',
                padding: '16px',
                marginTop: '20px'
              }}>
                <p style={{ fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
                  Orçamentos que serão criados:
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: colors.textSecondary }}>
                  <li>Alimentação: R$ {(parseFloat(monthlyExpense) * 0.30).toFixed(2)}</li>
                  <li>Moradia: R$ {(parseFloat(monthlyExpense) * 0.30).toFixed(2)}</li>
                  <li>Transporte: R$ {(parseFloat(monthlyExpense) * 0.15).toFixed(2)}</li>
                  <li>Lazer: R$ {(parseFloat(monthlyExpense) * 0.10).toFixed(2)}</li>
                  <li>Outros: R$ {(parseFloat(monthlyExpense) * 0.15).toFixed(2)}</li>
                </ul>
              </div>
            )}

            <p style={{ textAlign: 'center', fontSize: '13px', color: colors.textSecondary, marginTop: '20px' }}>
              Você pode ajustar os valores depois
            </p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: '24px',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${colors.border}`
      }}>
        {/* Progress bar */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '8px'
          }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                backgroundColor: i < step ? primaryColor : (isDark ? colors.border : '#e5e7eb'),
                transition: 'background-color 0.3s'
              }} />
            ))}
          </div>
          <p style={{ fontSize: '12px', color: colors.textSecondary, textAlign: 'right' }}>
            Passo {step} de {totalSteps}
          </p>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto'
        }}>
          {renderStep()}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: 'transparent',
                color: colors.textSecondary,
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ChevronLeft size={18} />
              Voltar
            </button>
          ) : (
            <button
              onClick={() => {
                localStorage.setItem('onboardingCompleted', 'true')
                onComplete()
              }}
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'transparent',
                color: colors.textSecondary,
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Pular
            </button>
          )}

          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && accounts.length === 0}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: (step === 2 && accounts.length === 0) ? colors.border : primaryColor,
                color: 'white',
                fontWeight: '500',
                cursor: (step === 2 && accounts.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Continuar
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#22c55e',
                color: 'white',
                fontWeight: '500',
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {loading ? (
                'Salvando...'
              ) : (
                <>
                  <Check size={18} />
                  Finalizar
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
