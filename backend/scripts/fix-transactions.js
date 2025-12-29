const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// SEGURANÇA: Usa variável de ambiente em vez de credenciais hardcoded
const MONGODB_URI = process.env.MONGODB_URI;

// Usuário que deve receber as transações órfãs
const TARGET_USER_ID = process.env.TARGET_USER_ID || '693d290f2a47ef4d544f1616';

if (!MONGODB_URI) {
  console.error('ERRO: MONGODB_URI não definida no .env');
  process.exit(1);
}

async function fixTransactions() {
  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado!\n');

    const db = mongoose.connection.db;

    // Contar transações sem userId
    const orphanCount = await db.collection('transactions').countDocuments({
      $or: [
        { userId: { $exists: false } },
        { userId: null },
        { userId: undefined }
      ]
    });
    console.log(`Transações sem usuário: ${orphanCount}`);

    if (orphanCount > 0) {
      // Vincular todas as transações órfãs ao usuário alvo
      const result = await db.collection('transactions').updateMany(
        {
          $or: [
            { userId: { $exists: false } },
            { userId: null }
          ]
        },
        { $set: { userId: TARGET_USER_ID } }
      );
      console.log(`\nTransações vinculadas ao usuário Eduardo: ${result.modifiedCount}`);
    }

    // Fazer o mesmo para outras coleções (accounts, recurring, etc.)
    const collections = ['accounts', 'recurring', 'categories', 'investments', 'debts', 'goals'];

    for (const collName of collections) {
      const coll = db.collection(collName);
      const count = await coll.countDocuments({
        $or: [
          { userId: { $exists: false } },
          { userId: null }
        ]
      });

      if (count > 0) {
        const result = await coll.updateMany(
          {
            $or: [
              { userId: { $exists: false } },
              { userId: null }
            ]
          },
          { $set: { userId: TARGET_USER_ID } }
        );
        console.log(`${collName}: ${result.modifiedCount} registros vinculados`);
      }
    }

    console.log('\nDados corrigidos! Agora faça logout e login novamente no app.');

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

fixTransactions();
