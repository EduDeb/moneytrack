/**
 * Script de Teste das APIs
 * Testa todas as rotas principais do MoneyTrack
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:3001/api';
const EMAIL = 'testeapi@teste.com';
const PASSWORD = 'Teste123';

let token = '';
let testsPassed = 0;
let testsFailed = 0;

async function request(method, path, body = null, useToken = true) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (useToken && token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function logTest(name, success, details = '') {
  if (success) {
    console.log(`✅ ${name}`);
    testsPassed++;
  } else {
    console.log(`❌ ${name} - ${details}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('═'.repeat(60));
  console.log('     MONEYTRACK API TEST SUITE');
  console.log('═'.repeat(60));
  console.log('');

  // 1. Health Check
  console.log('📋 1. Health Check');
  try {
    const health = await request('GET', '/health', null, false);
    logTest('Health Check', health.status === 200 && health.data.status === 'OK');
  } catch (e) {
    logTest('Health Check', false, e.message);
  }

  // 2. Login
  console.log('\n📋 2. Authentication');
  try {
    const login = await request('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, false);
    if (login.status === 200 && (login.data.accessToken || login.data.token)) {
      token = login.data.accessToken || login.data.token;
      logTest('Login', true);
    } else {
      logTest('Login', false, `Token not received. Response: ${JSON.stringify(login.data)}`);
      return; // Can't continue without token
    }
  } catch (e) {
    logTest('Login', false, e.message);
    return;
  }

  // 3. Transactions
  console.log('\n📋 3. Transactions');
  try {
    const trans = await request('GET', '/transactions?month=12&year=2025&limit=10');
    logTest('GET /transactions', trans.status === 200 && trans.data.transactions);

    const summary = await request('GET', '/transactions/summary?month=12&year=2025');
    logTest('GET /transactions/summary',
      summary.status === 200 &&
      typeof summary.data.income === 'number' &&
      typeof summary.data.expenses === 'number',
      `Income: ${summary.data.income}, Expenses: ${summary.data.expenses}`
    );
  } catch (e) {
    logTest('Transactions', false, e.message);
  }

  // 4. Bills
  console.log('\n📋 4. Bills');
  try {
    const bills = await request('GET', '/bills?month=12&year=2025');
    logTest('GET /bills', bills.status === 200);

    const billsSummary = await request('GET', '/bills/summary?month=12&year=2025');
    logTest('GET /bills/summary',
      billsSummary.status === 200 &&
      typeof billsSummary.data.total === 'number',
      `Total: ${billsSummary.data.total}, Paid: ${billsSummary.data.paid}, Pending: ${billsSummary.data.pending}`
    );

    // Verificar precisao monetaria
    const hasPrecision = !String(billsSummary.data.total).includes('00000000');
    logTest('Monetary Precision', hasPrecision,
      hasPrecision ? 'No floating point issues' : `Found: ${billsSummary.data.total}`);
  } catch (e) {
    logTest('Bills', false, e.message);
  }

  // 5. Accounts
  console.log('\n📋 5. Accounts');
  try {
    const accounts = await request('GET', '/accounts');
    logTest('GET /accounts', accounts.status === 200 && accounts.data.accounts);
    console.log(`   → ${accounts.data.accounts?.length || 0} accounts found`);
  } catch (e) {
    logTest('Accounts', false, e.message);
  }

  // 6. Categories
  console.log('\n📋 6. Categories');
  try {
    const categories = await request('GET', '/categories');
    // Status 200 with array is success (empty array is ok for new users)
    logTest('GET /categories', categories.status === 200);
    console.log(`   → ${Array.isArray(categories.data) ? categories.data.length : 0} categories found`);
  } catch (e) {
    logTest('Categories', false, e.message);
  }

  // 7. Recurring
  console.log('\n📋 7. Recurring');
  try {
    const recurring = await request('GET', '/recurring');
    logTest('GET /recurring', recurring.status === 200);
    console.log(`   → ${Array.isArray(recurring.data) ? recurring.data.length : 0} recurring items found`);
  } catch (e) {
    logTest('Recurring', false, e.message);
  }

  // 8. Goals
  console.log('\n📋 8. Goals');
  try {
    const goals = await request('GET', '/goals');
    logTest('GET /goals', goals.status === 200);
    console.log(`   → ${Array.isArray(goals.data) ? goals.data.length : 0} goals found`);
  } catch (e) {
    logTest('Goals', false, e.message);
  }

  // 9. Patrimony
  console.log('\n📋 9. Patrimony');
  try {
    const patrimony = await request('GET', '/patrimony/summary');
    logTest('GET /patrimony/summary', patrimony.status === 200);
  } catch (e) {
    logTest('Patrimony', false, e.message);
  }

  // 10. Reports
  console.log('\n📋 10. Reports');
  try {
    const reports = await request('GET', '/reports/monthly?month=12&year=2025');
    // 200 or 404 (no data) are acceptable
    logTest('GET /reports/monthly', reports.status === 200 || reports.status === 404);
  } catch (e) {
    logTest('Reports', false, e.message);
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('     TEST RESULTS');
  console.log('═'.repeat(60));
  console.log(`  ✅ Passed: ${testsPassed}`);
  console.log(`  ❌ Failed: ${testsFailed}`);
  console.log(`  📊 Total:  ${testsPassed + testsFailed}`);
  console.log('═'.repeat(60));

  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }
}

runTests().catch(console.error);
