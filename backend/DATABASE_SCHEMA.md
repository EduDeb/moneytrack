# MoneyTrack - Database Schema Documentation

**Version:** 1.0
**Last Updated:** December 29, 2025
**Database:** MongoDB (Atlas)

---

## Table of Contents
1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Collections](#collections)
4. [Relationships](#relationships)
5. [Indexes](#indexes)
6. [Data Types](#data-types)
7. [Business Rules](#business-rules)

---

## Overview

MoneyTrack is a personal finance management application. The database consists of 14 main collections organized around user-centric data isolation.

### Key Principles
- **User Isolation**: All data belongs to a specific user (multi-tenant by design)
- **Referential Integrity**: Foreign keys reference valid documents
- **Soft Deletes**: Use `isActive: false` instead of hard deletes where applicable
- **Timestamps**: All documents have `createdAt` and `updatedAt`

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER (Central Entity)                          │
│                                                                             │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │  User   │───<│ Transaction  │    │   Account   │───<│   Transaction   │ │
│  │         │    └──────────────┘    └─────────────┘    └─────────────────┘ │
│  │         │                                                                │
│  │         │───<┌──────────────┐    ┌─────────────┐                        │
│  │         │    │  Recurring   │───<│  Override   │                        │
│  │         │    └──────────────┘    └─────────────┘                        │
│  │         │                                                                │
│  │         │───<┌──────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │         │    │   Category   │    │    Goal     │    │      Debt       │ │
│  │         │    └──────────────┘    └─────────────┘    └─────────────────┘ │
│  │         │                                                                │
│  │         │───<┌──────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │         │    │  Investment  │    │   Budget    │    │     Bill        │ │
│  │         │    └──────────────┘    └─────────────┘    └─────────────────┘ │
│  │         │                                                                │
│  │         │───<┌──────────────┐    ┌─────────────┐                        │
│  │         │    │ Notification │    │  Settings   │                        │
│  └─────────┘    └──────────────┘    └─────────────┘                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Legend:
  ───<  One-to-Many relationship
  ────  One-to-One relationship
```

---

## Collections

### 1. User
**Collection Name:** `users`
**Purpose:** Store user accounts and authentication data

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| name | String | Yes | - | User's full name |
| email | String | Yes | - | Unique email address |
| password | String | Yes | - | Bcrypt hashed password |
| avatar | String | No | null | Profile photo URL |
| phone | String | No | - | Phone number |
| birthDate | Date | No | - | Date of birth |
| isActive | Boolean | No | true | Account status |
| isVerified | Boolean | No | false | Email verified |
| lastLogin | Date | No | - | Last login timestamp |
| loginAttempts | Number | No | 0 | Failed login counter |
| lockUntil | Date | No | - | Account lock expiry |
| twoFactorEnabled | Boolean | No | false | 2FA status |
| twoFactorSecret | Mixed | No | - | Encrypted 2FA secret |
| defaultCurrency | String | No | 'BRL' | Preferred currency |
| plan | String | No | 'free' | Subscription tier |
| createdAt | Date | Auto | - | Creation timestamp |
| updatedAt | Date | Auto | - | Last update timestamp |

---

### 2. Account
**Collection Name:** `accounts`
**Purpose:** Bank accounts, wallets, credit cards

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| name | String | Yes | - | Account name |
| type | String | No | 'checking' | checking, savings, credit_card, cash, investment, other |
| institution | String | No | - | Bank/institution name |
| balance | Number | No | 0 | Current balance |
| initialBalance | Number | No | 0 | Starting balance |
| color | String | No | '#3b82f6' | Display color |
| icon | String | No | 'Wallet' | Lucide icon name |
| isActive | Boolean | No | true | Account status |
| includeInTotal | Boolean | No | true | Include in totals |
| creditLimit | Number | No | 0 | For credit cards |
| closingDay | Number | No | - | Credit card closing day |
| dueDay | Number | No | - | Credit card due day |
| createdAt | Date | Auto | - | Creation timestamp |
| updatedAt | Date | Auto | - | Last update timestamp |

---

### 3. Transaction
**Collection Name:** `transactions`
**Purpose:** Financial transactions (income, expenses, transfers)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| type | String | Yes | - | income, expense, transfer |
| category | String | Yes | - | Category name |
| description | String | Yes | - | Transaction description |
| amount | Number | Yes | - | Transaction amount |
| date | Date | No | now | Transaction date |
| account | ObjectId | No | - | Reference to Account |
| toAccount | ObjectId | No | - | For transfers |
| tags | [String] | No | [] | Custom tags |
| notes | String | No | - | Additional notes |
| isInstallment | Boolean | No | false | Part of installment |
| installmentNumber | Number | No | - | Current installment |
| totalInstallments | Number | No | - | Total installments |
| installmentGroupId | String | No | - | Groups installments |
| recurringId | ObjectId | No | - | Reference to Recurring |
| status | String | No | 'confirmed' | pending, confirmed, cancelled |
| isReconciled | Boolean | No | false | Bank reconciled |
| createdAt | Date | Auto | - | Creation timestamp |
| updatedAt | Date | Auto | - | Last update timestamp |

---

### 4. Category
**Collection Name:** `categories`
**Purpose:** Custom transaction categories

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| name | String | Yes | - | Category name |
| type | String | Yes | - | income or expense |
| icon | String | No | 'Tag' | Lucide icon name |
| color | String | No | '#6b7280' | Display color |
| isDefault | Boolean | No | false | System default |
| isActive | Boolean | No | true | Category status |
| createdAt | Date | Auto | - | Creation timestamp |
| updatedAt | Date | Auto | - | Last update timestamp |

**Unique Index:** `{ user: 1, name: 1, type: 1 }`

---

### 5. Recurring
**Collection Name:** `recurrings`
**Purpose:** Recurring transactions (bills, subscriptions)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| name | String | Yes | - | Recurring name |
| type | String | Yes | - | income or expense |
| category | String | Yes | - | Category name |
| amount | Number | Yes | - | Default amount |
| account | ObjectId | No | - | Reference to Account |
| frequency | String | No | 'monthly' | daily, weekly, biweekly, monthly, yearly |
| dayOfMonth | Number | No | - | Day for monthly (1-31) |
| dayOfWeek | Number | No | - | Day for weekly (0-6) |
| startDate | Date | No | now | Start date |
| endDate | Date | No | - | End date (optional) |
| lastGeneratedDate | Date | No | - | Last generation |
| nextDueDate | Date | No | - | Next due date |
| isActive | Boolean | No | true | Recurring status |
| isInstallment | Boolean | No | false | Is installment plan |
| totalInstallments | Number | No | 1 | Total installments |
| currentInstallment | Number | No | 1 | Current installment |
| notifyDaysBefore | Number | No | 3 | Notification days |
| createdAt | Date | Auto | - | Creation timestamp |
| updatedAt | Date | Auto | - | Last update timestamp |

---

### 6. RecurringOverride
**Collection Name:** `recurringoverrides`
**Purpose:** Monthly overrides for recurring transactions

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| recurring | ObjectId | Yes | - | Reference to Recurring |
| month | Number | Yes | - | Month (1-12) |
| year | Number | Yes | - | Year |
| overrideType | String | Yes | - | custom_amount, skip, paid |
| customAmount | Number | No | - | Override amount |
| isPaid | Boolean | No | false | Payment status |
| paidAt | Date | No | - | Payment date |
| paidAmount | Number | No | - | Actual paid amount |
| notes | String | No | - | Notes |
| createdAt | Date | Auto | - | Creation timestamp |
| updatedAt | Date | Auto | - | Last update timestamp |

**Unique Index:** `{ recurring: 1, month: 1, year: 1 }`

---

### 7. Goal
**Collection Name:** `goals`
**Purpose:** Savings and financial goals

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| name | String | Yes | - | Goal name |
| type | String | No | 'savings' | savings, expense_limit, income, investment, debt_payment |
| targetAmount | Number | Yes | - | Target amount |
| currentAmount | Number | No | 0 | Current progress |
| deadline | Date | No | - | Target date |
| color | String | No | '#3b82f6' | Display color |
| icon | String | No | 'target' | Icon name |
| status | String | No | 'active' | active, completed, cancelled |
| notes | String | No | - | Notes |
| createdAt | Date | Auto | - | Creation timestamp |
| updatedAt | Date | Auto | - | Last update timestamp |

**Virtuals:** progress, remaining, daysRemaining, forecast

---

### 8. Debt
**Collection Name:** `debts`
**Purpose:** Loans, financing, credit card debt

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| name | String | Yes | - | Debt name |
| type | String | Yes | - | emprestimo, financiamento, cartao_credito, cheque_especial, outro |
| totalAmount | Number | Yes | - | Total debt amount |
| remainingAmount | Number | Yes | - | Remaining balance |
| interestRate | Number | No | 0 | Interest rate (%) |
| installments | Number | No | 1 | Total installments |
| paidInstallments | Number | No | 0 | Paid installments |
| installmentAmount | Number | No | - | Monthly payment |
| dueDay | Number | No | - | Due day (1-31) |
| startDate | Date | No | now | Start date |
| creditor | String | No | - | Creditor name |
| notes | String | No | - | Notes |
| status | String | No | 'active' | active, paid, overdue |
| createdAt | Date | Auto | - | Creation timestamp |

**Virtuals:** progress, remainingInstallments, paidAmount, estimatedEndDate

---

### 9. Investment
**Collection Name:** `investments`
**Purpose:** Investment portfolio tracking

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| type | String | Yes | - | acao, fii, criptomoeda, renda_fixa, tesouro, fundo, outro |
| name | String | Yes | - | Asset name |
| ticker | String | No | - | Stock ticker (uppercase) |
| quantity | Number | Yes | - | Quantity owned |
| purchasePrice | Number | Yes | - | Purchase price per unit |
| currentPrice | Number | No | 0 | Current price per unit |
| purchaseDate | Date | No | now | Purchase date |
| notes | String | No | - | Notes |
| createdAt | Date | Auto | - | Creation timestamp |

**Virtuals:** totalInvested, currentValue, profit, profitPercentage

---

### 10. Budget
**Collection Name:** `budgets`
**Purpose:** Monthly spending budgets by category

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| category | String | Yes | - | Category name |
| amount | Number | Yes | - | Budget limit |
| month | Number | Yes | - | Month (1-12) |
| year | Number | Yes | - | Year |
| spent | Number | No | 0 | Amount spent |
| createdAt | Date | Auto | - | Creation timestamp |
| updatedAt | Date | Auto | - | Last update timestamp |

---

### 11. Bill
**Collection Name:** `bills`
**Purpose:** One-time bills and payments

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| name | String | Yes | - | Bill name |
| amount | Number | Yes | - | Bill amount |
| dueDate | Date | Yes | - | Due date |
| category | String | No | - | Category |
| isPaid | Boolean | No | false | Payment status |
| paidAt | Date | No | - | Payment date |
| notes | String | No | - | Notes |
| createdAt | Date | Auto | - | Creation timestamp |
| updatedAt | Date | Auto | - | Last update timestamp |

---

### 12. Settings
**Collection Name:** `settings`
**Purpose:** User preferences and configurations

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| currency | String | No | 'BRL' | Currency code |
| language | String | No | 'pt-BR' | Language code |
| theme | String | No | 'light' | light, dark, system |
| notifications | Object | No | {} | Notification preferences |
| privacy | Object | No | {} | Privacy settings |
| createdAt | Date | Auto | - | Creation timestamp |
| updatedAt | Date | Auto | - | Last update timestamp |

---

### 13. Notification
**Collection Name:** `notifications`
**Purpose:** User notifications

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| user | ObjectId | Yes | - | Reference to User |
| type | String | Yes | - | Notification type |
| title | String | Yes | - | Title |
| message | String | Yes | - | Message body |
| isRead | Boolean | No | false | Read status |
| readAt | Date | No | - | Read timestamp |
| data | Object | No | {} | Extra data |
| createdAt | Date | Auto | - | Creation timestamp |

---

### 14. TokenBlacklist
**Collection Name:** `tokenblacklists`
**Purpose:** Revoked JWT tokens

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| _id | ObjectId | Auto | - | Primary key |
| token | String | Yes | - | JWT token |
| user | ObjectId | Yes | - | Reference to User |
| expiresAt | Date | Yes | - | Token expiry |
| reason | String | No | - | Revocation reason |
| createdAt | Date | Auto | - | Creation timestamp |

**TTL Index:** `expiresAt` (auto-delete after expiry)

---

## Relationships

### Primary Relationships (User-centric)
```
User (1) ──────< (N) Transaction
User (1) ──────< (N) Account
User (1) ──────< (N) Category
User (1) ──────< (N) Recurring
User (1) ──────< (N) Goal
User (1) ──────< (N) Debt
User (1) ──────< (N) Investment
User (1) ──────< (N) Budget
User (1) ──────< (N) Bill
User (1) ──────< (N) Notification
User (1) ──────< (1) Settings
```

### Secondary Relationships
```
Account (1) ──────< (N) Transaction
Recurring (1) ──────< (N) RecurringOverride
Recurring (1) ──────< (N) Transaction (via recurringId)
```

---

## Indexes

### Performance Indexes
```javascript
// Users
{ email: 1 }  // Unique

// Transactions
{ user: 1, date: -1 }
{ user: 1, category: 1 }
{ user: 1, account: 1, date: -1 }
{ installmentGroupId: 1 }
{ tags: 1 }

// Accounts
{ user: 1, isActive: 1 }

// Categories
{ user: 1, name: 1, type: 1 }  // Unique

// Recurrings
{ user: 1, isActive: 1 }
{ nextDueDate: 1 }

// RecurringOverrides
{ recurring: 1, month: 1, year: 1 }  // Unique

// Goals
{ user: 1 }

// Debts
{ user: 1 }
{ user: 1, status: 1 }
{ user: 1, type: 1 }

// Investments
{ user: 1 }
{ user: 1, type: 1 }
{ user: 1, ticker: 1 }

// TokenBlacklist
{ token: 1 }  // Unique
{ expiresAt: 1 }  // TTL
```

---

## Data Types

### Common Field Patterns

| Pattern | Type | Example |
|---------|------|---------|
| Money | Number | 1234.56 |
| Date | Date | ISODate("2025-12-29T00:00:00Z") |
| ObjectId | ObjectId | ObjectId("693d290f2a47ef4d544f1616") |
| Boolean | Boolean | true/false |
| Percentage | Number | 12.5 (stored as number, not 0.125) |
| Color | String | "#3b82f6" (hex) |
| Icon | String | "Wallet" (Lucide icon name) |

### Enums

```javascript
// Transaction type
['income', 'expense', 'transfer']

// Account type
['checking', 'savings', 'credit_card', 'cash', 'investment', 'other']

// Recurring frequency
['daily', 'weekly', 'biweekly', 'monthly', 'yearly']

// Goal type
['savings', 'expense_limit', 'income', 'investment', 'debt_payment']

// Debt type
['emprestimo', 'financiamento', 'cartao_credito', 'cheque_especial', 'outro']

// Investment type
['acao', 'fii', 'criptomoeda', 'renda_fixa', 'tesouro', 'fundo', 'outro']

// Goal/Debt status
['active', 'completed', 'cancelled', 'paid', 'overdue']

// User plan
['free', 'premium', 'business']

// Theme
['light', 'dark', 'system']
```

---

## Business Rules

### 1. User Data Isolation
- All queries MUST filter by `user: req.user._id`
- Never expose data from other users
- Cascade delete all user data when deleting user

### 2. Transaction Rules
- `amount` must be > 0
- `type` determines how balance is affected:
  - `income`: increases balance
  - `expense`: decreases balance
  - `transfer`: decreases from account, increases toAccount

### 3. Recurring Rules
- Bills are generated based on `frequency` and `dayOfMonth`
- Overrides can skip months, change amounts, or mark as paid
- Only one override per recurring/month/year combination

### 4. Account Rules
- Balance is calculated from initialBalance + transactions
- Credit cards have special fields (limit, closingDay, dueDay)
- `includeInTotal: false` excludes from patrimony calculations

### 5. Goal Rules
- `currentAmount` can never exceed `targetAmount`
- Automatically marks as `completed` when target reached
- `deadline` is optional but enables forecasting

### 6. Category Rules
- Categories are user-specific (not global)
- Unique per user + name + type
- Auto-capitalize names

### 7. Security Rules
- Passwords hashed with bcrypt (10 rounds)
- Account locks after 5 failed attempts (30 min)
- JWT tokens can be blacklisted
- 2FA is optional but recommended

---

## Maintenance

### Daily Tasks
- Monitor TokenBlacklist TTL cleanup
- Check for overdue bills notifications

### Weekly Tasks
- Run database audit script
- Review orphan records

### Monthly Tasks
- Backup verification
- Index performance review
- Storage usage check

---

**Document Version:** 1.0
**Author:** MoneyTrack Development Team
**Contact:** support@moneytrack.app
