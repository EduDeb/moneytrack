/**
 * Script de Análise e Ajuste de Categorias
 * Usa dezembro como referência e padroniza os outros meses
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Modelo de Transaction
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

async function analyzeAndReport() {
  try {
    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado!\n');

    // 1. Buscar todas as transações
    const allTransactions = await Transaction.find({}).sort({ date: -1 });
    console.log(`📊 Total de transações: ${allTransactions.length}\n`);

    // 2. Separar transações de dezembro/2024
    const decemberTransactions = allTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === 11 && d.getFullYear() === 2024; // Dezembro = 11
    });

    console.log('═'.repeat(60));
    console.log('📅 TRANSAÇÕES DE DEZEMBRO/2024 (REFERÊNCIA)');
    console.log('═'.repeat(60));
    console.log(`Total: ${decemberTransactions.length} transações\n`);

    // 3. Criar mapa de descrição -> categoria de dezembro
    const categoryMap = {};
    const decemberByDescription = {};

    decemberTransactions.forEach(t => {
      const descLower = t.description.toLowerCase().trim();
      if (!decemberByDescription[descLower]) {
        decemberByDescription[descLower] = {
          category: t.category,
          type: t.type,
          count: 0,
          examples: []
        };
      }
      decemberByDescription[descLower].count++;
      decemberByDescription[descLower].examples.push({
        description: t.description,
        amount: t.amount,
        date: t.date
      });

      // Mapa para padronização
      categoryMap[descLower] = t.category;
    });

    // Mostrar categorização de dezembro
    console.log('Padrão de categorização em Dezembro:');
    console.log('-'.repeat(60));

    const sortedDescriptions = Object.entries(decemberByDescription)
      .sort((a, b) => b[1].count - a[1].count);

    sortedDescriptions.forEach(([desc, data]) => {
      console.log(`  "${desc}" → ${data.category} (${data.count}x)`);
    });

    // 4. Analisar outros meses
    const otherMonthsTransactions = allTransactions.filter(t => {
      const d = new Date(t.date);
      return !(d.getMonth() === 11 && d.getFullYear() === 2024);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('🔍 ANÁLISE DOS MESES ANTERIORES');
    console.log('═'.repeat(60));

    // 5. Identificar inconsistências
    const inconsistencies = [];
    const uniqueInOtherMonths = [];

    otherMonthsTransactions.forEach(t => {
      const descLower = t.description.toLowerCase().trim();
      const expectedCategory = categoryMap[descLower];

      if (expectedCategory) {
        // Existe em dezembro - verificar se categoria é diferente
        if (t.category !== expectedCategory) {
          inconsistencies.push({
            _id: t._id,
            description: t.description,
            currentCategory: t.category,
            expectedCategory: expectedCategory,
            date: t.date,
            amount: t.amount
          });
        }
      } else {
        // Não existe em dezembro - é compra única
        uniqueInOtherMonths.push({
          _id: t._id,
          description: t.description,
          category: t.category,
          date: t.date,
          amount: t.amount
        });
      }
    });

    // Mostrar inconsistências encontradas
    console.log(`\n❌ INCONSISTÊNCIAS ENCONTRADAS: ${inconsistencies.length}`);
    console.log('-'.repeat(60));

    if (inconsistencies.length > 0) {
      // Agrupar por descrição para visualização
      const groupedInconsistencies = {};
      inconsistencies.forEach(inc => {
        const key = inc.description.toLowerCase().trim();
        if (!groupedInconsistencies[key]) {
          groupedInconsistencies[key] = {
            description: inc.description,
            currentCategory: inc.currentCategory,
            expectedCategory: inc.expectedCategory,
            items: []
          };
        }
        groupedInconsistencies[key].items.push(inc);
      });

      Object.values(groupedInconsistencies).forEach(group => {
        console.log(`\n  📌 "${group.description}"`);
        console.log(`     Atual: ${group.currentCategory} → Deveria ser: ${group.expectedCategory}`);
        console.log(`     Ocorrências: ${group.items.length}`);
        group.items.slice(0, 3).forEach(item => {
          const d = new Date(item.date);
          console.log(`       - ${d.toLocaleDateString('pt-BR')}: R$ ${item.amount.toFixed(2)}`);
        });
        if (group.items.length > 3) {
          console.log(`       ... e mais ${group.items.length - 3}`);
        }
      });
    } else {
      console.log('  ✅ Nenhuma inconsistência encontrada!');
    }

    // Mostrar compras únicas (manter)
    console.log(`\n📦 COMPRAS ÚNICAS (serão mantidas): ${uniqueInOtherMonths.length}`);
    if (uniqueInOtherMonths.length > 0 && uniqueInOtherMonths.length <= 20) {
      uniqueInOtherMonths.forEach(item => {
        const d = new Date(item.date);
        console.log(`  - "${item.description}" [${item.category}] - ${d.toLocaleDateString('pt-BR')}`);
      });
    } else if (uniqueInOtherMonths.length > 20) {
      console.log(`  (Listando apenas as primeiras 20)`);
      uniqueInOtherMonths.slice(0, 20).forEach(item => {
        const d = new Date(item.date);
        console.log(`  - "${item.description}" [${item.category}] - ${d.toLocaleDateString('pt-BR')}`);
      });
    }

    // 6. Retornar dados para script de ajuste
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESUMO');
    console.log('═'.repeat(60));
    console.log(`  Total de transações: ${allTransactions.length}`);
    console.log(`  Dezembro (referência): ${decemberTransactions.length}`);
    console.log(`  Outros meses: ${otherMonthsTransactions.length}`);
    console.log(`  Inconsistências a corrigir: ${inconsistencies.length}`);
    console.log(`  Compras únicas (manter): ${uniqueInOtherMonths.length}`);

    // Salvar dados para o script de ajuste
    const reportData = {
      categoryMap,
      inconsistencies,
      uniqueInOtherMonths,
      summary: {
        total: allTransactions.length,
        december: decemberTransactions.length,
        otherMonths: otherMonthsTransactions.length,
        toFix: inconsistencies.length,
        toKeep: uniqueInOtherMonths.length
      }
    };

    // Salvar como JSON para análise
    const fs = require('fs');
    fs.writeFileSync(
      '/Users/eduardobarreira/Desktop/finance-app/backend/scripts/analysis-report.json',
      JSON.stringify(reportData, null, 2)
    );
    console.log('\n✅ Relatório salvo em: scripts/analysis-report.json');

    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');

    return reportData;

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Executar
analyzeAndReport();
