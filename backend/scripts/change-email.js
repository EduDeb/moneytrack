const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://MONEYTRACK:MONEYTRACK123@cluster0.qismttx.mongodb.net/finance-app';

const OLD_EMAIL = 'arqdeboraso@gmail.com';
const NEW_EMAIL = 'edudeb.ia26@gmail.com';

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
