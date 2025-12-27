const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log(`MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Erro MongoDB: ${error.message}`);
    // Don't exit - let the app continue and retry
    isConnected = false;
  }
};

const isDBConnected = () => isConnected;

module.exports = { connectDB, isDBConnected };
