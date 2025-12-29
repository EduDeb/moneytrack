/**
 * Middleware de Validação de Dados
 *
 * Valida referências entre documentos para evitar registros órfãos.
 * Implementa cascade delete para manter integridade referencial.
 */

const mongoose = require('mongoose');

/**
 * Valida se um ObjectId é válido
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) &&
    String(new mongoose.Types.ObjectId(id)) === String(id);
};

/**
 * Middleware para validar referências de usuário
 * Garante que o user existe antes de criar/atualizar documento
 */
const validateUserReference = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: 'ID de usuário inválido' });
    }

    // Verificar se o usuário existe
    const User = mongoose.model('User');
    const userExists = await User.exists({ _id: userId });

    if (!userExists) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao validar usuário', error: error.message });
  }
};

/**
 * Middleware para validar referência de conta (account)
 * Garante que a conta existe e pertence ao usuário
 */
const validateAccountReference = async (req, res, next) => {
  try {
    const accountId = req.body.account;

    // Se não tem account, pular validação (pode ser opcional)
    if (!accountId) {
      return next();
    }

    if (!isValidObjectId(accountId)) {
      return res.status(400).json({ message: 'ID de conta inválido' });
    }

    const Account = mongoose.model('Account');
    const account = await Account.findOne({
      _id: accountId,
      user: req.user._id
    });

    if (!account) {
      return res.status(404).json({
        message: 'Conta não encontrada ou não pertence ao usuário'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao validar conta', error: error.message });
  }
};

/**
 * Middleware para validar referência de categoria
 * Garante que a categoria existe e pertence ao usuário
 */
const validateCategoryReference = async (req, res, next) => {
  try {
    const categoryName = req.body.category;

    // Se não tem category, pular validação
    if (!categoryName) {
      return next();
    }

    const Category = mongoose.model('Category');
    const category = await Category.findOne({
      user: req.user._id,
      name: { $regex: new RegExp(`^${categoryName}$`, 'i') }
    });

    // Se categoria não existe, criar automaticamente
    if (!category) {
      await Category.create({
        user: req.user._id,
        name: categoryName,
        type: req.body.type || 'expense',
        icon: 'Tag',
        color: '#6b7280',
        isDefault: false,
        isActive: true
      });
    }

    next();
  } catch (error) {
    // Categoria duplicada - ignorar e continuar
    if (error.code === 11000) {
      return next();
    }
    return res.status(500).json({ message: 'Erro ao validar categoria', error: error.message });
  }
};

/**
 * Middleware para validar referência de recorrência
 */
const validateRecurringReference = async (req, res, next) => {
  try {
    const recurringId = req.body.recurringId;

    // Se não tem recurringId, pular validação
    if (!recurringId) {
      return next();
    }

    if (!isValidObjectId(recurringId)) {
      return res.status(400).json({ message: 'ID de recorrência inválido' });
    }

    const Recurring = mongoose.model('Recurring');
    const recurring = await Recurring.findOne({
      _id: recurringId,
      user: req.user._id
    });

    if (!recurring) {
      return res.status(404).json({
        message: 'Recorrência não encontrada ou não pertence ao usuário'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao validar recorrência', error: error.message });
  }
};

/**
 * Cascade delete: Remove todos os dados relacionados ao usuário
 * Usar antes de deletar um usuário
 */
const cascadeDeleteUserData = async (userId) => {
  const models = [
    'Transaction',
    'Account',
    'Category',
    'Recurring',
    'RecurringOverride',
    'Goal',
    'Budget',
    'Debt',
    'Investment',
    'Bill',
    'Notification',
    'Settings'
  ];

  const results = {};

  for (const modelName of models) {
    try {
      const Model = mongoose.model(modelName);
      const result = await Model.deleteMany({ user: userId });
      results[modelName] = result.deletedCount;
    } catch (error) {
      // Modelo pode não existir
      results[modelName] = 0;
    }
  }

  return results;
};

/**
 * Cascade delete: Remove dados relacionados a uma conta
 */
const cascadeDeleteAccountData = async (accountId, userId) => {
  const Transaction = mongoose.model('Transaction');

  // Remover referência de account das transações (não deletar)
  const result = await Transaction.updateMany(
    { account: accountId, user: userId },
    { $unset: { account: 1 } }
  );

  return { transactionsUpdated: result.modifiedCount };
};

/**
 * Cascade delete: Remove dados relacionados a uma recorrência
 */
const cascadeDeleteRecurringData = async (recurringId, userId) => {
  const results = {};

  try {
    // Remover overrides da recorrência
    const RecurringOverride = mongoose.model('RecurringOverride');
    const overrideResult = await RecurringOverride.deleteMany({
      recurring: recurringId,
      user: userId
    });
    results.overridesDeleted = overrideResult.deletedCount;

    // Remover referência nas transações (não deletar)
    const Transaction = mongoose.model('Transaction');
    const transResult = await Transaction.updateMany(
      { recurringId: recurringId, user: userId },
      { $unset: { recurringId: 1 } }
    );
    results.transactionsUpdated = transResult.modifiedCount;
  } catch (error) {
    results.error = error.message;
  }

  return results;
};

/**
 * Valida que todas as referências de um documento existem
 */
const validateAllReferences = async (doc, schema) => {
  const errors = [];

  for (const [field, config] of Object.entries(schema.paths)) {
    if (config.options && config.options.ref) {
      const refValue = doc[field];

      if (refValue && isValidObjectId(refValue)) {
        try {
          const RefModel = mongoose.model(config.options.ref);
          const exists = await RefModel.exists({ _id: refValue });

          if (!exists) {
            errors.push({
              field,
              message: `Referência inválida: ${config.options.ref} com ID ${refValue} não existe`
            });
          }
        } catch {
          // Modelo não existe, pular
        }
      }
    }
  }

  return errors;
};

module.exports = {
  isValidObjectId,
  validateUserReference,
  validateAccountReference,
  validateCategoryReference,
  validateRecurringReference,
  cascadeDeleteUserData,
  cascadeDeleteAccountData,
  cascadeDeleteRecurringData,
  validateAllReferences
};
