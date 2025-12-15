const Notification = require('../models/Notification')
const Bill = require('../models/Bill')
const Budget = require('../models/Budget')
const Goal = require('../models/Goal')
const Debt = require('../models/Debt')
const Recurring = require('../models/Recurring')
const Transaction = require('../models/Transaction')

/**
 * Gera notificações inteligentes para um usuário
 * @param {ObjectId} userId - ID do usuário
 * @returns {Object} - Resumo das notificações geradas
 */
async function generateSmartNotifications(userId) {
  const results = {
    bills: 0,
    budgets: 0,
    goals: 0,
    debts: 0,
    recurring: 0
  }

  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()

  // 1. Contas a vencer nos próximos 3 dias
  try {
    const bills = await Bill.find({
      user: userId,
      isPaid: false,
      currentMonth: currentMonth,
      currentYear: currentYear
    })

    for (const bill of bills) {
      const daysUntilDue = bill.dueDay - currentDay

      // Verifica se já existe notificação recente para esta conta
      const existingNotif = await Notification.findOne({
        user: userId,
        relatedModel: 'Bill',
        relatedId: bill._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24h
      })

      if (!existingNotif) {
        let title, message, type

        if (daysUntilDue < 0) {
          title = 'Conta Atrasada!'
          message = `A conta "${bill.name}" de R$ ${bill.amount.toFixed(2)} está atrasada há ${Math.abs(daysUntilDue)} dia(s).`
          type = 'alert'
        } else if (daysUntilDue === 0) {
          title = 'Conta vence hoje!'
          message = `A conta "${bill.name}" de R$ ${bill.amount.toFixed(2)} vence hoje.`
          type = 'warning'
        } else if (daysUntilDue <= 3) {
          title = 'Conta a vencer'
          message = `A conta "${bill.name}" de R$ ${bill.amount.toFixed(2)} vence em ${daysUntilDue} dia(s).`
          type = 'info'
        }

        if (title) {
          await Notification.create({
            user: userId,
            title,
            message,
            type,
            relatedModel: 'Bill',
            relatedId: bill._id
          })
          results.bills++
        }
      }
    }
  } catch (error) {
    console.error('Erro ao gerar notificações de bills:', error)
  }

  // 2. Orçamentos quase no limite (acima de 80%)
  try {
    const budgets = await Budget.find({
      user: userId,
      month: currentMonth,
      year: currentYear
    })

    for (const budget of budgets) {
      // Calcular gasto atual na categoria
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1)
      const endOfMonth = new Date(currentYear, currentMonth, 0)

      const spent = await Transaction.aggregate([
        {
          $match: {
            user: userId,
            type: 'expense',
            category: budget.category,
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: { _id: null, total: { $sum: '$amount' } }
        }
      ])

      const totalSpent = spent[0]?.total || 0
      const percentage = (totalSpent / budget.limit) * 100

      const existingNotif = await Notification.findOne({
        user: userId,
        relatedModel: 'Budget',
        relatedId: budget._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })

      if (!existingNotif) {
        let title, message, type

        if (percentage >= 100) {
          title = 'Orçamento estourado!'
          message = `O orçamento de "${budget.category}" foi excedido em ${(percentage - 100).toFixed(0)}%.`
          type = 'alert'
        } else if (percentage >= 90) {
          title = 'Orçamento crítico!'
          message = `O orçamento de "${budget.category}" está em ${percentage.toFixed(0)}%. Restam R$ ${(budget.limit - totalSpent).toFixed(2)}.`
          type = 'warning'
        } else if (percentage >= 80) {
          title = 'Atenção ao orçamento'
          message = `O orçamento de "${budget.category}" está em ${percentage.toFixed(0)}% do limite.`
          type = 'info'
        }

        if (title) {
          await Notification.create({
            user: userId,
            title,
            message,
            type,
            relatedModel: 'Budget',
            relatedId: budget._id
          })
          results.budgets++
        }
      }
    }
  } catch (error) {
    console.error('Erro ao gerar notificações de budgets:', error)
  }

  // 3. Metas próximas de completar (acima de 90%)
  try {
    const goals = await Goal.find({
      user: userId,
      status: 'active'
    })

    for (const goal of goals) {
      const progress = (goal.currentAmount / goal.targetAmount) * 100

      const existingNotif = await Notification.findOne({
        user: userId,
        relatedModel: 'Goal',
        relatedId: goal._id,
        createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } // 48h
      })

      if (!existingNotif) {
        let title, message, type

        if (progress >= 100) {
          title = 'Meta alcançada!'
          message = `Parabéns! Você alcançou a meta "${goal.name}" de R$ ${goal.targetAmount.toFixed(2)}.`
          type = 'success'
        } else if (progress >= 90) {
          title = 'Meta quase completa!'
          message = `A meta "${goal.name}" está em ${progress.toFixed(0)}%. Faltam R$ ${(goal.targetAmount - goal.currentAmount).toFixed(2)}.`
          type = 'info'
        }

        // Verificar deadline
        if (goal.deadline) {
          const daysToDeadline = Math.ceil((new Date(goal.deadline) - today) / (1000 * 60 * 60 * 24))
          if (daysToDeadline <= 7 && daysToDeadline > 0 && progress < 100) {
            title = 'Meta com prazo próximo'
            message = `A meta "${goal.name}" tem prazo em ${daysToDeadline} dias e está em ${progress.toFixed(0)}%.`
            type = 'warning'
          } else if (daysToDeadline <= 0 && progress < 100) {
            title = 'Prazo da meta expirado'
            message = `O prazo da meta "${goal.name}" expirou. Progresso: ${progress.toFixed(0)}%.`
            type = 'alert'
          }
        }

        if (title) {
          await Notification.create({
            user: userId,
            title,
            message,
            type,
            relatedModel: 'Goal',
            relatedId: goal._id
          })
          results.goals++
        }
      }
    }
  } catch (error) {
    console.error('Erro ao gerar notificações de goals:', error)
  }

  // 4. Dívidas com pagamento próximo
  try {
    const debts = await Debt.find({
      user: userId,
      status: 'active'
    })

    for (const debt of debts) {
      if (!debt.dueDay) continue

      const daysUntilDue = debt.dueDay - currentDay

      const existingNotif = await Notification.findOne({
        user: userId,
        relatedModel: 'Debt',
        relatedId: debt._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })

      if (!existingNotif && daysUntilDue >= 0 && daysUntilDue <= 3) {
        let title, message, type

        if (daysUntilDue === 0) {
          title = 'Parcela vence hoje!'
          message = `A parcela de "${debt.name}" de R$ ${(debt.installmentAmount || 0).toFixed(2)} vence hoje.`
          type = 'warning'
        } else {
          title = 'Parcela a vencer'
          message = `A parcela de "${debt.name}" de R$ ${(debt.installmentAmount || 0).toFixed(2)} vence em ${daysUntilDue} dia(s).`
          type = 'info'
        }

        await Notification.create({
          user: userId,
          title,
          message,
          type,
          relatedModel: 'Debt',
          relatedId: debt._id
        })
        results.debts++
      }
    }
  } catch (error) {
    console.error('Erro ao gerar notificações de debts:', error)
  }

  // 5. Recorrências próximas (notificar conforme configurado)
  try {
    const recurring = await Recurring.find({
      user: userId,
      isActive: true,
      notifyDaysBefore: { $gt: 0 }
    })

    for (const rec of recurring) {
      if (!rec.nextDueDate) continue

      const daysUntilDue = Math.ceil((new Date(rec.nextDueDate) - today) / (1000 * 60 * 60 * 24))

      const existingNotif = await Notification.findOne({
        user: userId,
        relatedModel: 'Recurring',
        relatedId: rec._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })

      if (!existingNotif && daysUntilDue >= 0 && daysUntilDue <= rec.notifyDaysBefore) {
        const typeLabel = rec.type === 'income' ? 'Receita' : 'Despesa'

        await Notification.create({
          user: userId,
          title: `${typeLabel} recorrente próxima`,
          message: `"${rec.name}" de R$ ${rec.amount.toFixed(2)} vence em ${daysUntilDue} dia(s).`,
          type: rec.type === 'expense' ? 'warning' : 'info',
          relatedModel: 'Recurring',
          relatedId: rec._id
        })
        results.recurring++
      }
    }
  } catch (error) {
    console.error('Erro ao gerar notificações de recurring:', error)
  }

  return results
}

/**
 * Gera um resumo financeiro diário
 */
async function generateDailySummary(userId) {
  const today = new Date()
  const startOfDay = new Date(today.setHours(0, 0, 0, 0))
  const endOfDay = new Date(today.setHours(23, 59, 59, 999))

  // Transações do dia
  const todayTransactions = await Transaction.find({
    user: userId,
    date: { $gte: startOfDay, $lte: endOfDay }
  })

  const income = todayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expense = todayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

  if (todayTransactions.length > 0) {
    await Notification.create({
      user: userId,
      title: 'Resumo do dia',
      message: `Hoje: ${todayTransactions.length} transações. Receitas: R$ ${income.toFixed(2)}, Despesas: R$ ${expense.toFixed(2)}.`,
      type: 'info'
    })
  }

  return { income, expense, count: todayTransactions.length }
}

module.exports = {
  generateSmartNotifications,
  generateDailySummary
}
