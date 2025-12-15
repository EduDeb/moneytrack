const AuditLog = require('../models/AuditLog')

// Middleware para auditoria automática
const auditMiddleware = (action, resource, options = {}) => {
  return async (req, res, next) => {
    // Guardar referência ao método original de res.json
    const originalJson = res.json.bind(res)

    res.json = async function(data) {
      try {
        // Só logar se tiver usuário autenticado ou for operação de auth
        const userId = req.user?._id || data?._id

        if (userId) {
          const severity = options.severity || getSeverity(action)
          const status = res.statusCode >= 400 ? 'failure' : 'success'

          await AuditLog.log({
            userId,
            action,
            resource,
            resourceId: req.params.id || data?._id,
            details: {
              ...options.details,
              params: req.params,
              query: sanitizeForLog(req.query)
            },
            previousData: req.previousData, // Set by specific routes when needed
            newData: options.logData ? sanitizeForLog(req.body) : undefined,
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent'),
            method: req.method,
            path: req.originalUrl,
            origin: req.get('Origin'),
            status,
            errorMessage: status === 'failure' ? data?.message : undefined,
            severity
          })
        }
      } catch (error) {
        console.error('[AUDIT] Erro ao registrar log:', error.message)
      }

      return originalJson(data)
    }

    next()
  }
}

// Determinar severidade baseada na ação
const getSeverity = (action) => {
  const highSeverity = [
    'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PASSWORD_RESET',
    '2FA_ENABLED', '2FA_DISABLED', 'EMAIL_CHANGE',
    'ACCOUNT_DEACTIVATE', 'DATA_EXPORT', 'DATA_IMPORT',
    'SUSPICIOUS_ACTIVITY'
  ]

  const criticalSeverity = [
    'ACCOUNT_DEACTIVATE', 'SUSPICIOUS_ACTIVITY', 'RATE_LIMIT_EXCEEDED'
  ]

  if (criticalSeverity.includes(action)) return 'critical'
  if (highSeverity.includes(action)) return 'high'
  if (action.includes('DELETE')) return 'medium'
  return 'low'
}

// Sanitizar dados sensíveis para log
const sanitizeForLog = (data) => {
  if (!data) return data

  const sensitiveFields = ['password', 'token', 'refreshToken', 'secret', 'otp', 'pin']
  const sanitized = { ...data }

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}

// Função helper para log manual
const logAction = async (req, action, resource, details = {}) => {
  try {
    await AuditLog.log({
      userId: req.user?._id,
      action,
      resource,
      details,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.originalUrl,
      severity: getSeverity(action)
    })
  } catch (error) {
    console.error('[AUDIT] Erro ao registrar log manual:', error.message)
  }
}

// Log de segurança (para ameaças)
const securityLog = async (req, action, details = {}) => {
  try {
    await AuditLog.securityLog({
      userId: req.user?._id,
      action,
      resource: 'auth',
      details,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.originalUrl,
      status: 'warning',
      severity: 'high'
    })
  } catch (error) {
    console.error('[AUDIT] Erro ao registrar log de segurança:', error.message)
  }
}

module.exports = {
  auditMiddleware,
  logAction,
  securityLog,
  sanitizeForLog
}
