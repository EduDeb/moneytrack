const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Transaction = mongoose.model('Transaction', new mongoose.Schema({}, { strict: false }));
  const Recurring = mongoose.model('Recurring', new mongoose.Schema({}, { strict: false }));
  const RecurringPayment = mongoose.model('RecurringPayment', new mongoose.Schema({}, { strict: false }));
  const Bill = mongoose.model('Bill', new mongoose.Schema({}, { strict: false }));
  const Account = mongoose.model('Account', new mongoose.Schema({}, { strict: false }));

  const userId = new mongoose.Types.ObjectId('693d290f2a47ef4d544f1616');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           AUDITORIA FINANCEIRA COMPLETA                      ║');
  console.log('║                  DEZEMBRO 2025                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // ============================================================
  // 1. TRANSAÇÕES DE DEZEMBRO 2025
  // ============================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('1. TRANSAÇÕES DE DEZEMBRO 2025');
  console.log('═══════════════════════════════════════════════════════════════');

  const startDec = new Date('2025-12-01T00:00:00.000Z');
  const endDec = new Date('2025-12-31T23:59:59.999Z');

  const transacoesDez = await Transaction.find({
    user: userId,
    date: { $gte: startDec, $lte: endDec }
  }).lean();

  const receitasDez = transacoesDez.filter(t => t.type === 'income');
  const despesasDez = transacoesDez.filter(t => t.type === 'expense');

  const totalReceitasDez = receitasDez.reduce((sum, t) => sum + t.amount, 0);
  const totalDespesasDez = despesasDez.reduce((sum, t) => sum + t.amount, 0);
  const saldoDez = totalReceitasDez - totalDespesasDez;

  console.log(`Receitas: ${receitasDez.length} transações = R$ ${totalReceitasDez.toFixed(2)}`);
  console.log(`Despesas: ${despesasDez.length} transações = R$ ${totalDespesasDez.toFixed(2)}`);
  console.log(`Saldo do mês: R$ ${saldoDez.toFixed(2)}`);
  console.log('');

  // Listar despesas para conferência
  console.log('Despesas detalhadas:');
  despesasDez.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    const date = new Date(t.date).toISOString().split('T')[0];
    console.log(`  ${date} | R$ ${t.amount.toFixed(2).padStart(10)} | ${t.description}`);
  });
  console.log('');

  // ============================================================
  // 2. RECORRÊNCIAS ATIVAS
  // ============================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('2. RECORRÊNCIAS ATIVAS');
  console.log('═══════════════════════════════════════════════════════════════');

  const recorrencias = await Recurring.find({
    user: userId,
    isActive: true
  }).lean();

  const recorrenciasMensais = recorrencias.filter(r => r.frequency === 'monthly');
  const recorrenciasSemanais = recorrencias.filter(r => r.frequency === 'weekly');

  const totalMensais = recorrenciasMensais.reduce((sum, r) => sum + r.amount, 0);
  const totalSemanais = recorrenciasSemanais.reduce((sum, r) => sum + r.amount, 0);

  console.log(`Mensais: ${recorrenciasMensais.length} recorrências = R$ ${totalMensais.toFixed(2)}/mês`);
  console.log(`Semanais: ${recorrenciasSemanais.length} recorrências = R$ ${totalSemanais.toFixed(2)}/semana`);
  console.log('');

  // Recorrências que se aplicam a dezembro 2025
  const recDezembro = recorrencias.filter(r => {
    const start = new Date(r.startDate);
    const end = r.endDate ? new Date(r.endDate) : null;
    return start <= endDec && (!end || end >= startDec);
  });

  // Calcular total esperado em dezembro
  let totalRecorrenciasDez = 0;
  recDezembro.forEach(r => {
    if (r.frequency === 'monthly') {
      totalRecorrenciasDez += r.amount;
    } else if (r.frequency === 'weekly') {
      // Contar quantas semanas no mês
      const dayOfWeek = r.dayOfWeek !== undefined ? r.dayOfWeek : new Date(r.startDate).getDay();
      let count = 0;
      for (let day = 1; day <= 31; day++) {
        const d = new Date(2025, 11, day);
        if (d.getMonth() === 11 && d.getDay() === dayOfWeek) {
          if (d >= new Date(r.startDate) && (!r.endDate || d <= new Date(r.endDate))) {
            count++;
          }
        }
      }
      totalRecorrenciasDez += r.amount * count;
    }
  });

  console.log(`Recorrências aplicáveis a dezembro: ${recDezembro.length}`);
  console.log(`Total esperado em contas (dezembro): R$ ${totalRecorrenciasDez.toFixed(2)}`);
  console.log('');

  // ============================================================
  // 3. PAGAMENTOS DE RECORRÊNCIAS (DEZEMBRO)
  // ============================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('3. PAGAMENTOS DE RECORRÊNCIAS (DEZEMBRO 2025)');
  console.log('═══════════════════════════════════════════════════════════════');

  const pagamentosDez = await RecurringPayment.find({
    user: userId,
    month: 12,
    year: 2025
  }).lean();

  // Buscar nomes das recorrências separadamente
  const recurringIds = pagamentosDez.map(p => p.recurring);
  const recorrenciasMap = {};
  const recorrenciasInfo = await Recurring.find({ _id: { $in: recurringIds } }).lean();
  recorrenciasInfo.forEach(r => {
    recorrenciasMap[r._id.toString()] = r;
  });

  const totalPagoRecorrencias = pagamentosDez.reduce((sum, p) => sum + p.amountPaid, 0);

  console.log(`Pagamentos registrados: ${pagamentosDez.length}`);
  console.log(`Total pago em recorrências: R$ ${totalPagoRecorrencias.toFixed(2)}`);
  console.log('');
  console.log('Detalhes:');
  pagamentosDez.forEach(p => {
    const nome = p.recurring?.name || 'Recorrência removida';
    console.log(`  R$ ${p.amountPaid.toFixed(2).padStart(10)} | ${nome}`);
  });
  console.log('');

  // ============================================================
  // 4. BILLS DIRETAS (DEZEMBRO)
  // ============================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('4. BILLS DIRETAS (DEZEMBRO 2025)');
  console.log('═══════════════════════════════════════════════════════════════');

  const billsDez = await Bill.find({
    user: userId,
    currentMonth: 12,
    currentYear: 2025
  }).lean();

  const billsPagas = billsDez.filter(b => b.isPaid);
  const billsPendentes = billsDez.filter(b => !b.isPaid);
  const totalBillsPagas = billsPagas.reduce((sum, b) => sum + b.amount, 0);
  const totalBillsPendentes = billsPendentes.reduce((sum, b) => sum + b.amount, 0);

  console.log(`Bills totais: ${billsDez.length}`);
  console.log(`Bills pagas: ${billsPagas.length} = R$ ${totalBillsPagas.toFixed(2)}`);
  console.log(`Bills pendentes: ${billsPendentes.length} = R$ ${totalBillsPendentes.toFixed(2)}`);
  console.log('');
  if (billsDez.length > 0) {
    console.log('Detalhes:');
    billsDez.forEach(b => {
      const status = b.isPaid ? '[PAGA]' : '[PEND]';
      console.log(`  ${status} R$ ${b.amount.toFixed(2).padStart(10)} | ${b.name}`);
    });
    console.log('');
  }

  // ============================================================
  // 5. CONTAS (ACCOUNTS)
  // ============================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('5. CONTAS BANCÁRIAS');
  console.log('═══════════════════════════════════════════════════════════════');

  const contas = await Account.find({ user: userId }).lean();
  const totalContas = contas.reduce((sum, c) => sum + (c.balance || 0), 0);

  console.log(`Total de contas: ${contas.length}`);
  contas.forEach(c => {
    console.log(`  R$ ${(c.balance || 0).toFixed(2).padStart(12)} | ${c.name}`);
  });
  console.log(`  ${'─'.repeat(30)}`);
  console.log(`  R$ ${totalContas.toFixed(2).padStart(12)} | TOTAL`);
  console.log('');

  // ============================================================
  // 6. VERIFICAÇÃO DE CONSISTÊNCIA
  // ============================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('6. VERIFICAÇÃO DE CONSISTÊNCIA');
  console.log('═══════════════════════════════════════════════════════════════');

  // Total de despesas em transações vs pagamentos
  const despesasDeRecorrencias = despesasDez.filter(t => t.recurringId);
  const totalDespesasRecorrencias = despesasDeRecorrencias.reduce((sum, t) => sum + t.amount, 0);

  console.log('DESPESAS:');
  console.log(`  Transações de despesa (total): R$ ${totalDespesasDez.toFixed(2)}`);
  console.log(`  - De recorrências: R$ ${totalDespesasRecorrencias.toFixed(2)} (${despesasDeRecorrencias.length} trans.)`);
  console.log(`  - Outras despesas: R$ ${(totalDespesasDez - totalDespesasRecorrencias).toFixed(2)}`);
  console.log('');

  console.log('PAGAMENTOS DE RECORRÊNCIAS:');
  console.log(`  RecurringPayments registrados: R$ ${totalPagoRecorrencias.toFixed(2)}`);
  console.log(`  Transações com recurringId: R$ ${totalDespesasRecorrencias.toFixed(2)}`);

  if (Math.abs(totalPagoRecorrencias - totalDespesasRecorrencias) > 0.01) {
    console.log(`  ⚠️  DIFERENÇA: R$ ${Math.abs(totalPagoRecorrencias - totalDespesasRecorrencias).toFixed(2)}`);
  } else {
    console.log(`  ✅ Valores consistentes`);
  }
  console.log('');

  // ============================================================
  // 7. RESUMO ESPERADO VS API
  // ============================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('7. CÁLCULO MANUAL DO SUMMARY (DEZEMBRO 2025)');
  console.log('═══════════════════════════════════════════════════════════════');

  // Recalcular o que a API deveria retornar
  // Recorrências mensais de dezembro
  const recMensaisDez = recorrenciasMensais.filter(r => {
    const start = new Date(r.startDate);
    const end = r.endDate ? new Date(r.endDate) : null;
    const startMonth = start.getUTCMonth() + 1;
    const startYear = start.getUTCFullYear();

    // Começa antes ou durante dezembro 2025
    if (startYear > 2025 || (startYear === 2025 && startMonth > 12)) return false;
    // Não terminou antes de dezembro 2025
    if (end && end < startDec) return false;
    return true;
  });

  // Recorrências semanais de dezembro
  const recSemanaisDez = recorrenciasSemanais.filter(r => {
    const start = new Date(r.startDate);
    const end = r.endDate ? new Date(r.endDate) : null;
    // Começa antes ou durante dezembro 2025
    if (start > endDec) return false;
    // Não terminou antes de dezembro 2025
    if (end && end < startDec) return false;
    return true;
  });

  // Calcular total de recorrências mensais
  const totalRecMensaisDez = recMensaisDez.reduce((sum, r) => sum + r.amount, 0);

  // Calcular total de recorrências semanais (contando semanas)
  let totalRecSemanaisDez = 0;
  let detalhesSemanais = [];
  recSemanaisDez.forEach(r => {
    const dayOfWeek = r.dayOfWeek !== undefined ? r.dayOfWeek : new Date(r.startDate).getUTCDay();
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      const d = new Date(Date.UTC(2025, 11, day, 12, 0, 0));
      if (d.getUTCMonth() === 11 && d.getUTCDay() === dayOfWeek) {
        const rStart = new Date(r.startDate);
        const rEnd = r.endDate ? new Date(r.endDate) : null;
        if (d >= rStart && (!rEnd || d <= rEnd)) {
          count++;
        }
      }
    }
    totalRecSemanaisDez += r.amount * count;
    detalhesSemanais.push({ name: r.name, count, amount: r.amount, total: r.amount * count });
  });

  // Total de bills
  const totalBillsDez = billsDez.reduce((sum, b) => sum + b.amount, 0);

  // Total geral esperado
  const totalEsperado = totalRecMensaisDez + totalRecSemanaisDez + totalBillsDez;

  // IDs de recorrências pagas
  const paidRecurringIds = new Set(pagamentosDez.map(p => p.recurring?._id?.toString() || p.recurring?.toString()));

  // Calcular pago e pendente
  let pagoDezCalc = totalBillsPagas;
  let pendenteDezCalc = totalBillsPendentes;

  recMensaisDez.forEach(r => {
    if (paidRecurringIds.has(r._id.toString())) {
      pagoDezCalc += r.amount;
    } else {
      pendenteDezCalc += r.amount;
    }
  });

  // Para semanais, considerar todas pendentes por enquanto (sistema simplificado)
  pendenteDezCalc += totalRecSemanaisDez;

  console.log('RECORRÊNCIAS MENSAIS:');
  console.log(`  Quantidade: ${recMensaisDez.length}`);
  console.log(`  Total: R$ ${totalRecMensaisDez.toFixed(2)}`);
  console.log('');

  console.log('RECORRÊNCIAS SEMANAIS:');
  console.log(`  Quantidade: ${recSemanaisDez.length}`);
  if (detalhesSemanais.length > 0) {
    detalhesSemanais.forEach(d => {
      console.log(`    ${d.name}: ${d.count} semanas x R$ ${d.amount.toFixed(2)} = R$ ${d.total.toFixed(2)}`);
    });
  }
  console.log(`  Total: R$ ${totalRecSemanaisDez.toFixed(2)}`);
  console.log('');

  console.log('BILLS DIRETAS:');
  console.log(`  Quantidade: ${billsDez.length}`);
  console.log(`  Total: R$ ${totalBillsDez.toFixed(2)}`);
  console.log('');

  console.log('TOTAIS CALCULADOS:');
  console.log(`  Total esperado: R$ ${totalEsperado.toFixed(2)}`);
  console.log(`  Pago: R$ ${pagoDezCalc.toFixed(2)}`);
  console.log(`  Pendente: R$ ${pendenteDezCalc.toFixed(2)}`);
  console.log('');

  // ============================================================
  // 8. SALDO ACUMULADO
  // ============================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('8. SALDO ACUMULADO (TODAS AS TRANSAÇÕES)');
  console.log('═══════════════════════════════════════════════════════════════');

  const todasTransacoes = await Transaction.find({ user: userId }).lean();
  const totalReceitas = todasTransacoes.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalDespesas = todasTransacoes.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const saldoAcumulado = totalReceitas - totalDespesas;

  console.log(`Total de transações: ${todasTransacoes.length}`);
  console.log(`Total receitas: R$ ${totalReceitas.toFixed(2)}`);
  console.log(`Total despesas: R$ ${totalDespesas.toFixed(2)}`);
  console.log(`Saldo acumulado: R$ ${saldoAcumulado.toFixed(2)}`);
  console.log('');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    FIM DA AUDITORIA                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  process.exit(0);
}).catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
