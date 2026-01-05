const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const {
  generalLimiter,
  helmetConfig,
  noSqlSanitize,
  hpp,
  xssSanitize,
  suspiciousActivityDetector,
  requestLogger
} = require('./middleware/security');

// Carregar variáveis de ambiente APENAS em desenvolvimento
// Em produção (Railway), as variáveis vêm do dashboard
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();

// ============================================
// HEALTH CHECK - ANTES DE TUDO (para Railway)
// ============================================

// Health check na raiz (Railway verifica aqui)
app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'MoneyTrack API' });
});

// Health check completo
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API Finance App funcionando!',
    timestamp: new Date().toISOString(),
    version: '2.0.2',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Trust proxy (para rate limiting funcionar corretamente atrás de proxy)
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARES DE SEGURANÇA (ordem importa!)
// ============================================

// 1. Helmet - Headers de segurança HTTP
app.use(helmetConfig);

// 2. CORS - Configuração para aceitar múltiplas origens (localhost e Vercel)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
  /\.vercel\.app$/  // Aceita qualquer subdomínio do Vercel
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list or matches Vercel pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 horas
};
app.use(cors(corsOptions));

// 3. Rate Limiting Geral
app.use(generalLimiter);

// 4. Parser de JSON com limite de tamanho (aumentado para suportar imports)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 5. Sanitização contra NoSQL Injection
app.use(noSqlSanitize);

// 6. Prevenção de HTTP Parameter Pollution
app.use(hpp({
  whitelist: ['category', 'type', 'status', 'tags'] // Campos que podem ter múltiplos valores
}));

// 7. Sanitização XSS customizada
app.use(xssSanitize);

// 8. Detector de atividades suspeitas
app.use(suspiciousActivityDetector);

// 9. Logger de requisições para auditoria
app.use(requestLogger);

// ============================================
// ROTAS
// ============================================

// Autenticação (com rate limiting específico)
app.use('/api/auth', require('./routes/auth'));

// Rotas principais
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

// Patrimônio (simplificado)
app.use('/api/patrimony', require('./routes/patrimony'));

// ============================================
// TRATAMENTO DE ERROS
// ============================================

// 404 - Rota não encontrada
app.use((req, res, next) => {
  res.status(404).json({
    message: 'Rota não encontrada',
    path: req.originalUrl
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.stack}`);

  // Não expor detalhes de erro em produção
  const isDev = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    message: err.message || 'Erro interno do servidor',
    ...(isDev && { stack: err.stack })
  });
});

// ============================================
// INICIALIZAÇÃO
// ============================================

const PORT = process.env.PORT || 5000;

// Conectar ao MongoDB primeiro
connectDB().then(() => {
  console.log('MongoDB pronto');
}).catch(err => {
  console.error('Erro MongoDB:', err.message);
});

// Iniciar servidor em 0.0.0.0 para aceitar conexões externas
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido. Encerrando servidor...');
  server.close(() => {
    console.log('Servidor encerrado.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});
