const mongoose = require('mongoose')
require('dotenv').config()

const transactionSchema = new mongoose.Schema({
  user: mongoose.Schema.Types.ObjectId,
  type: String,
  category: String,
  description: String,
  amount: Number,
  date: Date
}, { collection: 'transactions' })

const Transaction = mongoose.model('Transaction', transactionSchema)

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  const userSchema = new mongoose.Schema({}, { collection: 'users', strict: false })
  const User = mongoose.model('User', userSchema)
  const user = await User.findOne({ email: 'arqdeboraso@gmail.com' })
  
  const transactions = await Transaction.find({ user: user._id }).sort({ date: -1 })
  
  console.log('=== VERIFICAÇÃO DE CATEGORIAS ===\n')
  
  let issues = []
  
  for (const t of transactions) {
    const descLower = t.description.toLowerCase()
    
    // Verificar Bernardo - colegio/escola/futebol bernardo devem estar em Bernardo
    if ((descLower.includes('bernardo') || 
         descLower.includes('colegio') || 
         descLower.includes('escola')) && 
        t.category !== 'Bernardo') {
      issues.push({
        date: t.date.toISOString().split('T')[0],
        description: t.description,
        currentCat: t.category,
        shouldBe: 'Bernardo',
        id: t._id.toString()
      })
    }
  }
  
  if (issues.length === 0) {
    console.log('Nenhum problema de categoria encontrado!')
  } else {
    console.log('Problemas encontrados:\n')
    issues.forEach(i => {
      console.log('Data: ' + i.date)
      console.log('Descrição: ' + i.description)
      console.log('Categoria atual: ' + i.currentCat)
      console.log('Deveria ser: ' + i.shouldBe)
      console.log('ID: ' + i.id)
      console.log('---')
    })
  }
  
  await mongoose.disconnect()
}

main().catch(console.error)
