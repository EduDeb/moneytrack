/**
 * Script para Corrigir Categorias
 * Baseado na análise de dezembro/2025 como referência
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

async function fixCategories() {
  try {
    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado!\n');

    // Carregar relatório de análise
    const fs = require('fs');
    const report = JSON.parse(
      fs.readFileSync('/Users/eduardobarreira/Desktop/finance-app/backend/scripts/full-analysis-report.json', 'utf8')
    );

    const { inconsistencies } = report;

    console.log('═'.repeat(70));
    console.log('🔧 EXECUTANDO CORREÇÕES DE CATEGORIAS');
    console.log('═'.repeat(70));
    console.log(`Total de correções a fazer: ${inconsistencies.length}\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const item of inconsistencies) {
      try {
        const result = await Transaction.findByIdAndUpdate(
          item._id,
          { category: item.expectedCategory },
          { new: true }
        );

        if (result) {
          const d = new Date(item.date);
          console.log(`✅ "${item.description}" (${d.toLocaleDateString('pt-BR')})`);
          console.log(`   ${item.currentCategory} → ${item.expectedCategory}`);
          successCount++;
        } else {
          console.log(`⚠️  Transação não encontrada: ${item._id}`);
          errorCount++;
        }
      } catch (err) {
        console.log(`❌ Erro ao atualizar ${item._id}: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('📊 RESULTADO DAS CORREÇÕES');
    console.log('═'.repeat(70));
    console.log(`  ✅ Corrigidas com sucesso: ${successCount}`);
    console.log(`  ❌ Erros: ${errorCount}`);
    console.log(`  📊 Total processado: ${successCount + errorCount}`);

    // Validação: verificar se as correções foram aplicadas
    console.log('\n' + '═'.repeat(70));
    console.log('🔍 VALIDAÇÃO PÓS-CORREÇÃO');
    console.log('═'.repeat(70));

    // Recarregar transações e verificar
    const decemberTransactions = await Transaction.find({
      date: {
        $gte: new Date(2025, 11, 1), // Dezembro 2025
        $lt: new Date(2026, 0, 1)    // Janeiro 2026
      }
    });

    const categoryMap = {};
    decemberTransactions.forEach(t => {
      const descNormalized = t.description.toLowerCase().trim();
      categoryMap[descNormalized] = t.category;
    });

    const previousMonths = await Transaction.find({
      date: { $lt: new Date(2025, 11, 1) }
    });

    let stillInconsistent = 0;
    previousMonths.forEach(t => {
      const descNormalized = t.description.toLowerCase().trim();
      const expectedCategory = categoryMap[descNormalized];
      if (expectedCategory && t.category !== expectedCategory) {
        stillInconsistent++;
        console.log(`⚠️  Ainda inconsistente: "${t.description}" - ${t.category} (deveria ser ${expectedCategory})`);
      }
    });

    if (stillInconsistent === 0) {
      console.log('✅ Todas as categorias estão agora consistentes com dezembro/2025!');
    } else {
      console.log(`\n⚠️  ${stillInconsistent} transações ainda inconsistentes`);
    }

    // Estatísticas finais por categoria
    console.log('\n' + '═'.repeat(70));
    console.log('📊 DISTRIBUIÇÃO FINAL POR CATEGORIA');
    console.log('═'.repeat(70));

    const allTransactions = await Transaction.find({});
    const byCategoryFinal = {};
    allTransactions.forEach(t => {
      if (!byCategoryFinal[t.category]) {
        byCategoryFinal[t.category] = { count: 0, total: 0 };
      }
      byCategoryFinal[t.category].count++;
      byCategoryFinal[t.category].total += t.amount;
    });

    Object.keys(byCategoryFinal).sort().forEach(cat => {
      const data = byCategoryFinal[cat];
      console.log(`  ${cat}: ${data.count} transações | Total: R$ ${data.total.toFixed(2)}`);
    });

    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');
    console.log('\n✅ CORREÇÕES FINALIZADAS COM SUCESSO!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixCategories();
