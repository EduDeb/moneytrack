const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');

// Carregar variáveis de ambiente APENAS em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
  /\.vercel\.app$/
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Parser JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'MoneyTrack API' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API Finance App funcionando!',
    timestamp: new Date().toISOString(),
    version: '2.0.5',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// ROTAS
// ============================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/investments', require('./routes/investments'));
app.use('/api/debts', require('./routes/debts'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/budget', require('./routes/budget'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/recurring', require('./routes/recurring'));
app.use('/api/search', require('./routes/search'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/patrimony', require('./routes/patrimony'));

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada', path: req.originalUrl });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ message: 'Erro interno do servidor' });
});

// ============================================
// INICIALIZAÇÃO
// ============================================
const PORT = process.env.PORT || 5000;

// Conectar MongoDB
connectDB().then(() => {
  console.log('MongoDB pronto');
}).catch(err => {
  console.error('Erro MongoDB:', err.message);
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido');
  server.close(() => process.exit(0));
});
