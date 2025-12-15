const crypto = require('crypto')

// Algoritmo e configurações
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const TAG_LENGTH = 16
const KEY_LENGTH = 32

// Derivar chave a partir da master key e um salt
const deriveKey = (masterKey, salt) => {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512')
}

// Obter a master key do ambiente
const getMasterKey = () => {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY deve ter pelo menos 32 caracteres')
  }
  return key
}

/**
 * Criptografar dados sensíveis
 * @param {string|number} data - Dado a ser criptografado
 * @returns {object} - Objeto com dados criptografados
 */
const encrypt = (data) => {
  try {
    if (data === null || data === undefined) return null

    const masterKey = getMasterKey()
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)
    const key = deriveKey(masterKey, salt)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data)

    let encrypted = cipher.update(dataStr, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    return {
      encrypted: true,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      data: encrypted,
      tag: authTag.toString('hex')
    }
  } catch (error) {
    console.error('[ENCRYPTION] Erro ao criptografar:', error.message)
    throw new Error('Falha na criptografia')
  }
}

/**
 * Descriptografar dados
 * @param {object} encryptedObj - Objeto criptografado
 * @returns {string} - Dado original
 */
const decrypt = (encryptedObj) => {
  try {
    if (!encryptedObj || !encryptedObj.encrypted) return encryptedObj

    const masterKey = getMasterKey()
    const salt = Buffer.from(encryptedObj.salt, 'hex')
    const iv = Buffer.from(encryptedObj.iv, 'hex')
    const tag = Buffer.from(encryptedObj.tag, 'hex')
    const key = deriveKey(masterKey, salt)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    // Tentar fazer parse se for JSON
    try {
      return JSON.parse(decrypted)
    } catch {
      return decrypted
    }
  } catch (error) {
    console.error('[ENCRYPTION] Erro ao descriptografar:', error.message)
    throw new Error('Falha na descriptografia')
  }
}

/**
 * Hash seguro para dados que não precisam ser recuperados
 * (ex: números de conta para comparação)
 */
const secureHash = (data) => {
  const masterKey = getMasterKey()
  return crypto.createHmac('sha256', masterKey)
    .update(String(data))
    .digest('hex')
}

/**
 * Mascarar dados sensíveis para exibição
 * @param {string} data - Dado original
 * @param {number} visibleChars - Caracteres visíveis no final
 * @returns {string} - Dado mascarado
 */
const mask = (data, visibleChars = 4) => {
  if (!data) return ''
  const str = String(data)
  if (str.length <= visibleChars) return '*'.repeat(str.length)
  return '*'.repeat(str.length - visibleChars) + str.slice(-visibleChars)
}

/**
 * Mascarar CPF/CNPJ
 */
const maskDocument = (doc) => {
  if (!doc) return ''
  const clean = doc.replace(/\D/g, '')
  if (clean.length === 11) {
    // CPF: ***.***.XXX-XX
    return `***.***${clean.slice(6, 9)}-${clean.slice(9)}`
  } else if (clean.length === 14) {
    // CNPJ: **.***.XXX/XXXX-XX
    return `**.***${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`
  }
  return mask(doc, 4)
}

/**
 * Mascarar número de conta bancária
 */
const maskBankAccount = (account) => {
  if (!account) return ''
  const str = String(account).replace(/\D/g, '')
  return mask(str, 3)
}

/**
 * Mascarar cartão de crédito
 */
const maskCreditCard = (card) => {
  if (!card) return ''
  const str = String(card).replace(/\D/g, '')
  return `**** **** **** ${str.slice(-4)}`
}

/**
 * Criptografar campo específico de um objeto
 */
const encryptField = (obj, fieldName) => {
  if (obj && obj[fieldName] !== undefined) {
    obj[`${fieldName}Encrypted`] = encrypt(obj[fieldName])
    obj[`${fieldName}Masked`] = mask(String(obj[fieldName]))
    delete obj[fieldName]
  }
  return obj
}

/**
 * Descriptografar campo específico de um objeto
 */
const decryptField = (obj, fieldName) => {
  const encryptedField = `${fieldName}Encrypted`
  if (obj && obj[encryptedField]) {
    obj[fieldName] = decrypt(obj[encryptedField])
    delete obj[encryptedField]
    delete obj[`${fieldName}Masked`]
  }
  return obj
}

/**
 * Gerar token seguro
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Verificar integridade de dados
 */
const generateChecksum = (data) => {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
}

const verifyChecksum = (data, checksum) => {
  return generateChecksum(data) === checksum
}

module.exports = {
  encrypt,
  decrypt,
  secureHash,
  mask,
  maskDocument,
  maskBankAccount,
  maskCreditCard,
  encryptField,
  decryptField,
  generateSecureToken,
  generateChecksum,
  verifyChecksum
}
