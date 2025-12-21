/**
 * Script de Análise Completa e Ajuste de Categorias
 * Análise detalhada com dezembro/2025 como referência
 */

const mongoose = require('mongoose');
require('dotenv').config();

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: String,
  category: String,
  description: String,
  amount: Number,
  date: Date,
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  tags: [String]
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

async function fullAnalysis() {
  try {
    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado!\n');

    const allTransactions = await Transaction.find({}).sort({ date: -1 });
    console.log(`📊 Total de transações: ${allTransactions.length}\n`);

    // 1. Distribuição por mês/ano
    console.log('═'.repeat(70));
    console.log('📅 DISTRIBUIÇÃO DE TRANSAÇÕES POR MÊS/ANO');
    console.log('═'.repeat(70));

    const byMonthYear = {};
    allTransactions.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonthYear[key]) byMonthYear[key] = { count: 0, income: 0, expense: 0 };
      byMonthYear[key].count++;
      if (t.type === 'income') byMonthYear[key].income += t.amount;
      else byMonthYear[key].expense += t.amount;
    });

    Object.keys(byMonthYear).sort().forEach(key => {
      const data = byMonthYear[key];
      console.log(`  ${key}: ${data.count} transações | Receitas: R$ ${data.income.toFixed(2)} | Despesas: R$ ${data.expense.toFixed(2)}`);
    });

    // 2. Usar DEZEMBRO/2025 como referência
    const REFERENCE_MONTH = 11; // 11 = Dezembro (0-indexed)
    const REFERENCE_YEAR = 2025;

    const decemberTransactions = allTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === REFERENCE_MONTH && d.getFullYear() === REFERENCE_YEAR;
    });

    console.log('\n' + '═'.repeat(70));
    console.log(`📅 TRANSAÇÕES DE DEZEMBRO/${REFERENCE_YEAR} (REFERÊNCIA)`);
    console.log('═'.repeat(70));
    console.log(`Total: ${decemberTransactions.length} transações\n`);

    // Listar todas as transações de dezembro organizadas por categoria
    const decByCat = {};
    decemberTransactions.forEach(t => {
      if (!decByCat[t.category]) decByCat[t.category] = [];
      decByCat[t.category].push(t);
    });

    console.log('Transações de Dezembro por Categoria:');
    console.log('-'.repeat(70));

    Object.keys(decByCat).sort().forEach(cat => {
      console.log(`\n  📁 ${cat.toUpperCase()} (${decByCat[cat].length} transações)`);
      decByCat[cat].forEach(t => {
        const d = new Date(t.date);
        console.log(`     ${t.type === 'income' ? '💰' : '💸'} "${t.description}" - R$ ${t.amount.toFixed(2)} (${d.toLocaleDateString('pt-BR')})`);
      });
    });

    // 3. Criar mapa de padrões (descrição -> categoria)
    const categoryMap = {};
    decemberTransactions.forEach(t => {
      // Normalizar descrição para comparação
      const descNormalized = t.description.toLowerCase().trim();
      categoryMap[descNormalized] = {
        category: t.category,
        type: t.type,
        originalDescription: t.description
      };
    });

    // 4. Analisar meses anteriores a dezembro/2025
    const previousMonths = allTransactions.filter(t => {
      const d = new Date(t.date);
      // Meses anteriores a dezembro/2025
      return d < new Date(REFERENCE_YEAR, REFERENCE_MONTH, 1);
    });

    console.log('\n' + '═'.repeat(70));
    console.log('🔍 ANÁLISE DOS MESES ANTERIORES A DEZEMBRO/2025');
    console.log('═'.repeat(70));
    console.log(`Total de transações anteriores: ${previousMonths.length}\n`);

    // 5. Identificar inconsistências
    const inconsistencies = [];
    const uniqueItems = [];
    const alreadyCorrect = [];

    previousMonths.forEach(t => {
      const descNormalized = t.description.toLowerCase().trim();
      const reference = categoryMap[descNormalized];

      if (reference) {
        // Existe em dezembro - verificar categoria
        if (t.category !== reference.category) {
          inconsistencies.push({
            _id: t._id,
            description: t.description,
            currentCategory: t.category,
            expectedCategory: reference.category,
            date: t.date,
            amount: t.amount,
            type: t.type
          });
        } else {
          alreadyCorrect.push(t);
        }
      } else {
        // Não existe em dezembro - compra única
        uniqueItems.push({
          _id: t._id,
          description: t.description,
          category: t.category,
          date: t.date,
          amount: t.amount,
          type: t.type
        });
      }
    });

    // Mostrar inconsistências
    console.log(`❌ INCONSISTÊNCIAS ENCONTRADAS: ${inconsistencies.length}`);
    console.log('-'.repeat(70));

    if (inconsistencies.length > 0) {
      // Agrupar por descrição
      const grouped = {};
      inconsistencies.forEach(inc => {
        const key = inc.description.toLowerCase().trim();
        if (!grouped[key]) {
          grouped[key] = {
            description: inc.description,
            currentCategory: inc.currentCategory,
            expectedCategory: inc.expectedCategory,
            items: []
          };
        }
        grouped[key].items.push(inc);
      });

      Object.values(grouped).forEach(g => {
        console.log(`\n  📌 "${g.description}"`);
        console.log(`     ❌ Categoria Atual: ${g.currentCategory}`);
        console.log(`     ✅ Deveria ser: ${g.expectedCategory}`);
        console.log(`     📊 ${g.items.length} ocorrência(s) para corrigir:`);
        g.items.forEach(item => {
          const d = new Date(item.date);
          console.log(`        - ${d.toLocaleDateString('pt-BR')}: R$ ${item.amount.toFixed(2)}`);
        });
      });
    } else {
      console.log('  ✅ Nenhuma inconsistência encontrada!');
    }

    // Mostrar itens únicos (por categoria)
    console.log(`\n📦 COMPRAS ÚNICAS (serão mantidas): ${uniqueItems.length}`);

    if (uniqueItems.length > 0) {
      const uniqueByCat = {};
      uniqueItems.forEach(item => {
        if (!uniqueByCat[item.category]) uniqueByCat[item.category] = [];
        uniqueByCat[item.category].push(item);
      });

      Object.keys(uniqueByCat).sort().forEach(cat => {
        console.log(`\n  📁 ${cat} (${uniqueByCat[cat].length})`);
        uniqueByCat[cat].slice(0, 5).forEach(item => {
          const d = new Date(item.date);
          console.log(`     - "${item.description}" - R$ ${item.amount.toFixed(2)} (${d.toLocaleDateString('pt-BR')})`);
        });
        if (uniqueByCat[cat].length > 5) {
          console.log(`     ... e mais ${uniqueByCat[cat].length - 5}`);
        }
      });
    }

    // RESUMO
    console.log('\n' + '═'.repeat(70));
    console.log('📊 RESUMO FINAL');
    console.log('═'.repeat(70));
    console.log(`  Total de transações: ${allTransactions.length}`);
    console.log(`  Dezembro/2025 (referência): ${decemberTransactions.length}`);
    console.log(`  Meses anteriores: ${previousMonths.length}`);
    console.log(`  ✅ Já corretas: ${alreadyCorrect.length}`);
    console.log(`  ❌ Inconsistências a corrigir: ${inconsistencies.length}`);
    console.log(`  📦 Compras únicas (manter): ${uniqueItems.length}`);

    // Salvar relatório
    const fs = require('fs');
    const report = {
      referenceMonth: `${REFERENCE_YEAR}-${REFERENCE_MONTH + 1}`,
      categoryMap,
      inconsistencies,
      uniqueItems,
      summary: {
        total: allTransactions.length,
        reference: decemberTransactions.length,
        previous: previousMonths.length,
        correct: alreadyCorrect.length,
        toFix: inconsistencies.length,
        unique: uniqueItems.length
      }
    };

    fs.writeFileSync(
      '/Users/eduardobarreira/Desktop/finance-app/backend/scripts/full-analysis-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\n✅ Relatório salvo em: scripts/full-analysis-report.json');

    await mongoose.disconnect();
    return report;

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fullAnalysis();
