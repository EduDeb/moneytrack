const mongoose = require('mongoose')
require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI

// Schema simplificado
const transactionSchema = new mongoose.Schema({
  user: mongoose.Schema.Types.ObjectId,
  type: String,
  category: String,
  description: String,
  amount: Number,
  date: Date
}, { collection: 'transactions' })

const Transaction = mongoose.model('Transaction', transactionSchema)

// Mapeamento de categorias (de -> para)
const CATEGORY_MAP = {
  'bernardo': 'Bernardo',
  'saude': 'Saúde',
  'colaboradores': 'Colaboradores',
  'educacao': 'Educação',
  'outros_despesa': 'Outros',
  'transporte': 'Colaboradores',
  'imposto': 'Outros',
  'pets': 'Outros',
  'lazer': 'Lazer',
  'mercado': 'Mercado',
  'moradia': 'Moradia',
  'alimentacao': 'Alimentação',
  'alimentação': 'Alimentação',
  'receita': 'Receita',
  'salario': 'Receita'
}

// Mapeamento de descrições (de -> para)
const DESCRIPTION_MAP = {
  'caem': 'Camed',
  'camed': 'Camed',
  'CAMED': 'Camed',
  'telnet': 'Texnet ( INTERNET )',
  'Telnet': 'Texnet ( INTERNET )',
  'Escola Bernardo': 'Colegio Bernardo',
  'escola bernardo': 'Colegio Bernardo',
  'Escola bernardo': 'Colegio Bernardo'
}

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('Conectado ao MongoDB')

  // Buscar o usuário Eduardo
  const userSchema = new mongoose.Schema({}, { collection: 'users', strict: false })
  const User = mongoose.model('User', userSchema)
  const user = await User.findOne({ email: 'arqdeboraso@gmail.com' })

  if (!user) {
    console.log('Nenhum usuário encontrado')
    process.exit(1)
  }

  console.log('Usuário:', user.email)
  console.log('ID:', user._id)
  console.log('\n')

  // Períodos de Out e Nov 2025
  const oct2025Start = new Date(Date.UTC(2025, 9, 1))
  const nov2025End = new Date(Date.UTC(2025, 10, 30, 23, 59, 59))

  // Buscar transações de Outubro e Novembro
  const transactions = await Transaction.find({
    user: user._id,
    date: { $gte: oct2025Start, $lte: nov2025End }
  })

  console.log('Total de transações para processar:', transactions.length, '\n')

  let categoryUpdates = 0
  let descriptionUpdates = 0
  let errors = []

  for (const t of transactions) {
    const updates = {}

    // 1. Verificar categoria
    const categoryLower = t.category.toLowerCase()
    if (CATEGORY_MAP[categoryLower] && t.category !== CATEGORY_MAP[categoryLower]) {
      updates.category = CATEGORY_MAP[categoryLower]
      console.log('[CAT] ' + t.description + ': "' + t.category + '" -> "' + updates.category + '"')
      categoryUpdates++
    }

    // 2. Verificar descrição
    const descriptionLower = t.description.toLowerCase()
    for (const [oldDesc, newDesc] of Object.entries(DESCRIPTION_MAP)) {
      if (descriptionLower === oldDesc.toLowerCase() && t.description !== newDesc) {
        updates.description = newDesc
        console.log('[DESC] "' + t.description + '" -> "' + updates.description + '"')
        descriptionUpdates++
        break
      }
    }

    // 3. Aplicar atualizações se houver
    if (Object.keys(updates).length > 0) {
      try {
        await Transaction.updateOne({ _id: t._id }, { $set: updates })
      } catch (err) {
        errors.push({ id: t._id, error: err.message })
      }
    }
  }

  console.log('\n=== RESUMO ===')
  console.log('Categorias atualizadas:', categoryUpdates)
  console.log('Descrições atualizadas:', descriptionUpdates)
  if (errors.length > 0) {
    console.log('Erros:', errors.length)
    errors.forEach(e => console.log('  - ' + e.id + ': ' + e.error))
  }

  await mongoose.disconnect()
  console.log('\nDesconectado do MongoDB')
}

main().catch(console.error)
