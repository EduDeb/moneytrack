const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index - document deleted when expiresAt is reached
  },
  reason: {
    type: String,
    enum: ['logout', 'password_change', 'security', 'admin'],
    default: 'logout'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient lookup
tokenBlacklistSchema.index({ token: 1, expiresAt: 1 });

// Static method to check if token is blacklisted
tokenBlacklistSchema.statics.isBlacklisted = async function(token) {
  const blacklistedToken = await this.findOne({
    token,
    expiresAt: { $gt: new Date() }
  });
  return !!blacklistedToken;
};

// Static method to blacklist a token
tokenBlacklistSchema.statics.blacklistToken = async function(token, userId, expiresAt, reason = 'logout') {
  return this.create({
    token,
    userId,
    expiresAt,
    reason
  });
};

// Static method to blacklist all user tokens (useful for password change)
tokenBlacklistSchema.statics.blacklistAllUserTokens = async function(userId, reason = 'security') {
  // This marks that all tokens issued before this timestamp are invalid
  // The middleware should check this
  return this.create({
    token: `all_tokens_${userId}_${Date.now()}`,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    reason
  });
};

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
