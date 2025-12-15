const nodemailer = require('nodemailer')
const Notification = require('../models/Notification')
const Settings = require('../models/Settings')
const User = require('../models/User')

/**
 * Serviço de Notificações
 * Gerencia envio de emails, push notifications e notificações in-app
 */

// Configuração do transporter de email
let emailTransporter = null

const initializeEmailTransporter = () => {
  if (!emailTransporter && process.env.SMTP_HOST) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }
  return emailTransporter
}

// Templates de email
const emailTemplates = {
  billReminder: (data) => ({
    subject: `Lembrete: ${data.billName} vence em ${data.daysUntilDue} dias`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">MoneyTrack</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b;">Lembrete de Conta</h2>
          <p style="color: #64748b; font-size: 16px;">
            Olá! Esta é um lembrete de que a conta <strong>${data.billName}</strong> vence em
            <strong>${data.daysUntilDue} dia(s)</strong>.
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
            <p style="margin: 0; color: #1e293b;"><strong>Conta:</strong> ${data.billName}</p>
            <p style="margin: 10px 0 0; color: #1e293b;"><strong>Valor:</strong> R$ ${data.amount.toFixed(2)}</p>
            <p style="margin: 10px 0 0; color: #1e293b;"><strong>Vencimento:</strong> ${new Date(data.dueDate).toLocaleDateString('pt-BR')}</p>
          </div>
          <a href="${process.env.FRONTEND_URL}/bills"
             style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px;">
            Ver Contas
          </a>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
          Você recebeu este email porque ativou as notificações no MoneyTrack.
        </p>
      </div>
    `
  }),

  budgetAlert: (data) => ({
    subject: `Alerta: Orçamento de ${data.category} atingiu ${data.percentage}%`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">MoneyTrack</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b;">Alerta de Orçamento</h2>
          <p style="color: #64748b; font-size: 16px;">
            Seu orçamento de <strong>${data.category}</strong> já atingiu ${data.percentage}% do limite.
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0; color: #1e293b;"><strong>Categoria:</strong> ${data.category}</p>
            <p style="margin: 10px 0 0; color: #1e293b;"><strong>Gasto:</strong> R$ ${data.spent.toFixed(2)}</p>
            <p style="margin: 10px 0 0; color: #1e293b;"><strong>Limite:</strong> R$ ${data.budgetAmount.toFixed(2)}</p>
            <div style="background: #f1f5f9; border-radius: 4px; height: 10px; margin-top: 15px; overflow: hidden;">
              <div style="background: ${data.percentage >= 90 ? '#ef4444' : '#f59e0b'}; height: 100%; width: ${Math.min(data.percentage, 100)}%;"></div>
            </div>
          </div>
          <a href="${process.env.FRONTEND_URL}/budget"
             style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px;">
            Ver Orçamentos
          </a>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
          Você recebeu este email porque ativou os alertas de orçamento no MoneyTrack.
        </p>
      </div>
    `
  }),

  goalAlert: (data) => ({
    subject: `${data.type === 'reached' ? 'Parabéns! Meta alcançada' : 'Atualização de Meta'}: ${data.goalName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">MoneyTrack</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b;">${data.type === 'reached' ? 'Meta Alcançada!' : 'Progresso de Meta'}</h2>
          <p style="color: #64748b; font-size: 16px;">
            ${data.type === 'reached'
              ? `Parabéns! Você alcançou sua meta "${data.goalName}"!`
              : `Sua meta "${data.goalName}" atingiu ${data.percentage}% do objetivo.`}
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="margin: 0; color: #1e293b;"><strong>Meta:</strong> ${data.goalName}</p>
            <p style="margin: 10px 0 0; color: #1e293b;"><strong>Atual:</strong> R$ ${data.currentAmount.toFixed(2)}</p>
            <p style="margin: 10px 0 0; color: #1e293b;"><strong>Objetivo:</strong> R$ ${data.targetAmount.toFixed(2)}</p>
            <div style="background: #f1f5f9; border-radius: 4px; height: 10px; margin-top: 15px; overflow: hidden;">
              <div style="background: #10b981; height: 100%; width: ${Math.min(data.percentage, 100)}%;"></div>
            </div>
          </div>
          <a href="${process.env.FRONTEND_URL}/goals"
             style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px;">
            Ver Metas
          </a>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
          Você recebeu este email porque ativou os alertas de metas no MoneyTrack.
        </p>
      </div>
    `
  }),

  weeklyReport: (data) => ({
    subject: `Relatório Semanal MoneyTrack - ${data.weekRange}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">MoneyTrack</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0;">Relatório Semanal</p>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b;">Resumo da Semana</h2>
          <div style="display: grid; gap: 15px; margin: 20px 0;">
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="color: #64748b; margin: 0; font-size: 14px;">Receitas</p>
              <p style="color: #10b981; margin: 5px 0 0; font-size: 24px; font-weight: bold;">R$ ${data.income.toFixed(2)}</p>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="color: #64748b; margin: 0; font-size: 14px;">Despesas</p>
              <p style="color: #ef4444; margin: 5px 0 0; font-size: 24px; font-weight: bold;">R$ ${data.expenses.toFixed(2)}</p>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #3b82f6;">
              <p style="color: #64748b; margin: 0; font-size: 14px;">Saldo</p>
              <p style="color: ${data.balance >= 0 ? '#10b981' : '#ef4444'}; margin: 5px 0 0; font-size: 24px; font-weight: bold;">
                R$ ${data.balance.toFixed(2)}
              </p>
            </div>
          </div>
          ${data.topCategories.length > 0 ? `
            <h3 style="color: #1e293b; margin-top: 25px;">Principais Gastos</h3>
            <ul style="padding: 0; list-style: none;">
              ${data.topCategories.map(cat => `
                <li style="background: white; padding: 10px 15px; margin: 5px 0; border-radius: 6px; display: flex; justify-content: space-between;">
                  <span>${cat.name}</span>
                  <strong>R$ ${cat.amount.toFixed(2)}</strong>
                </li>
              `).join('')}
            </ul>
          ` : ''}
          <a href="${process.env.FRONTEND_URL}/reports"
             style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px;">
            Ver Relatório Completo
          </a>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
          Você recebeu este email porque ativou o relatório semanal no MoneyTrack.
        </p>
      </div>
    `
  }),

  monthlyReport: (data) => ({
    subject: `Relatório Mensal MoneyTrack - ${data.monthName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">MoneyTrack</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0;">Relatório Mensal - ${data.monthName}</p>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b;">Resumo do Mês</h2>
          <div style="display: grid; gap: 15px; margin: 20px 0;">
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="color: #64748b; margin: 0; font-size: 14px;">Total Receitas</p>
              <p style="color: #10b981; margin: 5px 0 0; font-size: 24px; font-weight: bold;">R$ ${data.totalIncome.toFixed(2)}</p>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="color: #64748b; margin: 0; font-size: 14px;">Total Despesas</p>
              <p style="color: #ef4444; margin: 5px 0 0; font-size: 24px; font-weight: bold;">R$ ${data.totalExpenses.toFixed(2)}</p>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #6366f1;">
              <p style="color: #64748b; margin: 0; font-size: 14px;">Economia do Mês</p>
              <p style="color: ${data.savings >= 0 ? '#10b981' : '#ef4444'}; margin: 5px 0 0; font-size: 24px; font-weight: bold;">
                R$ ${data.savings.toFixed(2)}
              </p>
              <p style="color: #64748b; font-size: 12px; margin: 5px 0 0;">
                ${data.savingsPercentage.toFixed(1)}% da receita
              </p>
            </div>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e293b; margin: 0 0 15px;">Comparativo</h3>
            <p style="color: #64748b; margin: 0;">
              ${data.comparisonText}
            </p>
          </div>
          <a href="${process.env.FRONTEND_URL}/reports"
             style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px;">
            Ver Relatório Completo
          </a>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
          Você recebeu este email porque ativou o relatório mensal no MoneyTrack.
        </p>
      </div>
    `
  })
}

/**
 * Enviar email de notificação
 */
const sendEmail = async (to, template, data) => {
  try {
    const transporter = initializeEmailTransporter()

    if (!transporter) {
      console.log('[NOTIFICATION] Email não configurado - pulando envio')
      return { success: false, reason: 'Email not configured' }
    }

    const { subject, html } = template(data)

    const mailOptions = {
      from: `"MoneyTrack" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html
    }

    await transporter.sendMail(mailOptions)
    console.log(`[NOTIFICATION] Email enviado para ${to}: ${subject}`)
    return { success: true }
  } catch (error) {
    console.error('[NOTIFICATION] Erro ao enviar email:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Verificar preferências de notificação do usuário
 */
const getUserNotificationPreferences = async (userId) => {
  try {
    const settings = await Settings.findOne({ user: userId })
    return settings?.notifications || {
      email: true,
      push: true,
      billReminders: true,
      goalAlerts: true,
      weeklyReport: false,
      monthlyReport: false,
      budgetAlerts: true
    }
  } catch (error) {
    console.error('[NOTIFICATION] Erro ao buscar preferências:', error.message)
    return null
  }
}

/**
 * Criar notificação in-app
 */
const createInAppNotification = async (userId, type, title, message, data = {}, priority = 'medium') => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      data,
      priority
    })
    return notification
  } catch (error) {
    console.error('[NOTIFICATION] Erro ao criar notificação:', error.message)
    return null
  }
}

/**
 * Enviar notificação de lembrete de conta
 */
const sendBillReminder = async (userId, billData) => {
  try {
    const prefs = await getUserNotificationPreferences(userId)
    if (!prefs || !prefs.billReminders) return

    const user = await User.findById(userId)
    if (!user) return

    // Notificação in-app
    await createInAppNotification(
      userId,
      'bill_due',
      `Conta vence em ${billData.daysUntilDue} dias`,
      `${billData.billName} - R$ ${billData.amount.toFixed(2)}`,
      billData,
      billData.daysUntilDue <= 1 ? 'high' : 'medium'
    )

    // Email (se habilitado)
    if (prefs.email && user.email) {
      await sendEmail(user.email, emailTemplates.billReminder, billData)
    }

    return { success: true }
  } catch (error) {
    console.error('[NOTIFICATION] Erro em sendBillReminder:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Enviar alerta de orçamento
 */
const sendBudgetAlert = async (userId, budgetData) => {
  try {
    const prefs = await getUserNotificationPreferences(userId)
    if (!prefs || !prefs.budgetAlerts) return

    const user = await User.findById(userId)
    if (!user) return

    // Notificação in-app
    await createInAppNotification(
      userId,
      budgetData.percentage >= 95 ? 'budget_exceeded' : 'budget_warning',
      `Orçamento de ${budgetData.category}`,
      `Você usou ${budgetData.percentage}% do orçamento`,
      budgetData,
      budgetData.percentage >= 95 ? 'high' : 'medium'
    )

    // Email (se habilitado)
    if (prefs.email && user.email) {
      await sendEmail(user.email, emailTemplates.budgetAlert, budgetData)
    }

    return { success: true }
  } catch (error) {
    console.error('[NOTIFICATION] Erro em sendBudgetAlert:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Enviar alerta de meta
 */
const sendGoalAlert = async (userId, goalData) => {
  try {
    const prefs = await getUserNotificationPreferences(userId)
    if (!prefs || !prefs.goalAlerts) return

    const user = await User.findById(userId)
    if (!user) return

    // Notificação in-app
    await createInAppNotification(
      userId,
      'goal_reached',
      goalData.type === 'reached' ? 'Meta alcançada!' : 'Progresso de meta',
      `${goalData.goalName} - ${goalData.percentage}%`,
      goalData,
      goalData.type === 'reached' ? 'high' : 'low'
    )

    // Email (se habilitado)
    if (prefs.email && user.email) {
      await sendEmail(user.email, emailTemplates.goalAlert, goalData)
    }

    return { success: true }
  } catch (error) {
    console.error('[NOTIFICATION] Erro em sendGoalAlert:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Enviar relatório semanal
 */
const sendWeeklyReport = async (userId, reportData) => {
  try {
    const prefs = await getUserNotificationPreferences(userId)
    if (!prefs || !prefs.weeklyReport) return

    const user = await User.findById(userId)
    if (!user || !user.email) return

    if (prefs.email) {
      await sendEmail(user.email, emailTemplates.weeklyReport, reportData)
    }

    return { success: true }
  } catch (error) {
    console.error('[NOTIFICATION] Erro em sendWeeklyReport:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Enviar relatório mensal
 */
const sendMonthlyReport = async (userId, reportData) => {
  try {
    const prefs = await getUserNotificationPreferences(userId)
    if (!prefs || !prefs.monthlyReport) return

    const user = await User.findById(userId)
    if (!user || !user.email) return

    if (prefs.email) {
      await sendEmail(user.email, emailTemplates.monthlyReport, reportData)
    }

    return { success: true }
  } catch (error) {
    console.error('[NOTIFICATION] Erro em sendMonthlyReport:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Testar configuração de email
 */
const testEmailConfiguration = async (toEmail) => {
  try {
    const transporter = initializeEmailTransporter()

    if (!transporter) {
      return { success: false, reason: 'Email não configurado' }
    }

    await transporter.sendMail({
      from: `"MoneyTrack" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: toEmail,
      subject: 'Teste de Configuração - MoneyTrack',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">MoneyTrack</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; text-align: center;">
            <h2 style="color: #10b981;">Configuração OK!</h2>
            <p style="color: #64748b;">Seu email está configurado corretamente para receber notificações do MoneyTrack.</p>
          </div>
        </div>
      `
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

module.exports = {
  sendEmail,
  sendBillReminder,
  sendBudgetAlert,
  sendGoalAlert,
  sendWeeklyReport,
  sendMonthlyReport,
  createInAppNotification,
  getUserNotificationPreferences,
  testEmailConfiguration,
  emailTemplates
}
