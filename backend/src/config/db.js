const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Tentativa ${i + 1} de conexão ao MongoDB...`);
      const conn = await mongoose.connect(process.env.MONGODB_URI);
      isConnected = true;
      console.log(`MongoDB conectado: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`Erro MongoDB (tentativa ${i + 1}): ${error.message}`);
      isConnected = false;
      if (i < retries - 1) {
        console.log('Aguardando 3 segundos antes de tentar novamente...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  console.error('Falha ao conectar ao MongoDB após todas as tentativas');
};

const isDBConnected = () => isConnected;

module.exports = { connectDB, isDBConnected };
