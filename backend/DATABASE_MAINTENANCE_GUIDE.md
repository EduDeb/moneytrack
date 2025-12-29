# Database Maintenance Guide

This guide provides instructions for using the database audit and fix scripts for the MoneyTrack finance application.

## Files Created

1. **database-audit.js** - Comprehensive database audit script
2. **database-fix.js** - Interactive script to fix identified issues
3. **AUDIT_REPORT.md** - Detailed report from the latest audit
4. **DATABASE_MAINTENANCE_GUIDE.md** - This file

## Quick Start

### Running the Audit

```bash
# From the backend directory
node database-audit.js
```

The audit script will:
- Connect to the MongoDB database
- Analyze all collections and document counts
- Check data integrity (orphan records, duplicates, required fields)
- Verify user data consistency
- Check field type consistency (amounts, dates, booleans)
- Validate relationship integrity (foreign key references)
- Generate recommendations
- Output a comprehensive report

**Duration:** ~10-15 seconds
**Output:** Colored console output with detailed findings

### Running the Fix Script

```bash
# From the backend directory
node database-fix.js
```

The fix script is **interactive** and will:
1. Ask for confirmation before making any changes
2. Fix orphan settings records
3. Create missing categories
4. Assign accounts to transactions
5. Recalculate account balances
6. Remove empty collections

**Important:** The script will ask for confirmation at each step.

## Latest Audit Results Summary

**Date:** December 28, 2025
**Database:** finance-app
**Status:** ⚠️ Needs Attention

### Key Findings

#### Critical Issues (1)
- 1 orphan settings record referencing deleted user

#### Warnings (142)
- 122 transactions missing account references (100%)
- 13 recurrings with invalid category references (38%)
- 6 empty collections
- 4 unexpected collections

#### Good News
✓ All data types are correct (amounts, dates, booleans)
✓ No data leakage between users
✓ User references use proper ObjectId format
✓ Most relationship references are valid

## Detailed Issue Breakdown

### Issue 1: Orphan Settings Record
**Severity:** Critical
**Impact:** May cause errors when querying settings

**Details:**
- Settings document ID: `69501a9522e639a1854b0a0a`
- References non-existent user: `69501a3822e639a1854b09d7`

**Fix:** Run the fix script option 1 to delete this record

### Issue 2: Missing Account References (122 transactions)
**Severity:** High
**Impact:** Cannot track transactions by account, balance calculations may be wrong

**Details:**
- ALL 122 transactions in the database have no account field
- This affects the entire transaction history

**Fix Options:**
1. Create a "Default Account" for each user and assign all transactions
2. Assign to the first existing account for each user

### Issue 3: Invalid Category References (13 recurrings)
**Severity:** Medium
**Impact:** Category filtering and reports won't work for these recurrings

**Invalid Categories:**
- moradia → should be "Moradia"
- entretenimento → should be "Entretenimento"
- internet → should be "Internet"
- energia → should be "Energia"
- outros → should be "Outros"
- Veículos
- Manutencao
- Terrenos
- Imposto
- Emprestimos
- "Empresas Rake , EB,Rake e DEB"

**Fix:** Run the fix script option 2 to create missing categories and update references

## Target User Data Summary

**User ID:** 693d290f2a47ef4d544f1616
**Name:** Eduardo
**Email:** edudebia26@gmail.com

### Data Distribution
- 122 transactions
- 29 recurrings
- 5 accounts
- 20 categories
- 11 recurring overrides
- 3 goals
- 1 settings
- 0 budgets, debts, investments, bills, notifications

## Fix Script Options

### Option 1: Fix Orphan Settings
**What it does:** Deletes the orphan settings record
**Safety:** Safe - only removes invalid data
**Confirmation:** Yes, asks before deleting

### Option 2: Create Missing Categories
**What it does:**
- Creates all missing categories (11 total)
- Updates recurring records to reference new categories
- Creates categories for all users who need them

**Safety:** Safe - only creates new data
**Confirmation:** Yes, shows list before creating

### Option 3: Assign Accounts to Transactions
**What it does:**
- Creates a default account for users who don't have one
- Assigns all transactions without accounts to the default account
- Updates 122 transactions

**Options:**
1. Create new "Conta Principal" for each user
2. Use first existing account for each user

**Safety:** Moderate - modifies existing transactions
**Confirmation:** Yes, asks which option to use

### Option 4: Recalculate Account Balances
**What it does:**
- Recalculates balance for each account based on transactions
- Considers: income, expenses, transfers in/out
- Updates account balance field

**Safety:** Safe - only updates calculated values
**Confirmation:** Yes, asks before recalculating

### Option 5: Remove Empty Collections
**What it does:**
- Removes collections with 0 documents
- Targets: tags, tokenblacklists, debts, investments, notifications, auditlogs

**Safety:** Safe - only removes empty collections
**Confirmation:** Yes, shows list before removing

## Recommendations

### Immediate (Do Now)
1. ✅ Run audit script to understand current state
2. ⏳ Run fix script and complete all 5 options
3. ⏳ Run audit again to verify fixes

### Short-term (This Week)
4. ⏳ Update application code to require account field on transactions
5. ⏳ Add validation to prevent orphan records
6. ⏳ Implement category validation before saving recurrings

### Long-term (This Month)
7. ⏳ Set up automated database backups
8. ⏳ Create database migration framework
9. ⏳ Add database monitoring
10. ⏳ Document schema and relationships

## Database Connection

**URI:** Configurado no arquivo `.env` como `MONGODB_URI`

**IMPORTANTE:** Credenciais são carregadas via variáveis de ambiente:
- Os scripts usam `require('dotenv').config()` para carregar do `.env`
- Nunca commite credenciais no git
- Certifique-se de que `.env` está no `.gitignore`

## Safety Precautions

### Before Running Fix Script
1. **Create a backup** of your MongoDB database
2. Run the audit script first to understand issues
3. Review the fix script code if unsure
4. Test in a development environment first if possible

### Backup Instructions
```bash
# Carregue a URI do .env primeiro
source .env

# Using mongodump
mongodump --uri="$MONGODB_URI" --out=./backup

# Or use MongoDB Atlas backup feature
# Go to Atlas Dashboard → Backups → Take snapshot
```

### Restore from Backup
```bash
# Carregue a URI do .env primeiro
source .env

# Using mongorestore
mongorestore --uri="$MONGODB_URI" ./backup/finance-app
```

## Troubleshooting

### Connection Errors
**Problem:** Cannot connect to MongoDB
**Solutions:**
- Check internet connection
- Verify MongoDB Atlas cluster is running
- Check if IP address is whitelisted in Atlas
- Verify credentials are correct

### Script Hangs
**Problem:** Script stops responding
**Solutions:**
- Press Ctrl+C to cancel
- Check MongoDB Atlas cluster status
- Try running individual fix options
- Check console for error messages

### Unexpected Results
**Problem:** Fix script doesn't work as expected
**Solutions:**
- Run audit script again to see current state
- Review AUDIT_REPORT.md for details
- Check console output for errors
- Restore from backup if needed

## Understanding the Output

### Color Coding
- 🔴 **Red:** Critical errors that need immediate attention
- 🟡 **Yellow:** Warnings that should be reviewed
- 🔵 **Blue:** Informational messages
- 🟢 **Green:** Success messages
- 🔷 **Cyan:** Section headers

### Symbols
- ✓ Success or passed check
- ❌ Error or failed check
- ⚠️ Warning
- ℹ️ Information

## Best Practices

### Regular Maintenance
1. Run audit script weekly to catch issues early
2. Monitor for new orphan records
3. Keep categories synchronized
4. Verify account balances match expectations

### Data Quality
1. Always assign accounts to new transactions
2. Use existing categories when possible
3. Validate user references before creating records
4. Implement cascading deletes for related data

### Development
1. Test schema changes in development first
2. Create migration scripts for major changes
3. Document all database modifications
4. Use transactions for multi-step updates

## Next Steps

After running the fixes:

1. **Verify fixes worked:**
   ```bash
   node database-audit.js
   ```
   Should show 0 critical issues and fewer warnings

2. **Update application code:**
   - Make account field required in Transaction model
   - Add category validation in Recurring model
   - Implement cascade delete for user-related records

3. **Set up monitoring:**
   - Create scheduled job to run audit weekly
   - Send alerts if critical issues found
   - Log audit results for trend analysis

4. **Documentation:**
   - Document expected collections
   - Create ER diagram of database schema
   - Document business rules for data validation

## Support

For issues or questions:
1. Review the AUDIT_REPORT.md for detailed findings
2. Check the console output for specific error messages
3. Review the script source code for implementation details
4. Create a backup before attempting manual fixes

## Script Versions

- **database-audit.js:** v1.0 (December 28, 2025)
- **database-fix.js:** v1.0 (December 28, 2025)

---

**Last Updated:** December 28, 2025
**Maintained By:** Database Audit Team
