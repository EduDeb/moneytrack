const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const hpp = require('hpp')

// Rate Limiter Geral - 1000 requests por 15 minutos (mais permissivo para desenvolvimento)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000,
  message: {
    status: 429,
    message: 'Muitas requisições. Tente novamente em 15 minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[RATE LIMIT] IP ${req.ip} excedeu limite geral`)
    res.status(429).json({ message: 'Muitas requisições. Tente novamente em 15 minutos.' })
  }
})

// Rate Limiter para Login - 5 tentativas por 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    status: 429,
    message: 'Muitas tentativas de login. Conta temporariamente bloqueada.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Não conta requisições bem-sucedidas
  handler: (req, res) => {
    console.log(`[SECURITY ALERT] IP ${req.ip} - Múltiplas tentativas de login`)
    res.status(429).json({ message: 'Muitas tentativas de login. Conta temporariamente bloqueada.' })
  }
})

// Rate Limiter para Registro - 3 por hora
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  message: {
    status: 429,
    message: 'Limite de cadastros atingido. Tente novamente em 1 hora.',
    retryAfter: '1 hora'
  },
  handler: (req, res) => {
    console.log(`[SECURITY ALERT] IP ${req.ip} - Múltiplos registros`)
    res.status(429).json({ message: 'Limite de cadastros atingido. Tente novamente em 1 hora.' })
  }
})

// Rate Limiter para Reset de Senha - 3 por hora
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    status: 429,
    message: 'Muitas solicitações de reset de senha. Tente novamente em 1 hora.'
  },
  handler: (req, res) => {
    console.log(`[SECURITY ALERT] IP ${req.ip} - Múltiplos resets de senha`)
    res.status(429).json({ message: 'Muitas solicitações de reset de senha. Tente novamente em 1 hora.' })
  }
})

// Rate Limiter para API sensíveis (transações, contas) - 30 por minuto
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30,
  message: {
    status: 429,
    message: 'Muitas operações. Aguarde um momento.'
  }
})

// Configuração do Helmet para headers de segurança
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:*"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
})

// Sanitização customizada para XSS
const xssSanitize = (req, res, next) => {
  if (req.body) {
    sanitizeObject(req.body)
  }
  if (req.query) {
    sanitizeObject(req.query)
  }
  if (req.params) {
    sanitizeObject(req.params)
  }
  next()
}

function sanitizeObject(obj) {
  for (let key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove tags HTML e scripts
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim()
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key])
    }
  }
}

// Detectar atividades suspeitas
const suspiciousActivityDetector = (req, res, next) => {
  const suspiciousPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)/i, // SQL Injection (removido # isolado que conflita com cores hex)
    /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i, // XSS
    /(\%00)/i, // Null byte
    /(\.\.\/)/i, // Path traversal
    /(\$where|\$gt|\$lt|\$ne|\$regex)/i // NoSQL injection
  ]

  // Valores seguros que não devem ser bloqueados
  const isSafeValue = (value) => {
    if (typeof value !== 'string') return true
    // Cores hex são seguras (#3b82f6, #fff, #ffffff, etc)
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return true
    // IDs MongoDB são seguros
    if (/^[0-9a-fA-F]{24}$/.test(value)) return true
    return false
  }

  const checkValue = (value) => {
    if (typeof value !== 'string') return false
    if (isSafeValue(value)) return false
    return suspiciousPatterns.some(pattern => pattern.test(value))
  }

  const checkObject = (obj) => {
    for (let key in obj) {
      if (checkValue(key) || checkValue(obj[key])) return true
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkObject(obj[key])) return true
      }
    }
    return false
  }

  const isSuspicious =
    checkObject(req.body) ||
    checkObject(req.query) ||
    checkObject(req.params) ||
    checkValue(req.originalUrl)

  if (isSuspicious) {
    console.log(`[SECURITY ALERT] Atividade suspeita detectada - IP: ${req.ip}, URL: ${req.originalUrl}`)
    return res.status(400).json({
      message: 'Requisição inválida detectada'
    })
  }

  next()
}

// Log de requisições para auditoria
const requestLogger = (req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?._id || 'anonymous',
      statusCode: res.statusCode,
      duration: `${duration}ms`
    }

    // Log de operações sensíveis
    if (req.method !== 'GET' || res.statusCode >= 400) {
      console.log(`[AUDIT] ${JSON.stringify(log)}`)
    }
  })

  next()
}

// Custom NoSQL injection sanitizer (replaces express-mongo-sanitize)
const noSqlSanitize = (req, res, next) => {
  const sanitize = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj

    for (const key in obj) {
      // Block keys starting with $ (MongoDB operators)
      if (key.startsWith('$')) {
        delete obj[key]
        continue
      }

      // Recursively sanitize nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key])
      }

      // Check string values for dangerous patterns
      if (typeof obj[key] === 'string') {
        // Remove $where and other dangerous operators in strings
        if (obj[key].includes('$where') || obj[key].includes('$gt') ||
            obj[key].includes('$lt') || obj[key].includes('$ne') ||
            obj[key].includes('$regex') || obj[key].includes('$or') ||
            obj[key].includes('$and')) {
          obj[key] = obj[key].replace(/\$\w+/g, '')
        }
      }
    }
    return obj
  }

  if (req.body) sanitize(req.body)
  if (req.query) sanitize(req.query)
  if (req.params) sanitize(req.params)

  next()
}

module.exports = {
  generalLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  sensitiveLimiter,
  helmetConfig,
  noSqlSanitize,
  hpp,
  xssSanitize,
  suspiciousActivityDetector,
  requestLogger
}
