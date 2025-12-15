const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');

const protect = async (req, res, next) => {
  // Verificar se o header Authorization existe e começa com Bearer
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido' });
  }

  const token = req.headers.authorization.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido' });
  }

  try {
    // Check if token is blacklisted
    const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Sessão encerrada. Faça login novamente.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Usuário não encontrado' });
    }

    // Store token and decoded info for logout functionality
    req.token = token;
    req.tokenExp = decoded.exp;
    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token inválido' });
    }
    return res.status(401).json({ message: 'Erro na autenticação' });
  }
};

// Middleware para validar ObjectId do MongoDB
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!id) {
      return res.status(400).json({ message: `Parâmetro ${paramName} é obrigatório` });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: `ID inválido: ${id}` });
    }

    return next();
  };
};

module.exports = { protect, validateObjectId };
