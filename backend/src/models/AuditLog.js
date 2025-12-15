const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Usuário que realizou a ação
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Tipo de ação
  action: {
    type: String,
    enum: [
      // Autenticação
      'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PASSWORD_RESET',
      '2FA_ENABLED', '2FA_DISABLED', '2FA_VERIFIED',
      // Dados financeiros
      'TRANSACTION_CREATE', 'TRANSACTION_UPDATE', 'TRANSACTION_DELETE',
      'ACCOUNT_CREATE', 'ACCOUNT_UPDATE', 'ACCOUNT_DELETE',
      'TRANSFER_BETWEEN_ACCOUNTS',
      // Configurações
      'SETTINGS_UPDATE', 'PROFILE_UPDATE', 'EMAIL_CHANGE',
      // Exportação/Importação
      'DATA_EXPORT', 'DATA_IMPORT',
      // Administrativo
      'ACCOUNT_DEACTIVATE', 'ACCOUNT_REACTIVATE',
      // Segurança
      'SUSPICIOUS_ACTIVITY', 'RATE_LIMIT_EXCEEDED', 'INVALID_TOKEN'
    ],
    required: true
  },
  // Recurso afetado
  resource: {
    type: String,
    enum: ['user', 'transaction', 'account', 'bill', 'goal', 'budget', 'settings', 'category', 'recurring', 'auth'],
    required: true
  },
  // ID do recurso afetado
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  // Detalhes da ação
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  // Dados anteriores (para updates/deletes)
  previousData: {
    type: mongoose.Schema.Types.Mixed
  },
  // Dados novos (para creates/updates)
  newData: {
    type: mongoose.Schema.Types.Mixed
  },
  // Informações da requisição
  request: {
    ip: String,
    userAgent: String,
    method: String,
    path: String,
    origin: String
  },
  // Status da operação
  status: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    default: 'success'
  },
  // Mensagem de erro (se houver)
  errorMessage: {
    type: String
  },
  // Severidade do log
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // Usamos timestamp customizado
});

// Índices para performance em queries
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ severity: 1 });
auditLogSchema.index({ status: 1 });

// TTL - Remover logs antigos automaticamente (90 dias)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Método estático para criar log facilmente
auditLogSchema.statics.log = async function(data) {
  try {
    const log = await this.create({
      user: data.userId,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      details: data.details,
      previousData: data.previousData,
      newData: data.newData,
      request: {
        ip: data.ip,
        userAgent: data.userAgent,
        method: data.method,
        path: data.path,
        origin: data.origin
      },
      status: data.status || 'success',
      errorMessage: data.errorMessage,
      severity: data.severity || 'low'
    });
    return log;
  } catch (error) {
    console.error('[AUDIT] Erro ao criar log:', error.message);
    return null;
  }
};

// Método estático para logs de segurança
auditLogSchema.statics.securityLog = async function(data) {
  return this.log({
    ...data,
    severity: 'high'
  });
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
