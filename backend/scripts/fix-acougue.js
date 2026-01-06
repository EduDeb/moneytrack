require('dotenv').config()
const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI
const ACOUGUE_RECURRING_ID = '694a66d113c07a058a89460c'
const TARGET_MONTH = 1
const TARGET_YEAR = 2026

async function fixAcougue() {
  try {
    console.log('Conectando ao MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('Conectado!\n')

    // Definir schemas simplificados
    const RecurringPaymentSchema = new mongoose.Schema({
      user: mongoose.Schema.Types.ObjectId,
      recurring: mongoose.Schema.Types.ObjectId,
      month: Number,
      year: Number,
      dueDay: Number,
      transaction: mongoose.Schema.Types.ObjectId,
      amountPaid: Number,
      paidAt: Date
    })

    const RecurringOverrideSchema = new mongoose.Schema({
      user: mongoose.Schema.Types.ObjectId,
      recurring: mongoose.Schema.Types.ObjectId,
      month: Number,
      year: Number,
      type: String,
      amount: Number,
      originalAmount: Number,
      notes: String
    })

    const TransactionSchema = new mongoose.Schema({
      user: mongoose.Schema.Types.ObjectId,
      recurringId: mongoose.Schema.Types.ObjectId,
      description: String,
      amount: Number,
      date: Date
    })

    const RecurringSchema = new mongoose.Schema({
      user: mongoose.Schema.Types.ObjectId,
      name: String,
      frequency: String,
      amount: Number
    })

    const RecurringPayment = mongoose.model('RecurringPayment', RecurringPaymentSchema)
    const RecurringOverride = mongoose.model('RecurringOverride', RecurringOverrideSchema)
    const Transaction = mongoose.model('Transaction', TransactionSchema)
    const Recurring = mongoose.model('Recurring', RecurringSchema)

    // Buscar a recorrência para confirmar
    const recurring = await Recurring.findById(ACOUGUE_RECURRING_ID)
    if (recurring) {
      console.log(`Recorrência encontrada: ${recurring.name}`)
      console.log(`Frequência: ${recurring.frequency}`)
      console.log(`Valor: R$ ${recurring.amount}\n`)
    } else {
      console.log('Recorrência não encontrada com esse ID\n')
    }

    // Buscar pagamentos
    const payments = await RecurringPayment.find({
      recurring: ACOUGUE_RECURRING_ID,
      month: TARGET_MONTH,
      year: TARGET_YEAR
    })
    console.log(`Pagamentos encontrados para ${TARGET_MONTH}/${TARGET_YEAR}: ${payments.length}`)

    // Deletar pagamentos e transações associadas
    for (const payment of payments) {
      console.log(`  - Deletando pagamento: dueDay=${payment.dueDay}, valor=${payment.amountPaid}`)
      if (payment.transaction) {
        await Transaction.findByIdAndDelete(payment.transaction)
        console.log(`    Transação ${payment.transaction} deletada`)
      }
      await RecurringPayment.findByIdAndDelete(payment._id)
    }

    // Buscar e deletar overrides existentes
    const overrides = await RecurringOverride.find({
      recurring: ACOUGUE_RECURRING_ID,
      month: TARGET_MONTH,
      year: TARGET_YEAR
    })
    console.log(`\nOverrides encontrados: ${overrides.length}`)

    for (const override of overrides) {
      console.log(`  - Deletando override: type=${override.type}`)
      await RecurringOverride.findByIdAndDelete(override._id)
    }

    // Buscar user ID da recorrência
    if (recurring) {
      // Criar override de skip para esconder este mês
      const skipOverride = await RecurringOverride.create({
        user: recurring.user,
        recurring: ACOUGUE_RECURRING_ID,
        month: TARGET_MONTH,
        year: TARGET_YEAR,
        type: 'skip',
        originalAmount: recurring.amount,
        amount: 0,
        notes: 'Removido via script de correção'
      })
      console.log(`\nOverride de skip criado: ${skipOverride._id}`)
    }

    console.log('\n✅ AÇOUGUE REMOVIDO DE JANEIRO/2026!')
    console.log('Atualize a página do app para ver as mudanças.')

  } catch (error) {
    console.error('ERRO:', error.message)
  } finally {
    await mongoose.disconnect()
    console.log('\nDesconectado do MongoDB.')
  }
}

fixAcougue()
