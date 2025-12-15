const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: 6,
    select: false
  },
  // Novos campos de perfil
  avatar: {
    type: String, // URL da foto
    default: null
  },
  phone: {
    type: String,
    trim: true
  },
  birthDate: {
    type: Date
  },
  // Status da conta
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    select: false
  },
  // Recuperação de senha
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  // Segurança
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  // Two-Factor Authentication (2FA)
  twoFactorEnabled: {
    type: Boolean,
    default: false,
    select: false
  },
  twoFactorSecret: {
    type: mongoose.Schema.Types.Mixed, // Encrypted object
    select: false
  },
  twoFactorTempSecret: {
    type: mongoose.Schema.Types.Mixed, // Temporary during setup
    select: false
  },
  twoFactorBackupCodes: [{
    code: { type: String }, // Hashed backup code
    used: { type: Boolean, default: false },
    usedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
  }],
  // Preferências rápidas (as detalhadas ficam em Settings)
  defaultCurrency: {
    type: String,
    default: 'BRL'
  },
  // Plano/Assinatura (para futuro)
  plan: {
    type: String,
    enum: ['free', 'premium', 'business'],
    default: 'free'
  },
  planExpiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Hash da senha antes de salvar
userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Comparar senha
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Verificar se a conta está bloqueada
userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Incrementar tentativas de login falhas
userSchema.methods.incrementLoginAttempts = async function() {
  // Se já passou o tempo de bloqueio, resetar
  if (this.lockUntil && this.lockUntil < Date.now()) {
    await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
    return;
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Bloquear após 5 tentativas (30 minutos)
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 };
  }

  await this.updateOne(updates);
};

// Resetar tentativas após login bem sucedido
userSchema.methods.resetLoginAttempts = async function() {
  await this.updateOne({
    $set: { loginAttempts: 0, lastLogin: Date.now() },
    $unset: { lockUntil: 1 }
  });
};

module.exports = mongoose.model('User', userSchema);
