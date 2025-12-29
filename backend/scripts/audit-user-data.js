const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// SEGURANÇA: Usa variável de ambiente em vez de credenciais hardcoded
const MONGODB_URI = process.env.MONGODB_URI;
const USER_ID = process.env.AUDIT_USER_ID || '693d290f2a47ef4d544f1616';

if (!MONGODB_URI) {
  console.error('ERRO: MONGODB_URI não definida no .env');
  process.exit(1);
}

async function auditUserData() {
  try {
    console.log('='.repeat(60));
    console.log('AUDITORIA COMPLETA DOS DADOS DO USUÁRIO');
    console.log('='.repeat(60));

    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const userObjectId = new mongoose.Types.ObjectId(USER_ID);

    // 1. VERIFICAR USUÁRIO
    console.log('\n1. DADOS DO USUÁRIO');
    console.log('-'.repeat(40));
    const user = await db.collection('users').findOne({ _id: userObjectId });
    if (user) {
      console.log(`Nome: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Plano: ${user.plan || 'free'}`);
      console.log(`Criado em: ${user.createdAt}`);
    }

    // 2. CONTAR REGISTROS POR COLEÇÃO
    console.log('\n2. QUANTIDADE DE REGISTROS POR COLEÇÃO');
    console.log('-'.repeat(40));
    const collections = ['transactions', 'recurrings', 'recurringoverrides', 'recurringpayments', 'accounts', 'categories', 'goals', 'debts', 'investments', 'budgets'];

    for (const coll of collections) {
      const count = await db.collection(coll).countDocuments({ user: userObjectId });
      const countString = await db.collection(coll).countDocuments({ user: USER_ID });
      console.log(`${coll}: ${count} (ObjectId) / ${countString} (String)`);
    }

    // 3. VERIFICAR TRANSAÇÕES
    console.log('\n3. RESUMO DE TRANSAÇÕES');
    console.log('-'.repeat(40));
    const transactions = await db.collection('transactions').find({ user: userObjectId }).toArray();

    const incomeTotal = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    console.log(`Total de transações: ${transactions.length}`);
    console.log(`Receitas: R$ ${incomeTotal.toFixed(2)}`);
    console.log(`Despesas: R$ ${expenseTotal.toFixed(2)}`);
    console.log(`Saldo: R$ ${(incomeTotal - expenseTotal).toFixed(2)}`);

    // Transações por mês
    const byMonth = {};
    transactions.forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { income: 0, expense: 0, count: 0 };
      byMonth[key].count++;
      if (t.type === 'income') byMonth[key].income += t.amount;
      if (t.type === 'expense') byMonth[key].expense += t.amount;
    });

    console.log('\nTransações por mês:');
    Object.keys(byMonth).sort().forEach(month => {
      const m = byMonth[month];
      console.log(`  ${month}: ${m.count} transações | Receita: R$ ${m.income.toFixed(2)} | Despesa: R$ ${m.expense.toFixed(2)}`);
    });

    // 4. VERIFICAR RECORRÊNCIAS
    console.log('\n4. RECORRÊNCIAS');
    console.log('-'.repeat(40));
    const recurrings = await db.collection('recurrings').find({ user: userObjectId }).toArray();
    console.log(`Total de recorrências: ${recurrings.length}`);

    const activeRec = recurrings.filter(r => r.isActive);
    const inactiveRec = recurrings.filter(r => !r.isActive);
    console.log(`Ativas: ${activeRec.length}`);
    console.log(`Inativas: ${inactiveRec.length}`);

    // Total de despesas recorrentes mensais
    const monthlyRecurring = activeRec
      .filter(r => r.frequency === 'monthly' && r.type !== 'income')
      .reduce((sum, r) => sum + r.amount, 0);
    console.log(`Total mensal em recorrências: R$ ${monthlyRecurring.toFixed(2)}`);

    // Listar recorrências ativas
    console.log('\nRecorrências ativas:');
    activeRec.sort((a, b) => b.amount - a.amount).forEach(r => {
      const end = r.endDate ? new Date(r.endDate).toLocaleDateString('pt-BR') : 'Sem fim';
      console.log(`  ${r.name}: R$ ${r.amount.toFixed(2)} (${r.frequency}) - Fim: ${end}`);
    });

    // 5. VERIFICAR OVERRIDES
    console.log('\n5. OVERRIDES DE RECORRÊNCIA');
    console.log('-'.repeat(40));
    const overrides = await db.collection('recurringoverrides').find({}).toArray();
    console.log(`Total de overrides: ${overrides.length}`);

    overrides.forEach(o => {
      const rec = recurrings.find(r => r._id.toString() === o.recurring?.toString());
      console.log(`  ${o.month}/${o.year}: ${rec?.name || 'N/A'} - Tipo: ${o.type || 'N/A'} - Valor: R$ ${o.amount || 0}`);
    });

    // 6. VERIFICAR CONTAS
    console.log('\n6. CONTAS');
    console.log('-'.repeat(40));
    const accounts = await db.collection('accounts').find({ user: userObjectId }).toArray();
    console.log(`Total de contas: ${accounts.length}`);

    let totalBalance = 0;
    accounts.forEach(a => {
      console.log(`  ${a.name}: R$ ${(a.balance || 0).toFixed(2)} (${a.type})`);
      totalBalance += a.balance || 0;
    });
    console.log(`Saldo total: R$ ${totalBalance.toFixed(2)}`);

    // 7. VERIFICAR METAS
    console.log('\n7. METAS');
    console.log('-'.repeat(40));
    const goals = await db.collection('goals').find({ user: userObjectId }).toArray();
    console.log(`Total de metas: ${goals.length}`);

    goals.forEach(g => {
      const progress = g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(1) : 0;
      console.log(`  ${g.name}: R$ ${g.currentAmount?.toFixed(2) || 0} / R$ ${g.targetAmount?.toFixed(2) || 0} (${progress}%)`);
    });

    // 8. VERIFICAR DÍVIDAS
    console.log('\n8. DÍVIDAS');
    console.log('-'.repeat(40));
    const debts = await db.collection('debts').find({ user: userObjectId }).toArray();
    console.log(`Total de dívidas: ${debts.length}`);

    let totalDebt = 0;
    debts.forEach(d => {
      console.log(`  ${d.name}: R$ ${d.remainingAmount?.toFixed(2) || 0} restante de R$ ${d.totalAmount?.toFixed(2) || 0}`);
      totalDebt += d.remainingAmount || 0;
    });
    console.log(`Dívida total: R$ ${totalDebt.toFixed(2)}`);

    // 9. VERIFICAR INVESTIMENTOS
    console.log('\n9. INVESTIMENTOS');
    console.log('-'.repeat(40));
    const investments = await db.collection('investments').find({ user: userObjectId }).toArray();
    console.log(`Total de investimentos: ${investments.length}`);

    let totalInvested = 0;
    investments.forEach(i => {
      const value = (i.quantity || 0) * (i.currentPrice || i.purchasePrice || 0);
      console.log(`  ${i.name}: ${i.quantity} x R$ ${(i.currentPrice || i.purchasePrice || 0).toFixed(2)} = R$ ${value.toFixed(2)}`);
      totalInvested += value;
    });
    console.log(`Total investido: R$ ${totalInvested.toFixed(2)}`);

    // 10. VERIFICAR INCONSISTÊNCIAS
    console.log('\n10. VERIFICAÇÃO DE INCONSISTÊNCIAS');
    console.log('-'.repeat(40));

    // Verificar transações sem categoria
    const noCategory = transactions.filter(t => !t.category);
    console.log(`Transações sem categoria: ${noCategory.length}`);

    // Verificar transações com amount negativo
    const negativeAmount = transactions.filter(t => t.amount < 0);
    console.log(`Transações com valor negativo: ${negativeAmount.length}`);

    // Verificar recorrências sem startDate
    const noStartDate = recurrings.filter(r => !r.startDate);
    console.log(`Recorrências sem data de início: ${noStartDate.length}`);

    // Verificar contas com saldo negativo (não credit card)
    const negativeBalance = accounts.filter(a => a.balance < 0 && a.type !== 'credit');
    console.log(`Contas com saldo negativo (não cartão): ${negativeBalance.length}`);

    // 11. PATRIMÔNIO LÍQUIDO
    console.log('\n11. PATRIMÔNIO LÍQUIDO');
    console.log('-'.repeat(40));
    const netWorth = totalBalance + totalInvested - totalDebt;
    console.log(`Contas: R$ ${totalBalance.toFixed(2)}`);
    console.log(`Investimentos: R$ ${totalInvested.toFixed(2)}`);
    console.log(`Dívidas: R$ ${totalDebt.toFixed(2)}`);
    console.log(`PATRIMÔNIO LÍQUIDO: R$ ${netWorth.toFixed(2)}`);

    console.log('\n' + '='.repeat(60));
    console.log('AUDITORIA CONCLUÍDA');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Erro na auditoria:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

auditUserData();
