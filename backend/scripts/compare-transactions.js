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

  // Buscar transações de Dezembro 2025
  const dec2025Start = new Date(Date.UTC(2025, 11, 1))
  const dec2025End = new Date(Date.UTC(2025, 11, 31, 23, 59, 59))

  const decTransactions = await Transaction.find({
    user: user._id,
    date: { $gte: dec2025Start, $lte: dec2025End }
  }).sort({ category: 1, description: 1 })

  console.log('=== DEZEMBRO 2025 ===')
  console.log(`Total: ${decTransactions.length} transações\n`)

  // Agrupar por categoria
  const decByCategory = {}
  decTransactions.forEach(t => {
    if (!decByCategory[t.category]) decByCategory[t.category] = []
    decByCategory[t.category].push({
      id: t._id.toString(),
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: t.date.toISOString().split('T')[0]
    })
  })

  console.log('Categorias em Dezembro:')
  Object.keys(decByCategory).sort().forEach(cat => {
    console.log(`  ${cat}: ${decByCategory[cat].length} transações`)
  })
  console.log('\nDetalhes por categoria:')
  Object.keys(decByCategory).sort().forEach(cat => {
    console.log(`\n[${cat}]`)
    decByCategory[cat].forEach(t => {
      console.log(`  - ${t.description} | R$ ${t.amount.toFixed(2)} | ${t.date}`)
    })
  })

  // Buscar transações de Novembro 2025
  const nov2025Start = new Date(Date.UTC(2025, 10, 1))
  const nov2025End = new Date(Date.UTC(2025, 10, 30, 23, 59, 59))

  const novTransactions = await Transaction.find({
    user: user._id,
    date: { $gte: nov2025Start, $lte: nov2025End }
  }).sort({ category: 1, description: 1 })

  console.log('\n\n=== NOVEMBRO 2025 ===')
  console.log(`Total: ${novTransactions.length} transações\n`)

  const novByCategory = {}
  novTransactions.forEach(t => {
    if (!novByCategory[t.category]) novByCategory[t.category] = []
    novByCategory[t.category].push({
      id: t._id.toString(),
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: t.date.toISOString().split('T')[0]
    })
  })

  console.log('Categorias em Novembro:')
  Object.keys(novByCategory).sort().forEach(cat => {
    console.log(`  ${cat}: ${novByCategory[cat].length} transações`)
  })
  console.log('\nDetalhes por categoria:')
  Object.keys(novByCategory).sort().forEach(cat => {
    console.log(`\n[${cat}]`)
    novByCategory[cat].forEach(t => {
      console.log(`  - ${t.description} | R$ ${t.amount.toFixed(2)} | ${t.date} | ID: ${t.id}`)
    })
  })

  // Buscar transações de Outubro 2025
  const oct2025Start = new Date(Date.UTC(2025, 9, 1))
  const oct2025End = new Date(Date.UTC(2025, 9, 31, 23, 59, 59))

  const octTransactions = await Transaction.find({
    user: user._id,
    date: { $gte: oct2025Start, $lte: oct2025End }
  }).sort({ category: 1, description: 1 })

  console.log('\n\n=== OUTUBRO 2025 ===')
  console.log(`Total: ${octTransactions.length} transações\n`)

  const octByCategory = {}
  octTransactions.forEach(t => {
    if (!octByCategory[t.category]) octByCategory[t.category] = []
    octByCategory[t.category].push({
      id: t._id.toString(),
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: t.date.toISOString().split('T')[0]
    })
  })

  console.log('Categorias em Outubro:')
  Object.keys(octByCategory).sort().forEach(cat => {
    console.log(`  ${cat}: ${octByCategory[cat].length} transações`)
  })
  console.log('\nDetalhes por categoria:')
  Object.keys(octByCategory).sort().forEach(cat => {
    console.log(`\n[${cat}]`)
    octByCategory[cat].forEach(t => {
      console.log(`  - ${t.description} | R$ ${t.amount.toFixed(2)} | ${t.date} | ID: ${t.id}`)
    })
  })

  // Comparar categorias
  console.log('\n\n=== COMPARAÇÃO DE CATEGORIAS ===')
  const allCategories = new Set([
    ...Object.keys(decByCategory),
    ...Object.keys(novByCategory),
    ...Object.keys(octByCategory)
  ])

  console.log('\nCategoria | Dezembro | Novembro | Outubro')
  console.log('-'.repeat(50))
  Array.from(allCategories).sort().forEach(cat => {
    const decCount = decByCategory[cat]?.length || 0
    const novCount = novByCategory[cat]?.length || 0
    const octCount = octByCategory[cat]?.length || 0
    console.log(`${cat.padEnd(20)} | ${String(decCount).padStart(8)} | ${String(novCount).padStart(8)} | ${String(octCount).padStart(7)}`)
  })

  await mongoose.disconnect()
}

main().catch(console.error)
