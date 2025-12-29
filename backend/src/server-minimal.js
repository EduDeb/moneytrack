/**
 * Servidor Mínimo para Teste no Railway
 * Se este funcionar, o problema está no código principal
 * Se não funcionar, o problema é configuração do Railway
 */

const express = require('express');
const app = express();

const PORT = process.env.PORT || 5000;

// Endpoint raiz
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'MoneyTrack API Minimal Test' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

// Iniciar servidor (0.0.0.0 para aceitar conexões externas no Railway)
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Minimal server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
