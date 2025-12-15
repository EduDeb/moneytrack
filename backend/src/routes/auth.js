const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter
} = require('../middleware/security');
const {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendWelcomeEmail
} = require('../utils/emailService');

// Gerar token JWT com informações adicionais
const generateToken = (userId, isRefresh = false) => {
  const payload = {
    userId,
    type: isRefresh ? 'refresh' : 'access',
    iat: Date.now()
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: isRefresh ? '7d' : process.env.JWT_EXPIRE || '24h'
  });
};

// Gerar refresh token
const generateRefreshToken = (userId) => {
  return generateToken(userId, true);
};

// @route   POST /api/auth/register
// @desc    Registrar novo usuário
router.post('/register',
  registerLimiter, // Rate limit: 3 por hora
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Nome é obrigatório')
      .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
    body('email')
      .isEmail().withMessage('Email inválido')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Senha deve conter letra maiúscula, minúscula e número')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { name, email, password } = req.body;

      // Verificar se usuário já existe
      const userExists = await User.findOne({ email: email.toLowerCase() });
      if (userExists) {
        console.log(`[SECURITY] Tentativa de registro com email existente: ${email}`);
        return res.status(400).json({ message: 'Este email já está cadastrado' });
      }

      // Criar usuário
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        password
      });

      // Gerar tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      console.log(`[AUTH] Novo usuário registrado: ${user._id}`);

      // Enviar email de boas-vindas
      try {
        await sendWelcomeEmail(user.email, user.name);
        console.log(`[AUTH] Email de boas-vindas enviado para: ${user._id}`);
      } catch (emailError) {
        console.error(`[AUTH ERROR] Falha ao enviar boas-vindas: ${emailError.message}`);
      }

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token,
        refreshToken,
        expiresIn: '24h'
      });
    } catch (error) {
      console.error('[AUTH ERROR] Registro:', error.message);
      res.status(500).json({ message: 'Erro ao criar conta. Tente novamente.' });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login do usuário
router.post('/login',
  loginLimiter, // Rate limit: 5 tentativas por 15 minutos
  [
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('password').notEmpty().withMessage('Senha é obrigatória')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { email, password } = req.body;

      // Buscar usuário
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      if (!user) {
        console.log(`[SECURITY] Login com email inexistente: ${email}`);
        return res.status(401).json({ message: 'Credenciais inválidas' });
      }

      // Verificar se conta está bloqueada
      if (user.isLocked()) {
        const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
        console.log(`[SECURITY] Tentativa de login em conta bloqueada: ${user._id}`);
        return res.status(423).json({
          message: `Conta temporariamente bloqueada. Tente novamente em ${lockTimeRemaining} minutos.`,
          lockedUntil: user.lockUntil
        });
      }

      // Verificar se conta está ativa
      if (!user.isActive) {
        console.log(`[SECURITY] Tentativa de login em conta inativa: ${user._id}`);
        return res.status(403).json({ message: 'Conta desativada. Entre em contato com suporte.' });
      }

      // Verificar senha
      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        await user.incrementLoginAttempts();
        console.log(`[SECURITY] Senha incorreta para: ${user._id} (Tentativa ${user.loginAttempts + 1})`);
        return res.status(401).json({ message: 'Credenciais inválidas' });
      }

      // Login bem sucedido - resetar tentativas
      await user.resetLoginAttempts();

      // Gerar tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      console.log(`[AUTH] Login bem sucedido: ${user._id} | IP: ${req.ip}`);

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        token,
        refreshToken,
        expiresIn: '24h'
      });
    } catch (error) {
      console.error('[AUTH ERROR] Login:', error.message);
      res.status(500).json({ message: 'Erro ao fazer login. Tente novamente.' });
    }
  }
);

// @route   POST /api/auth/refresh
// @desc    Renovar token de acesso
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token é obrigatório' });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Token inválido' });
    }

    // Verificar se usuário ainda existe e está ativo
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Usuário não encontrado ou inativo' });
    }

    // Gerar novo token de acesso
    const newToken = generateToken(user._id);

    res.json({
      token: newToken,
      expiresIn: '24h'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Sessão expirada. Faça login novamente.' });
    }
    console.error('[AUTH ERROR] Refresh:', error.message);
    res.status(401).json({ message: 'Token inválido' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Solicitar reset de senha
router.post('/forgot-password',
  passwordResetLimiter, // Rate limit: 3 por hora
  [
    body('email').isEmail().withMessage('Email inválido').normalizeEmail()
  ],
  async (req, res) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });

      // Sempre retornar sucesso para não revelar se email existe
      if (!user) {
        console.log(`[SECURITY] Reset de senha para email inexistente: ${email}`);
        return res.json({
          message: 'Se o email estiver cadastrado, você receberá instruções de recuperação.'
        });
      }

      // Gerar token de reset
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      user.resetPasswordToken = resetTokenHash;
      user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutos
      await user.save({ validateBeforeSave: false });

      // Enviar email com link de recuperação
      try {
        const emailResult = await sendPasswordResetEmail(user.email, user.name, resetToken);
        console.log(`[AUTH] Email de reset enviado para: ${user._id}`);

        // Em desenvolvimento, mostrar URL de preview do Ethereal
        if (emailResult.previewUrl) {
          console.log(`[DEV] Preview URL: ${emailResult.previewUrl}`);
        }
      } catch (emailError) {
        console.error(`[AUTH ERROR] Falha ao enviar email: ${emailError.message}`);
        // Não retornar erro ao usuário para não revelar se email existe
      }

      console.log(`[AUTH] Token de reset gerado para: ${user._id}`);

      res.json({
        message: 'Se o email estiver cadastrado, você receberá instruções de recuperação.'
      });
    } catch (error) {
      console.error('[AUTH ERROR] Forgot password:', error.message);
      res.status(500).json({ message: 'Erro ao processar solicitação' });
    }
  }
);

// @route   POST /api/auth/reset-password/:token
// @desc    Resetar senha com token (via URL param)
router.post('/reset-password/:token',
  [
    body('password')
      .isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Senha deve conter letra maiúscula, minúscula e número')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Hash do token recebido
      const resetTokenHash = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

      // Buscar usuário com token válido
      const user = await User.findOne({
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({ message: 'Token inválido ou expirado' });
      }

      // Atualizar senha
      user.password = req.body.password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();

      console.log(`[AUTH] Senha resetada para: ${user._id}`);

      // Enviar email de confirmação
      try {
        await sendPasswordChangedEmail(user.email, user.name);
        console.log(`[AUTH] Email de confirmação enviado para: ${user._id}`);
      } catch (emailError) {
        console.error(`[AUTH ERROR] Falha ao enviar confirmação: ${emailError.message}`);
      }

      res.json({ message: 'Senha alterada com sucesso. Faça login com a nova senha.' });
    } catch (error) {
      console.error('[AUTH ERROR] Reset password:', error.message);
      res.status(500).json({ message: 'Erro ao resetar senha' });
    }
  }
);

// @route   POST /api/auth/reset-password
// @desc    Resetar senha com token (via body)
router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Token é obrigatório'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Senha deve conter letra maiúscula, minúscula e número')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
      }

      const { token, newPassword } = req.body;

      // Hash do token recebido
      const resetTokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Buscar usuário com token válido
      const user = await User.findOne({
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({ message: 'Token inválido ou expirado' });
      }

      // Atualizar senha
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();

      console.log(`[AUTH] Senha resetada para: ${user._id}`);

      // Enviar email de confirmação
      try {
        await sendPasswordChangedEmail(user.email, user.name);
        console.log(`[AUTH] Email de confirmação enviado para: ${user._id}`);
      } catch (emailError) {
        console.error(`[AUTH ERROR] Falha ao enviar confirmação: ${emailError.message}`);
      }

      res.json({ message: 'Senha alterada com sucesso. Faça login com a nova senha.' });
    } catch (error) {
      console.error('[AUTH ERROR] Reset password:', error.message);
      res.status(500).json({ message: 'Erro ao resetar senha' });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Obter dados do usuário logado
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      phone: user.phone,
      plan: user.plan,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar usuário' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout (invalidar token no cliente)
router.post('/logout', protect, async (req, res) => {
  try {
    console.log(`[AUTH] Logout: ${req.user._id}`);

    // TODO: Implementar blacklist de tokens se necessário
    // await TokenBlacklist.create({ token: req.token, userId: req.user._id });

    res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao fazer logout' });
  }
});

// @route   POST /api/auth/verify-token
// @desc    Verificar se token é válido
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ valid: false, message: 'Token é obrigatório' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.json({ valid: false, message: 'Usuário não encontrado ou inativo' });
    }

    res.json({
      valid: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      },
      expiresAt: new Date(decoded.exp * 1000)
    });
  } catch (error) {
    res.json({ valid: false, message: 'Token inválido ou expirado' });
  }
});

module.exports = router;
