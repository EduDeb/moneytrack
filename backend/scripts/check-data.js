const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// SEGURANÇA: Usa variável de ambiente em vez de credenciais hardcoded
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERRO: MONGODB_URI não definida no .env');
  process.exit(1);
}

async function checkData() {
  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado!\n');

    const db = mongoose.connection.db;

    // Listar usuários
    console.log('=== USUÁRIOS ===');
    const users = await db.collection('users').find({}).toArray();
    users.forEach(u => {
      console.log(`- ${u.name} | ${u.email} | ID: ${u._id}`);
    });

    // Verificar transações por usuário
    console.log('\n=== TRANSAÇÕES POR USUÁRIO ===');
    for (const user of users) {
      const count = await db.collection('transactions').countDocuments({ userId: user._id.toString() });
      const countObj = await db.collection('transactions').countDocuments({ userId: user._id });
      console.log(`${user.email}: ${count} transações (string) / ${countObj} transações (ObjectId)`);
    }

    // Verificar todas as transações
    console.log('\n=== AMOSTRA DE TRANSAÇÕES ===');
    const transactions = await db.collection('transactions').find({}).limit(5).toArray();
    transactions.forEach(t => {
      console.log(`- ${t.description} | userId: ${t.userId} (tipo: ${typeof t.userId})`);
    });

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkData();
