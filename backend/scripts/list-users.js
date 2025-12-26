const mongoose = require('mongoose')
require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('Conectado ao MongoDB')

  const userSchema = new mongoose.Schema({}, { collection: 'users', strict: false })
  const User = mongoose.model('User', userSchema)

  const users = await User.find({})

  console.log(`\nTotal de usuários: ${users.length}\n`)

  for (const user of users) {
    console.log(`ID: ${user._id}`)
    console.log(`Nome: ${user.name}`)
    console.log(`Email: ${user.email}`)
    console.log('---')
  }

  await mongoose.disconnect()
}

main().catch(console.error)
