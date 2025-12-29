const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// SEGURANÇA: Usa variável de ambiente em vez de credenciais hardcoded
const MONGODB_URI = process.env.MONGODB_URI;

// Emails podem ser passados por variável de ambiente ou definidos aqui
const OLD_EMAIL = process.env.OLD_EMAIL || 'email_antigo@example.com';
const NEW_EMAIL = process.env.NEW_EMAIL || 'email_novo@example.com';

if (!MONGODB_URI) {
  console.error('ERRO: MONGODB_URI não definida no .env');
  process.exit(1);
}

async function changeEmail() {
  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado!');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Verificar se o email antigo existe
    const oldUser = await usersCollection.findOne({ email: OLD_EMAIL });
    if (!oldUser) {
      console.log(`Email ${OLD_EMAIL} não encontrado!`);
      process.exit(1);
    }
    console.log(`Usuário encontrado: ${oldUser.name}`);

    // Verificar se o novo email já existe
    const newEmailExists = await usersCollection.findOne({ email: NEW_EMAIL });
    if (newEmailExists) {
      console.log(`Email ${NEW_EMAIL} já está em uso por outro usuário!`);
      process.exit(1);
    }

    // Atualizar o email
    const result = await usersCollection.updateOne(
      { email: OLD_EMAIL },
      { $set: { email: NEW_EMAIL } }
    );

    if (result.modifiedCount === 1) {
      console.log(`\nSucesso! Email alterado de ${OLD_EMAIL} para ${NEW_EMAIL}`);
      console.log('Todos os dados e lançamentos foram mantidos.');
    } else {
      console.log('Erro ao atualizar email');
    }

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado do MongoDB');
  }
}

changeEmail();
