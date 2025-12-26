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

// Mapeamento de categorias para padronizar (Case-Sensitive)
const CATEGORY_MAP = {
  // Minúsculo para Título
  'alimentacao': 'Alimentação',
  'alimentação': 'Alimentação',
  'colaboradores': 'Colaboradores',
  'moradia': 'Moradia',
  'manutencao': 'Manutenção',
  'manutenção': 'Manutenção',
  'saude': 'Saúde',
  'salario': 'Salário',
  'salário': 'Salário',
  'contas': 'Contas',
  'outros': 'Outros',
  'outros_despesa': 'Outros',
  'transporte': 'Colaboradores',
  'imposto': 'Outros',
  'pets': 'Outros',
  'lazer': 'Lazer',
  'mercado': 'Mercado',
  'educacao': 'Educação',
  'receita': 'Receita',
  'bernardo': 'Bernardo',
  'compras': 'Compras',
  'aluguel_recebido': 'Aluguel Recebido'
}

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('Conectado ao MongoDB')

  const userSchema = new mongoose.Schema({}, { collection: 'users', strict: false })
  const User = mongoose.model('User', userSchema)
  const user = await User.findOne({ email: 'arqdeboraso@gmail.com' })

  if (!user) {
    console.log('Nenhum usuário encontrado')
    process.exit(1)
  }

  console.log('Usuário:', user.email)
  console.log('\n')

  // Buscar TODAS as transações do usuário
  const transactions = await Transaction.find({ user: user._id })

  console.log('Total de transações:', transactions.length, '\n')

  let updates = 0
  
  for (const t of transactions) {
    const categoryLower = t.category.toLowerCase()
    
    // Verificar se precisa atualizar
    if (CATEGORY_MAP[categoryLower] && t.category !== CATEGORY_MAP[categoryLower]) {
      console.log('[' + t.date.toISOString().split('T')[0] + '] ' + t.description + ': "' + t.category + '" -> "' + CATEGORY_MAP[categoryLower] + '"')
      await Transaction.updateOne({ _id: t._id }, { $set: { category: CATEGORY_MAP[categoryLower] } })
      updates++
    }
  }

  console.log('\n=== RESUMO ===')
  console.log('Categorias atualizadas:', updates)

  await mongoose.disconnect()
  console.log('Desconectado do MongoDB')
}

main().catch(console.error)
