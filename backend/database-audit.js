const mongoose = require('mongoose');
require('dotenv').config();

// SEGURANÇA: Usa variável de ambiente em vez de credenciais hardcoded
const MONGO_URI = process.env.MONGODB_URI;
const TARGET_USER_ID = process.env.AUDIT_USER_ID || '693d290f2a47ef4d544f1616';

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
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

// Helper functions
function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(`  ${title}`, 'cyan');
  console.log('='.repeat(80) + '\n');
}

function logSubSection(title) {
  log(`\n${'─'.repeat(70)}`, 'blue');
  log(`  ${title}`, 'blue');
  log('─'.repeat(70), 'blue');
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

// Audit Results Storage
const auditResults = {
  collections: {},
  issues: {
    critical: [],
    warnings: [],
    info: []
  },
  userDataSummary: {},
  recommendations: []
};

// Helper to check if a string is a valid ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
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

// 1. Collection Structure Analysis
async function analyzeCollectionStructure() {
  logSection('1. COLLECTION STRUCTURE ANALYSIS');

  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    logInfo(`Total Collections Found: ${collections.length}`);

    for (const collection of collections) {
      const collectionName = collection.name;
      const count = await db.collection(collectionName).countDocuments();

      auditResults.collections[collectionName] = { count };

      log(`\n  Collection: ${collectionName}`, 'magenta');
      log(`    Document Count: ${count}`);

      // Get a sample document
      const sample = await db.collection(collectionName).findOne();

      if (sample) {
        log(`    Sample Document Keys: ${Object.keys(sample).join(', ')}`);
        auditResults.collections[collectionName].sampleKeys = Object.keys(sample);
        auditResults.collections[collectionName].sample = sample;
      } else {
        logWarning(`    Collection "${collectionName}" is EMPTY`);
        auditResults.issues.warnings.push(`Empty collection: ${collectionName}`);
      }
    }

    // Check for unexpected collections
    const expectedCollections = [
      'users', 'transactions', 'recurrings', 'accounts', 'categories',
      'budgets', 'recurringoverrides', 'goals', 'debts', 'investments',
      'bills', 'settings', 'notifications', 'tokenblacklists'
    ];

    const actualCollections = collections.map(c => c.name);
    const unexpectedCollections = actualCollections.filter(c => !expectedCollections.includes(c));

    if (unexpectedCollections.length > 0) {
      logWarning(`\nUnexpected collections found: ${unexpectedCollections.join(', ')}`);
      auditResults.issues.warnings.push(`Unexpected collections: ${unexpectedCollections.join(', ')}`);
    }

  } catch (error) {
    logError(`Collection structure analysis failed: ${error.message}`);
    auditResults.issues.critical.push(`Collection analysis error: ${error.message}`);
  }
}

// 2. Data Integrity Checks
async function checkDataIntegrity() {
  logSection('2. DATA INTEGRITY CHECKS');

  const db = mongoose.connection.db;

  // Check for orphan records
  logSubSection('Checking for Orphan Records');

  const collectionsWithUser = ['transactions', 'recurrings', 'accounts', 'categories',
                                'budgets', 'recurringoverrides', 'goals', 'debts',
                                'investments', 'bills', 'settings', 'notifications'];

  const users = await db.collection('users').find({}).toArray();
  const userIds = users.map(u => u._id.toString());

  logInfo(`Total valid users in database: ${userIds.length}`);

  for (const collectionName of collectionsWithUser) {
    try {
      const collection = db.collection(collectionName);
      const exists = await db.listCollections({ name: collectionName }).hasNext();

      if (!exists) {
        logWarning(`Collection ${collectionName} does not exist`);
        continue;
      }

      const docs = await collection.find({}).toArray();
      let orphanCount = 0;
      let inconsistentTypeCount = 0;

      for (const doc of docs) {
        if (!doc.user) {
          orphanCount++;
          auditResults.issues.critical.push(
            `${collectionName}: Document ${doc._id} has no user field`
          );
        } else {
          // Check if user field is string or ObjectId
          const userValue = doc.user;
          const userIdStr = userValue.toString();

          // Check if it's a valid ObjectId
          if (!isValidObjectId(userIdStr)) {
            inconsistentTypeCount++;
            auditResults.issues.critical.push(
              `${collectionName}: Document ${doc._id} has invalid user ObjectId: ${userValue}`
            );
          } else if (!userIds.includes(userIdStr)) {
            orphanCount++;
            auditResults.issues.critical.push(
              `${collectionName}: Document ${doc._id} references non-existent user: ${userIdStr}`
            );
          }
        }
      }

      if (orphanCount > 0) {
        logError(`  ${collectionName}: Found ${orphanCount} orphan records`);
      } else {
        logSuccess(`  ${collectionName}: No orphan records found`);
      }

      if (inconsistentTypeCount > 0) {
        logError(`  ${collectionName}: Found ${inconsistentTypeCount} records with invalid user ObjectId`);
      }

    } catch (error) {
      logError(`  Error checking ${collectionName}: ${error.message}`);
    }
  }

  // Check for duplicate records
  logSubSection('Checking for Duplicate Records');

  // Check for duplicate users by email
  const duplicateEmails = await db.collection('users').aggregate([
    { $group: { _id: '$email', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  if (duplicateEmails.length > 0) {
    logError(`Found ${duplicateEmails.length} duplicate email(s) in users collection`);
    duplicateEmails.forEach(dup => {
      auditResults.issues.critical.push(`Duplicate email in users: ${dup._id}`);
    });
  } else {
    logSuccess('No duplicate emails found in users collection');
  }

  // Check required fields
  logSubSection('Checking Required Fields');

  const requiredFieldsMap = {
    users: ['name', 'email', 'password'],
    transactions: ['user', 'type', 'category', 'description', 'amount'],
    recurrings: ['user', 'name', 'type', 'category', 'amount'],
    accounts: ['user', 'name', 'type'],
    categories: ['user', 'name', 'type'],
    budgets: ['user', 'category', 'limit', 'month', 'year']
  };

  for (const [collectionName, requiredFields] of Object.entries(requiredFieldsMap)) {
    try {
      const collection = db.collection(collectionName);
      const exists = await db.listCollections({ name: collectionName }).hasNext();

      if (!exists) continue;

      let missingFieldsCount = 0;

      for (const field of requiredFields) {
        const query = {};
        query[field] = { $exists: false };
        const count = await collection.countDocuments(query);

        if (count > 0) {
          missingFieldsCount += count;
          logError(`  ${collectionName}: ${count} documents missing required field "${field}"`);
          auditResults.issues.critical.push(
            `${collectionName}: ${count} documents missing required field "${field}"`
          );
        }
      }

      if (missingFieldsCount === 0) {
        logSuccess(`  ${collectionName}: All required fields present`);
      }

    } catch (error) {
      logError(`  Error checking required fields in ${collectionName}: ${error.message}`);
    }
  }
}

// 3. User Data Consistency
async function checkUserDataConsistency() {
  logSection('3. USER DATA CONSISTENCY');

  const db = mongoose.connection.db;

  logInfo(`Analyzing data for user: ${TARGET_USER_ID}`);

  // Check if user exists
  const targetUser = await db.collection('users').findOne({
    _id: new mongoose.Types.ObjectId(TARGET_USER_ID)
  });

  if (!targetUser) {
    logError(`Target user ${TARGET_USER_ID} NOT FOUND in database`);
    auditResults.issues.critical.push(`Target user ${TARGET_USER_ID} does not exist`);
    return;
  }

  logSuccess(`Target user found: ${targetUser.name} (${targetUser.email})`);

  const collectionsWithUser = ['transactions', 'recurrings', 'accounts', 'categories',
                                'budgets', 'recurringoverrides', 'goals', 'debts',
                                'investments', 'bills', 'settings', 'notifications'];

  log('\nRecord counts per collection for target user:', 'cyan');

  for (const collectionName of collectionsWithUser) {
    try {
      const collection = db.collection(collectionName);
      const exists = await db.listCollections({ name: collectionName }).hasNext();

      if (!exists) continue;

      // Try both ObjectId and String format
      const countObjectId = await collection.countDocuments({
        user: new mongoose.Types.ObjectId(TARGET_USER_ID)
      });
      const countString = await collection.countDocuments({
        user: TARGET_USER_ID
      });

      const totalCount = countObjectId + countString;

      log(`  ${collectionName}: ${totalCount} records`, totalCount > 0 ? 'green' : 'yellow');

      if (countString > 0) {
        logWarning(`    ${countString} records use String type for user field (should be ObjectId)`);
        auditResults.issues.warnings.push(
          `${collectionName}: ${countString} records have user as String instead of ObjectId`
        );
      }

      auditResults.userDataSummary[collectionName] = {
        total: totalCount,
        objectIdFormat: countObjectId,
        stringFormat: countString
      };

    } catch (error) {
      logError(`  Error checking ${collectionName}: ${error.message}`);
    }
  }

  // Check for data leakage
  logSubSection('Checking for Data Leakage Between Users');

  const userCount = await db.collection('users').countDocuments();

  if (userCount > 1) {
    logInfo(`Multiple users detected (${userCount}), checking for data isolation...`);

    for (const collectionName of collectionsWithUser) {
      try {
        const collection = db.collection(collectionName);
        const exists = await db.listCollections({ name: collectionName }).hasNext();

        if (!exists) continue;

        const userDistribution = await collection.aggregate([
          { $group: { _id: '$user', count: { $sum: 1 } } }
        ]).toArray();

        log(`\n  ${collectionName} user distribution:`, 'blue');
        userDistribution.forEach(dist => {
          log(`    User ${dist._id}: ${dist.count} records`);
        });

      } catch (error) {
        logError(`  Error checking data leakage in ${collectionName}: ${error.message}`);
      }
    }
  } else {
    logInfo('Only one user in database, skipping data leakage check');
  }
}

// 4. Field Type Consistency
async function checkFieldTypeConsistency() {
  logSection('4. FIELD TYPE CONSISTENCY');

  const db = mongoose.connection.db;

  // Check amount fields are numbers
  logSubSection('Checking Amount Fields (should be Number)');

  const collectionsWithAmount = ['transactions', 'recurrings', 'budgets'];

  for (const collectionName of collectionsWithAmount) {
    try {
      const collection = db.collection(collectionName);
      const exists = await db.listCollections({ name: collectionName }).hasNext();

      if (!exists) continue;

      const docs = await collection.find({}).toArray();
      let stringAmountCount = 0;
      let negativeAmountCount = 0;
      let zeroAmountCount = 0;

      for (const doc of docs) {
        if (doc.amount !== undefined) {
          if (typeof doc.amount === 'string') {
            stringAmountCount++;
            auditResults.issues.critical.push(
              `${collectionName}: Document ${doc._id} has amount as string: "${doc.amount}"`
            );
          } else if (typeof doc.amount === 'number') {
            if (doc.amount < 0) {
              negativeAmountCount++;
              auditResults.issues.warnings.push(
                `${collectionName}: Document ${doc._id} has negative amount: ${doc.amount}`
              );
            }
            if (doc.amount === 0) {
              zeroAmountCount++;
              auditResults.issues.warnings.push(
                `${collectionName}: Document ${doc._id} has zero amount`
              );
            }
          }
        }
      }

      if (stringAmountCount > 0) {
        logError(`  ${collectionName}: ${stringAmountCount} records have amount as string`);
      }
      if (negativeAmountCount > 0) {
        logWarning(`  ${collectionName}: ${negativeAmountCount} records have negative amounts`);
      }
      if (zeroAmountCount > 0) {
        logWarning(`  ${collectionName}: ${zeroAmountCount} records have zero amounts`);
      }
      if (stringAmountCount === 0 && negativeAmountCount === 0 && zeroAmountCount === 0) {
        logSuccess(`  ${collectionName}: All amount fields are valid numbers`);
      }

    } catch (error) {
      logError(`  Error checking amounts in ${collectionName}: ${error.message}`);
    }
  }

  // Check date fields
  logSubSection('Checking Date Fields (should be Date objects)');

  const collectionsWithDates = {
    transactions: ['date'],
    recurrings: ['startDate', 'endDate', 'lastGeneratedDate', 'nextDueDate'],
    users: ['birthDate', 'lastLogin', 'lockUntil']
  };

  for (const [collectionName, dateFields] of Object.entries(collectionsWithDates)) {
    try {
      const collection = db.collection(collectionName);
      const exists = await db.listCollections({ name: collectionName }).hasNext();

      if (!exists) continue;

      const docs = await collection.find({}).toArray();
      let invalidDateCount = 0;

      for (const doc of docs) {
        for (const field of dateFields) {
          if (doc[field] !== undefined && doc[field] !== null) {
            if (!(doc[field] instanceof Date)) {
              invalidDateCount++;
              auditResults.issues.critical.push(
                `${collectionName}: Document ${doc._id} has "${field}" as ${typeof doc[field]} instead of Date`
              );
            }
          }
        }
      }

      if (invalidDateCount > 0) {
        logError(`  ${collectionName}: ${invalidDateCount} date fields are not Date objects`);
      } else {
        logSuccess(`  ${collectionName}: All date fields are Date objects`);
      }

    } catch (error) {
      logError(`  Error checking dates in ${collectionName}: ${error.message}`);
    }
  }

  // Check boolean fields
  logSubSection('Checking Boolean Fields');

  const collectionsWithBooleans = {
    users: ['isActive', 'isVerified', 'twoFactorEnabled'],
    accounts: ['isActive', 'includeInTotal'],
    recurrings: ['isActive', 'isInstallment', 'notifyByEmail'],
    categories: ['isDefault', 'isActive'],
    transactions: ['isInstallment', 'isReconciled']
  };

  for (const [collectionName, boolFields] of Object.entries(collectionsWithBooleans)) {
    try {
      const collection = db.collection(collectionName);
      const exists = await db.listCollections({ name: collectionName }).hasNext();

      if (!exists) continue;

      const docs = await collection.find({}).toArray();
      let invalidBoolCount = 0;

      for (const doc of docs) {
        for (const field of boolFields) {
          if (doc[field] !== undefined && doc[field] !== null) {
            if (typeof doc[field] !== 'boolean') {
              invalidBoolCount++;
              auditResults.issues.warnings.push(
                `${collectionName}: Document ${doc._id} has "${field}" as ${typeof doc[field]} instead of boolean`
              );
            }
          }
        }
      }

      if (invalidBoolCount > 0) {
        logWarning(`  ${collectionName}: ${invalidBoolCount} boolean fields have incorrect type`);
      } else {
        logSuccess(`  ${collectionName}: All boolean fields are correct`);
      }

    } catch (error) {
      logError(`  Error checking booleans in ${collectionName}: ${error.message}`);
    }
  }
}

// 5. Relationship Integrity
async function checkRelationshipIntegrity() {
  logSection('5. RELATIONSHIP INTEGRITY');

  const db = mongoose.connection.db;

  // Check recurrings have valid category references
  logSubSection('Checking Recurring -> Category References');

  try {
    const recurrings = await db.collection('recurrings').find({}).toArray();
    const categories = await db.collection('categories').find({}).toArray();
    const categoryNames = categories.map(c => c.name);

    let invalidCategoryCount = 0;

    for (const recurring of recurrings) {
      if (recurring.category && !categoryNames.includes(recurring.category)) {
        invalidCategoryCount++;
        auditResults.issues.warnings.push(
          `Recurring ${recurring._id} (${recurring.name}) references non-existent category: "${recurring.category}"`
        );
      }
    }

    if (invalidCategoryCount > 0) {
      logWarning(`  Found ${invalidCategoryCount} recurrings with invalid category references`);
    } else {
      logSuccess(`  All recurring category references are valid`);
    }

  } catch (error) {
    logError(`  Error checking recurring categories: ${error.message}`);
  }

  // Check transactions have valid account references
  logSubSection('Checking Transaction -> Account References');

  try {
    const transactions = await db.collection('transactions').find({}).toArray();
    const accounts = await db.collection('accounts').find({}).toArray();
    const accountIds = accounts.map(a => a._id.toString());

    let invalidAccountCount = 0;
    let missingAccountCount = 0;

    for (const transaction of transactions) {
      if (!transaction.account && transaction.type !== 'transfer') {
        missingAccountCount++;
        auditResults.issues.warnings.push(
          `Transaction ${transaction._id} has no account reference`
        );
      } else if (transaction.account) {
        const accountIdStr = transaction.account.toString();
        if (!accountIds.includes(accountIdStr)) {
          invalidAccountCount++;
          auditResults.issues.critical.push(
            `Transaction ${transaction._id} references non-existent account: ${accountIdStr}`
          );
        }
      }

      // Check toAccount for transfers
      if (transaction.type === 'transfer' && transaction.toAccount) {
        const toAccountIdStr = transaction.toAccount.toString();
        if (!accountIds.includes(toAccountIdStr)) {
          invalidAccountCount++;
          auditResults.issues.critical.push(
            `Transaction ${transaction._id} references non-existent toAccount: ${toAccountIdStr}`
          );
        }
      }
    }

    if (invalidAccountCount > 0) {
      logError(`  Found ${invalidAccountCount} transactions with invalid account references`);
    }
    if (missingAccountCount > 0) {
      logWarning(`  Found ${missingAccountCount} transactions without account reference`);
    }
    if (invalidAccountCount === 0 && missingAccountCount === 0) {
      logSuccess(`  All transaction account references are valid`);
    }

  } catch (error) {
    logError(`  Error checking transaction accounts: ${error.message}`);
  }

  // Check overrides reference valid recurrings
  logSubSection('Checking RecurringOverride -> Recurring References');

  try {
    const overrides = await db.collection('recurringoverrides').find({}).toArray();

    if (overrides.length === 0) {
      logInfo('  No recurring overrides found in database');
    } else {
      const recurrings = await db.collection('recurrings').find({}).toArray();
      const recurringIds = recurrings.map(r => r._id.toString());

      let invalidRecurringCount = 0;

      for (const override of overrides) {
        if (!override.recurring) {
          invalidRecurringCount++;
          auditResults.issues.critical.push(
            `RecurringOverride ${override._id} has no recurring reference`
          );
        } else {
          const recurringIdStr = override.recurring.toString();
          if (!recurringIds.includes(recurringIdStr)) {
            invalidRecurringCount++;
            auditResults.issues.critical.push(
              `RecurringOverride ${override._id} references non-existent recurring: ${recurringIdStr}`
            );
          }
        }
      }

      if (invalidRecurringCount > 0) {
        logError(`  Found ${invalidRecurringCount} overrides with invalid recurring references`);
      } else {
        logSuccess(`  All override recurring references are valid`);
      }
    }

  } catch (error) {
    logError(`  Error checking recurring overrides: ${error.message}`);
  }

  // Check transactions with recurringId reference valid recurrings
  logSubSection('Checking Transaction -> Recurring References');

  try {
    const transactions = await db.collection('transactions').find({
      recurringId: { $exists: true, $ne: null }
    }).toArray();

    if (transactions.length === 0) {
      logInfo('  No transactions with recurring references found');
    } else {
      const recurrings = await db.collection('recurrings').find({}).toArray();
      const recurringIds = recurrings.map(r => r._id.toString());

      let invalidRecurringCount = 0;

      for (const transaction of transactions) {
        const recurringIdStr = transaction.recurringId.toString();
        if (!recurringIds.includes(recurringIdStr)) {
          invalidRecurringCount++;
          auditResults.issues.critical.push(
            `Transaction ${transaction._id} references non-existent recurring: ${recurringIdStr}`
          );
        }
      }

      if (invalidRecurringCount > 0) {
        logError(`  Found ${invalidRecurringCount} transactions with invalid recurring references`);
      } else {
        logSuccess(`  All transaction recurring references are valid`);
      }
    }

  } catch (error) {
    logError(`  Error checking transaction recurring references: ${error.message}`);
  }
}

// Generate Recommendations
function generateRecommendations() {
  logSection('6. RECOMMENDATIONS');

  const recommendations = [];

  // Based on issues found
  if (auditResults.issues.critical.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      title: 'Fix Critical Data Integrity Issues',
      description: `Found ${auditResults.issues.critical.length} critical issues that could cause application errors`,
      actions: [
        'Review all orphan records and either assign valid users or delete them',
        'Fix invalid ObjectId references',
        'Ensure all required fields are present',
        'Convert string amounts to numbers'
      ]
    });
  }

  // Check for inconsistent user field types
  const hasStringUserFields = Object.values(auditResults.userDataSummary).some(
    data => data.stringFormat > 0
  );

  if (hasStringUserFields) {
    recommendations.push({
      priority: 'HIGH',
      title: 'Standardize User Field Types',
      description: 'Some collections have user field as String instead of ObjectId',
      actions: [
        'Run migration script to convert all user fields from String to ObjectId',
        'Update application code to always use ObjectId for user references',
        'Add validation in models to enforce ObjectId type'
      ]
    });
  }

  // Check for empty collections
  const emptyCollections = Object.entries(auditResults.collections)
    .filter(([name, data]) => data.count === 0)
    .map(([name]) => name);

  if (emptyCollections.length > 0) {
    recommendations.push({
      priority: 'LOW',
      title: 'Review Empty Collections',
      description: `Found ${emptyCollections.length} empty collections: ${emptyCollections.join(', ')}`,
      actions: [
        'Determine if these collections are needed',
        'Consider removing unused collections to simplify database schema'
      ]
    });
  }

  // General best practices
  recommendations.push({
    priority: 'MEDIUM',
    title: 'Implement Database Backup Strategy',
    description: 'Ensure regular backups are in place',
    actions: [
      'Set up automated daily backups',
      'Test backup restoration process',
      'Store backups in secure, off-site location'
    ]
  });

  recommendations.push({
    priority: 'MEDIUM',
    title: 'Add Database Indexes',
    description: 'Optimize query performance with proper indexes',
    actions: [
      'Review query patterns in application',
      'Add compound indexes for frequently filtered fields',
      'Monitor index usage and remove unused indexes'
    ]
  });

  recommendations.push({
    priority: 'LOW',
    title: 'Implement Data Validation Middleware',
    description: 'Add application-level validation to prevent future data integrity issues',
    actions: [
      'Use Mongoose validators for all required fields',
      'Add custom validators for complex business rules',
      'Implement pre-save hooks to validate references'
    ]
  });

  auditResults.recommendations = recommendations;

  // Display recommendations
  recommendations.forEach((rec, index) => {
    const priorityColor = rec.priority === 'CRITICAL' ? 'red' :
                          rec.priority === 'HIGH' ? 'yellow' :
                          rec.priority === 'MEDIUM' ? 'blue' : 'white';

    log(`\n${index + 1}. [${rec.priority}] ${rec.title}`, priorityColor);
    log(`   ${rec.description}`);
    log(`   Actions:`);
    rec.actions.forEach(action => {
      log(`   - ${action}`);
    });
  });
}

// Generate Summary Report
function generateSummaryReport() {
  logSection('AUDIT SUMMARY REPORT');

  const criticalCount = auditResults.issues.critical.length;
  const warningCount = auditResults.issues.warnings.length;
  const infoCount = auditResults.issues.info.length;

  log(`Critical Issues: ${criticalCount}`, criticalCount > 0 ? 'red' : 'green');
  log(`Warnings: ${warningCount}`, warningCount > 0 ? 'yellow' : 'green');
  log(`Info: ${infoCount}`, 'blue');

  log('\n--- Collection Summary ---', 'cyan');
  Object.entries(auditResults.collections).forEach(([name, data]) => {
    log(`  ${name}: ${data.count} documents`);
  });

  log('\n--- User Data Summary (Target User) ---', 'cyan');
  Object.entries(auditResults.userDataSummary).forEach(([name, data]) => {
    if (data.total > 0) {
      log(`  ${name}: ${data.total} records (ObjectId: ${data.objectIdFormat}, String: ${data.stringFormat})`);
    }
  });

  if (criticalCount === 0 && warningCount === 0) {
    logSuccess('\n✓ Database audit completed successfully with no issues found!');
  } else {
    logWarning(`\n⚠️  Database audit completed with ${criticalCount} critical issues and ${warningCount} warnings`);
  }

  log('\n--- Detailed Issues ---', 'cyan');

  if (criticalCount > 0) {
    log('\nCritical Issues:', 'red');
    auditResults.issues.critical.forEach((issue, index) => {
      log(`  ${index + 1}. ${issue}`, 'red');
    });
  }

  if (warningCount > 0) {
    log('\nWarnings:', 'yellow');
    auditResults.issues.warnings.forEach((issue, index) => {
      log(`  ${index + 1}. ${issue}`, 'yellow');
    });
  }
}

// Main Audit Function
async function runDatabaseAudit() {
  log('═══════════════════════════════════════════════════════════════════════════════', 'cyan');
  log('                    MONEYTRACK DATABASE COMPREHENSIVE AUDIT                    ', 'cyan');
  log('═══════════════════════════════════════════════════════════════════════════════', 'cyan');
  log(`\nAudit Started at: ${new Date().toLocaleString()}`, 'blue');
  log(`Database: ${MONGO_URI.split('@')[1]}`, 'blue');
  log(`Target User ID: ${TARGET_USER_ID}`, 'blue');

  const connected = await connectDB();
  if (!connected) {
    logError('Cannot proceed with audit - database connection failed');
    process.exit(1);
  }

  try {
    await analyzeCollectionStructure();
    await checkDataIntegrity();
    await checkUserDataConsistency();
    await checkFieldTypeConsistency();
    await checkRelationshipIntegrity();
    generateRecommendations();
    generateSummaryReport();

    log('\n═══════════════════════════════════════════════════════════════════════════════', 'cyan');
    log(`\nAudit Completed at: ${new Date().toLocaleString()}`, 'blue');

  } catch (error) {
    logError(`Audit failed with error: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    logInfo('Database connection closed');
  }
}

// Run the audit
runDatabaseAudit().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
