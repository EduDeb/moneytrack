const express = require('express')
const router = express.Router()
const speakeasy = require('speakeasy')
const QRCode = require('qrcode')
const crypto = require('crypto')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { logAction } = require('../middleware/audit')

router.use(protect)

// Criptografar secret do 2FA
const encryptSecret = (secret) => {
  const algorithm = 'aes-256-gcm'
  const key = Buffer.from(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)

  let encrypted = cipher.update(secret, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag.toString('hex')
  }
}

const decryptSecret = (encryptedObj) => {
  const algorithm = 'aes-256-gcm'
  const key = Buffer.from(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex')

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(encryptedObj.iv, 'hex')
  )
  decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'))

  let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// @route   GET /api/2fa/status
// @desc    Verificar status do 2FA
router.get('/status', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+twoFactorEnabled +twoFactorBackupCodes')

    res.json({
      enabled: user.twoFactorEnabled || false,
      backupCodesRemaining: user.twoFactorBackupCodes?.filter(c => !c.used).length || 0
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao verificar status 2FA', error: error.message })
  }
})

// @route   POST /api/2fa/setup
// @desc    Iniciar configuração do 2FA
router.post('/setup', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+twoFactorEnabled')

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA já está ativado' })
    }

    // Gerar secret
    const secret = speakeasy.generateSecret({
      name: `MoneyTrack:${user.email}`,
      issuer: 'MoneyTrack',
      length: 32
    })

    // Salvar secret temporário (não ativado ainda)
    const encryptedSecret = encryptSecret(secret.base32)
    user.twoFactorTempSecret = encryptedSecret
    await user.save()

    // Gerar QR Code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url)

    await logAction(req, '2FA_SETUP_STARTED', 'user')

    res.json({
      secret: secret.base32, // Mostrar apenas durante setup
      qrCode: qrCodeUrl,
      message: 'Escaneie o QR Code com seu app autenticador e verifique com um código'
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao configurar 2FA', error: error.message })
  }
})

// @route   POST /api/2fa/verify-setup
// @desc    Verificar e ativar 2FA
router.post('/verify-setup', async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ message: 'Código é obrigatório' })
    }

    const user = await User.findById(req.user._id).select('+twoFactorTempSecret +twoFactorEnabled')

    if (!user.twoFactorTempSecret) {
      return res.status(400).json({ message: 'Configuração não iniciada. Execute /setup primeiro.' })
    }

    // Decriptar secret
    const secret = decryptSecret(user.twoFactorTempSecret)

    // Verificar token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Permite 2 tokens antes/depois (60 segundos de margem)
    })

    if (!verified) {
      return res.status(400).json({ message: 'Código inválido. Tente novamente.' })
    }

    // Gerar códigos de backup
    const backupCodes = []
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase()
      backupCodes.push({
        code: crypto.createHash('sha256').update(code).digest('hex'),
        used: false,
        createdAt: new Date()
      })
      // Guardar código original para mostrar ao usuário
      backupCodes[i].originalCode = code
    }

    // Ativar 2FA
    user.twoFactorSecret = user.twoFactorTempSecret
    user.twoFactorEnabled = true
    user.twoFactorBackupCodes = backupCodes.map(({ code, used, createdAt }) => ({ code, used, createdAt }))
    user.twoFactorTempSecret = undefined
    await user.save()

    await logAction(req, '2FA_ENABLED', 'user', { method: 'totp' })

    res.json({
      message: '2FA ativado com sucesso!',
      backupCodes: backupCodes.map(c => c.originalCode),
      warning: 'IMPORTANTE: Guarde estes códigos de backup em local seguro. Eles só serão mostrados uma vez!'
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao verificar 2FA', error: error.message })
  }
})

// @route   POST /api/2fa/verify
// @desc    Verificar código 2FA (durante login)
router.post('/verify', async (req, res) => {
  try {
    const { token, userId } = req.body

    if (!token || !userId) {
      return res.status(400).json({ message: 'Código e usuário são obrigatórios' })
    }

    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorEnabled +twoFactorBackupCodes')

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA não está ativado para este usuário' })
    }

    // Verificar se é um código de backup
    const cleanToken = token.replace(/\s/g, '').toUpperCase()
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex')

    const backupCode = user.twoFactorBackupCodes?.find(c => c.code === tokenHash && !c.used)

    if (backupCode) {
      // Usar código de backup
      backupCode.used = true
      backupCode.usedAt = new Date()
      await user.save()

      await logAction(req, '2FA_VERIFIED', 'user', { method: 'backup_code' })

      return res.json({
        verified: true,
        message: 'Código de backup utilizado',
        backupCodesRemaining: user.twoFactorBackupCodes.filter(c => !c.used).length
      })
    }

    // Verificar TOTP
    const secret = decryptSecret(user.twoFactorSecret)

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: cleanToken,
      window: 2
    })

    if (!verified) {
      await logAction(req, '2FA_FAILED', 'user', { reason: 'invalid_token' })
      return res.status(400).json({ message: 'Código inválido' })
    }

    await logAction(req, '2FA_VERIFIED', 'user', { method: 'totp' })

    res.json({
      verified: true,
      message: '2FA verificado com sucesso'
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao verificar código', error: error.message })
  }
})

// @route   POST /api/2fa/disable
// @desc    Desativar 2FA
router.post('/disable', async (req, res) => {
  try {
    const { password, token } = req.body

    if (!password || !token) {
      return res.status(400).json({ message: 'Senha e código 2FA são obrigatórios' })
    }

    const user = await User.findById(req.user._id).select('+password +twoFactorSecret +twoFactorEnabled')

    // Verificar senha
    const isMatch = await user.matchPassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Senha incorreta' })
    }

    // Verificar 2FA atual
    const secret = decryptSecret(user.twoFactorSecret)
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2
    })

    if (!verified) {
      return res.status(400).json({ message: 'Código 2FA inválido' })
    }

    // Desativar 2FA
    user.twoFactorEnabled = false
    user.twoFactorSecret = undefined
    user.twoFactorBackupCodes = undefined
    await user.save()

    await logAction(req, '2FA_DISABLED', 'user')

    res.json({ message: '2FA desativado com sucesso' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desativar 2FA', error: error.message })
  }
})

// @route   POST /api/2fa/regenerate-backup
// @desc    Regenerar códigos de backup
router.post('/regenerate-backup', async (req, res) => {
  try {
    const { password, token } = req.body

    if (!password || !token) {
      return res.status(400).json({ message: 'Senha e código 2FA são obrigatórios' })
    }

    const user = await User.findById(req.user._id).select('+password +twoFactorSecret +twoFactorEnabled')

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA não está ativado' })
    }

    // Verificar senha
    const isMatch = await user.matchPassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Senha incorreta' })
    }

    // Verificar 2FA
    const secret = decryptSecret(user.twoFactorSecret)
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2
    })

    if (!verified) {
      return res.status(400).json({ message: 'Código 2FA inválido' })
    }

    // Gerar novos códigos de backup
    const backupCodes = []
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase()
      backupCodes.push({
        code: crypto.createHash('sha256').update(code).digest('hex'),
        used: false,
        createdAt: new Date()
      })
      backupCodes[i].originalCode = code
    }

    user.twoFactorBackupCodes = backupCodes.map(({ code, used, createdAt }) => ({ code, used, createdAt }))
    await user.save()

    await logAction(req, '2FA_BACKUP_REGENERATED', 'user')

    res.json({
      message: 'Novos códigos de backup gerados',
      backupCodes: backupCodes.map(c => c.originalCode),
      warning: 'Os códigos anteriores foram invalidados. Guarde estes novos códigos em local seguro!'
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao regenerar códigos', error: error.message })
  }
})

module.exports = router
