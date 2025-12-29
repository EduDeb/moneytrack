const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

// SEGURANÇA: Usa variável de ambiente em vez de credenciais hardcoded
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('ERRO: MONGODB_URI não definida no .env');
  process.exit(1);
}

// Color codes for better readability
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'white') {
  console.log(`${colors[color] || ''}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(`  ${title}`, 'cyan');
  console.log('='.repeat(80) + '\n');
}

function logError(message) {
  log(`❌ ERROR: ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  WARNING: ${message}`, 'yellow');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Helper to prompt user for confirmation
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase());
    });
  });
}

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    logSuccess('Connected to MongoDB successfully');
    return true;
  } catch (error) {
    logError(`Failed to connect to MongoDB: ${error.message}`);
    return false;
  }
}

// Fix 1: Delete orphan settings record
async function fixOrphanSettings() {
  logSection('FIX 1: DELETE ORPHAN SETTINGS RECORD');

  const db = mongoose.connection.db;
  const orphanId = '69501a9522e639a1854b0a0a';

  try {
    const orphan = await db.collection('settings').findOne({
      _id: new mongoose.Types.ObjectId(orphanId)
    });

    if (!orphan) {
      logInfo('Orphan settings record not found (may have been already deleted)');
      return;
    }

    logWarning(`Found orphan settings record: ${orphanId}`);
    logWarning(`User reference: ${orphan.user}`);

    const answer = await askQuestion('Delete this orphan record? (yes/no): ');

    if (answer === 'yes' || answer === 'y') {
      const result = await db.collection('settings').deleteOne({
        _id: new mongoose.Types.ObjectId(orphanId)
      });

      if (result.deletedCount > 0) {
        logSuccess('Successfully deleted orphan settings record');
      } else {
        logError('Failed to delete orphan settings record');
      }
    } else {
      logInfo('Skipped deleting orphan settings record');
    }

  } catch (error) {
    logError(`Error fixing orphan settings: ${error.message}`);
  }
}

// Fix 2: Create missing categories
async function fixMissingCategories() {
  logSection('FIX 2: CREATE MISSING CATEGORIES');

  const db = mongoose.connection.db;

  // Map of invalid category names to suggested fixes
  const missingCategories = [
    { name: 'Moradia', type: 'expense', icon: 'Home', color: '#ef4444' },
    { name: 'Entretenimento', type: 'expense', icon: 'Film', color: '#8b5cf6' },
    { name: 'Internet', type: 'expense', icon: 'Wifi', color: '#06b6d4' },
    { name: 'Energia', type: 'expense', icon: 'Zap', color: '#f59e0b' },
    { name: 'Outros', type: 'expense', icon: 'MoreHorizontal', color: '#6b7280' },
    { name: 'Veículos', type: 'expense', icon: 'Car', color: '#3b82f6' },
    { name: 'Manutencao', type: 'expense', icon: 'Tool', color: '#78716c' },
    { name: 'Terrenos', type: 'expense', icon: 'MapPin', color: '#14b8a6' },
    { name: 'Imposto', type: 'expense', icon: 'FileText', color: '#dc2626' },
    { name: 'Emprestimos', type: 'income', icon: 'DollarSign', color: '#10b981' },
    { name: 'Empresas Rake , EB,Rake e DEB', type: 'expense', icon: 'Briefcase', color: '#0ea5e9' }
  ];

  try {
    log('The following categories will be created:\n', 'cyan');

    missingCategories.forEach((cat, index) => {
      log(`${index + 1}. ${cat.name} (${cat.type}) - ${cat.icon} ${cat.color}`);
    });

    const answer = await askQuestion('\nCreate these categories? (yes/no): ');

    if (answer !== 'yes' && answer !== 'y') {
      logInfo('Skipped creating missing categories');
      return;
    }

    // Get all users who have recurrings with invalid categories
    const recurrings = await db.collection('recurrings').find({}).toArray();
    const invalidCategoryNames = [
      'moradia', 'entretenimento', 'internet', 'energia', 'outros',
      'Veículos', 'Manutencao', 'Terrenos', 'Imposto', 'Emprestimos',
      'Empresas Rake , EB,Rake e DEB'
    ];

    // Get unique user IDs that need these categories
    const userIds = new Set();
    recurrings.forEach(rec => {
      const categoryLower = rec.category?.toLowerCase();
      const categoryOriginal = rec.category;

      if (invalidCategoryNames.some(inv =>
        inv.toLowerCase() === categoryLower || inv === categoryOriginal
      )) {
        userIds.add(rec.user.toString());
      }
    });

    logInfo(`Creating categories for ${userIds.size} user(s)...`);

    let categoriesCreated = 0;

    for (const userId of userIds) {
      for (const category of missingCategories) {
        const categoryDoc = {
          user: new mongoose.Types.ObjectId(userId),
          name: category.name,
          type: category.type,
          icon: category.icon,
          color: category.color,
          isDefault: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        try {
          // Check if category already exists for this user
          const exists = await db.collection('categories').findOne({
            user: new mongoose.Types.ObjectId(userId),
            name: category.name,
            type: category.type
          });

          if (!exists) {
            await db.collection('categories').insertOne(categoryDoc);
            categoriesCreated++;
            log(`  Created: ${category.name} for user ${userId}`, 'green');
          } else {
            log(`  Already exists: ${category.name} for user ${userId}`, 'yellow');
          }
        } catch (error) {
          if (error.code === 11000) {
            log(`  Duplicate: ${category.name} for user ${userId}`, 'yellow');
          } else {
            logError(`  Failed to create ${category.name}: ${error.message}`);
          }
        }
      }
    }

    logSuccess(`Successfully created ${categoriesCreated} new categories`);

    // Now update recurrings to use the correct category names
    logInfo('\nUpdating recurring category names to match new categories...');

    const categoryMapping = {
      'moradia': 'Moradia',
      'entretenimento': 'Entretenimento',
      'internet': 'Internet',
      'energia': 'Energia',
      'outros': 'Outros',
      'Veículos': 'Veículos',
      'Manutencao': 'Manutencao',
      'Terrenos': 'Terrenos',
      'Imposto': 'Imposto',
      'Emprestimos': 'Emprestimos',
      'Empresas Rake , EB,Rake e DEB': 'Empresas Rake , EB,Rake e DEB'
    };

    let recurringsUpdated = 0;

    for (const [oldName, newName] of Object.entries(categoryMapping)) {
      const result = await db.collection('recurrings').updateMany(
        { category: oldName },
        { $set: { category: newName, updatedAt: new Date() } }
      );

      if (result.modifiedCount > 0) {
        recurringsUpdated += result.modifiedCount;
        log(`  Updated ${result.modifiedCount} recurrings from "${oldName}" to "${newName}"`, 'green');
      }
    }

    logSuccess(`Successfully updated ${recurringsUpdated} recurring category references`);

  } catch (error) {
    logError(`Error fixing missing categories: ${error.message}`);
  }
}

// Fix 3: Assign accounts to transactions
async function fixMissingAccounts() {
  logSection('FIX 3: ASSIGN ACCOUNTS TO TRANSACTIONS');

  const db = mongoose.connection.db;

  try {
    // Count transactions without accounts
    const transactionsWithoutAccount = await db.collection('transactions').countDocuments({
      $or: [
        { account: { $exists: false } },
        { account: null }
      ]
    });

    logInfo(`Found ${transactionsWithoutAccount} transactions without account reference`);

    if (transactionsWithoutAccount === 0) {
      logSuccess('All transactions already have account references');
      return;
    }

    log('\nOptions for fixing:', 'cyan');
    log('1. Create a "Default Account" for each user and assign all transactions to it');
    log('2. Assign to the first existing account for each user');
    log('3. Skip this fix');

    const answer = await askQuestion('\nChoose option (1/2/3): ');

    if (answer === '3') {
      logInfo('Skipped fixing missing accounts');
      return;
    }

    // Get all users
    const users = await db.collection('users').find({}).toArray();

    let transactionsUpdated = 0;

    for (const user of users) {
      const userId = user._id;

      // Find or create default account for this user
      let defaultAccount;

      if (answer === '1') {
        // Create default account if doesn't exist
        defaultAccount = await db.collection('accounts').findOne({
          user: userId,
          name: 'Conta Principal'
        });

        if (!defaultAccount) {
          const newAccount = {
            user: userId,
            name: 'Conta Principal',
            type: 'checking',
            balance: 0,
            initialBalance: 0,
            color: '#3b82f6',
            icon: 'Wallet',
            isActive: true,
            includeInTotal: true,
            creditLimit: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const insertResult = await db.collection('accounts').insertOne(newAccount);
          defaultAccount = { _id: insertResult.insertedId };
          log(`  Created default account for user ${user.name}`, 'green');
        }
      } else if (answer === '2') {
        // Use first existing account
        defaultAccount = await db.collection('accounts').findOne({ user: userId });

        if (!defaultAccount) {
          logWarning(`  User ${user.name} has no accounts, creating one...`);
          const newAccount = {
            user: userId,
            name: 'Conta Principal',
            type: 'checking',
            balance: 0,
            initialBalance: 0,
            color: '#3b82f6',
            icon: 'Wallet',
            isActive: true,
            includeInTotal: true,
            creditLimit: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const insertResult = await db.collection('accounts').insertOne(newAccount);
          defaultAccount = { _id: insertResult.insertedId };
        }
      }

      if (defaultAccount) {
        // Update all transactions without account for this user
        const result = await db.collection('transactions').updateMany(
          {
            user: userId,
            $or: [
              { account: { $exists: false } },
              { account: null }
            ]
          },
          {
            $set: {
              account: defaultAccount._id,
              updatedAt: new Date()
            }
          }
        );

        if (result.modifiedCount > 0) {
          transactionsUpdated += result.modifiedCount;
          log(`  Updated ${result.modifiedCount} transactions for user ${user.name}`, 'green');
        }
      }
    }

    logSuccess(`Successfully assigned accounts to ${transactionsUpdated} transactions`);

  } catch (error) {
    logError(`Error fixing missing accounts: ${error.message}`);
  }
}

// Fix 4: Remove empty collections
async function removeEmptyCollections() {
  logSection('FIX 4: REMOVE EMPTY COLLECTIONS');

  const db = mongoose.connection.db;

  const emptyCollections = ['tags', 'tokenblacklists', 'debts', 'investments', 'notifications', 'auditlogs'];

  try {
    log('The following empty collections can be removed:\n', 'cyan');
    emptyCollections.forEach((name, index) => {
      log(`${index + 1}. ${name}`);
    });

    const answer = await askQuestion('\nRemove these collections? (yes/no): ');

    if (answer !== 'yes' && answer !== 'y') {
      logInfo('Skipped removing empty collections');
      return;
    }

    let collectionsRemoved = 0;

    for (const collectionName of emptyCollections) {
      try {
        const exists = await db.listCollections({ name: collectionName }).hasNext();

        if (exists) {
          const count = await db.collection(collectionName).countDocuments();

          if (count === 0) {
            await db.collection(collectionName).drop();
            collectionsRemoved++;
            log(`  Removed: ${collectionName}`, 'green');
          } else {
            logWarning(`  Skipped: ${collectionName} (not empty, has ${count} documents)`);
          }
        } else {
          log(`  Not found: ${collectionName}`, 'yellow');
        }
      } catch (error) {
        logError(`  Failed to remove ${collectionName}: ${error.message}`);
      }
    }

    logSuccess(`Successfully removed ${collectionsRemoved} empty collections`);

  } catch (error) {
    logError(`Error removing empty collections: ${error.message}`);
  }
}

// Fix 5: Recalculate account balances
async function recalculateAccountBalances() {
  logSection('FIX 5: RECALCULATE ACCOUNT BALANCES');

  const db = mongoose.connection.db;

  try {
    log('This will recalculate balances for all accounts based on their transactions.\n', 'cyan');

    const answer = await askQuestion('Recalculate account balances? (yes/no): ');

    if (answer !== 'yes' && answer !== 'y') {
      logInfo('Skipped recalculating account balances');
      return;
    }

    const accounts = await db.collection('accounts').find({}).toArray();

    let accountsUpdated = 0;

    for (const account of accounts) {
      const accountId = account._id;

      // Calculate total income (credits to this account)
      const incomeResult = await db.collection('transactions').aggregate([
        {
          $match: {
            account: accountId,
            type: 'income',
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).toArray();

      const totalIncome = incomeResult.length > 0 ? incomeResult[0].total : 0;

      // Calculate total expenses (debits from this account)
      const expenseResult = await db.collection('transactions').aggregate([
        {
          $match: {
            account: accountId,
            type: 'expense',
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).toArray();

      const totalExpense = expenseResult.length > 0 ? expenseResult[0].total : 0;

      // Calculate transfers out
      const transferOutResult = await db.collection('transactions').aggregate([
        {
          $match: {
            account: accountId,
            type: 'transfer',
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).toArray();

      const totalTransferOut = transferOutResult.length > 0 ? transferOutResult[0].total : 0;

      // Calculate transfers in
      const transferInResult = await db.collection('transactions').aggregate([
        {
          $match: {
            toAccount: accountId,
            type: 'transfer',
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).toArray();

      const totalTransferIn = transferInResult.length > 0 ? transferInResult[0].total : 0;

      // Calculate new balance
      const newBalance = account.initialBalance + totalIncome - totalExpense - totalTransferOut + totalTransferIn;

      // Update account balance
      await db.collection('accounts').updateOne(
        { _id: accountId },
        {
          $set: {
            balance: newBalance,
            updatedAt: new Date()
          }
        }
      );

      accountsUpdated++;

      const user = await db.collection('users').findOne({ _id: account.user });
      log(`  Updated: ${account.name} (${user?.name || 'Unknown'}) - New balance: ${newBalance.toFixed(2)}`, 'green');
    }

    logSuccess(`Successfully recalculated balances for ${accountsUpdated} accounts`);

  } catch (error) {
    logError(`Error recalculating account balances: ${error.message}`);
  }
}

// Main Fix Function
async function runDatabaseFix() {
  log('═══════════════════════════════════════════════════════════════════════════════', 'cyan');
  log('                    MONEYTRACK DATABASE FIX SCRIPT                             ', 'cyan');
  log('═══════════════════════════════════════════════════════════════════════════════', 'cyan');
  log(`\nFix Started at: ${new Date().toLocaleString()}`, 'blue');

  logWarning('\n⚠️  WARNING: This script will modify your database!');
  logWarning('Make sure you have a backup before proceeding.');

  const proceed = await askQuestion('\nDo you want to continue? (yes/no): ');

  if (proceed !== 'yes' && proceed !== 'y') {
    logInfo('Fix script cancelled by user');
    process.exit(0);
  }

  const connected = await connectDB();
  if (!connected) {
    logError('Cannot proceed with fixes - database connection failed');
    process.exit(1);
  }

  try {
    await fixOrphanSettings();
    await fixMissingCategories();
    await fixMissingAccounts();
    await recalculateAccountBalances();
    await removeEmptyCollections();

    log('\n═══════════════════════════════════════════════════════════════════════════════', 'cyan');
    logSuccess('\n✓ All fixes completed successfully!');
    log(`\nFix Completed at: ${new Date().toLocaleString()}`, 'blue');
    logInfo('\nRecommendation: Run the audit script again to verify all issues are resolved.');

  } catch (error) {
    logError(`Fix script failed with error: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    logInfo('Database connection closed');
  }
}

// Run the fix script
runDatabaseFix().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
