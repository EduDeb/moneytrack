/**
 * Script de Migração: Corrige transações sem conta e categorias inválidas
 *
 * Problema 1: 122 transações não têm campo 'account'
 * Problema 2: 13 recorrências referenciam categorias que não existem
 *
 * Uso: node scripts/fix-accounts-and-categories.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERRO: MONGODB_URI não definida no .env');
  process.exit(1);
}

// Definir schemas inline para evitar dependências
const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  type: String,
  category: String,
  description: String,
  amount: Number,
  date: Date
}, { strict: false });

const accountSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  type: String,
  balance: Number,
  isActive: Boolean
}, { strict: false });

const recurringSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  type: String,
  category: String,
  amount: Number
}, { strict: false });

const categorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  type: String,
  icon: String,
  color: String,
  isDefault: Boolean,
  isActive: Boolean
}, { strict: false });

const Transaction = mongoose.model('Transaction', transactionSchema);
const Account = mongoose.model('Account', accountSchema);
const Recurring = mongoose.model('Recurring', recurringSchema);
const Category = mongoose.model('Category', categorySchema);

// Categorias que precisam ser criadas (do relatório de auditoria)
const MISSING_CATEGORIES = [
  { name: 'Moradia', type: 'expense', icon: 'Home', color: '#8b5cf6' },
  { name: 'Entretenimento', type: 'expense', icon: 'Tv', color: '#ec4899' },
  { name: 'Internet', type: 'expense', icon: 'Wifi', color: '#06b6d4' },
  { name: 'Energia', type: 'expense', icon: 'Zap', color: '#f59e0b' },
  { name: 'Outros', type: 'expense', icon: 'MoreHorizontal', color: '#6b7280' },
  { name: 'Veículos', type: 'expense', icon: 'Car', color: '#3b82f6' },
  { name: 'Manutencao', type: 'expense', icon: 'Wrench', color: '#f97316' },
  { name: 'Terrenos', type: 'expense', icon: 'MapPin', color: '#22c55e' },
  { name: 'Imposto', type: 'expense', icon: 'FileText', color: '#ef4444' },
  { name: 'Emprestimos', type: 'expense', icon: 'DollarSign', color: '#a855f7' },
  { name: 'Empresas Rake , Eb,Rake E Deb', type: 'expense', icon: 'Building', color: '#64748b' }
];

// Mapeamento de categorias (nome antigo -> nome correto capitalizado)
const CATEGORY_MAP = {
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
  'Empresas Rake , EB,Rake e DEB': 'Empresas Rake , Eb,Rake E Deb'
};

async function run() {
  try {
    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado!\n');

    // ========================================
    // PARTE 1: Corrigir transações sem conta
    // ========================================
    console.log('=' .repeat(60));
    console.log('PARTE 1: VINCULAR CONTAS ÀS TRANSAÇÕES');
    console.log('=' .repeat(60));

    // Encontrar transações sem account
    const transactionsWithoutAccount = await Transaction.find({
      account: { $exists: false }
    }).lean();

    console.log(`\n📊 Transações sem conta: ${transactionsWithoutAccount.length}`);

    if (transactionsWithoutAccount.length > 0) {
      // Agrupar por usuário
      const userTransactions = {};
      for (const t of transactionsWithoutAccount) {
        const userId = t.user.toString();
        if (!userTransactions[userId]) {
          userTransactions[userId] = [];
        }
        userTransactions[userId].push(t);
      }

      console.log(`\n👥 Usuários afetados: ${Object.keys(userTransactions).length}`);

      let totalFixed = 0;

      for (const [userId, transactions] of Object.entries(userTransactions)) {
        // Buscar primeira conta do usuário
        let account = await Account.findOne({
          user: new mongoose.Types.ObjectId(userId),
          isActive: true
        }).sort({ createdAt: 1 });

        // Se não tem conta, criar uma "Conta Principal"
        if (!account) {
          console.log(`\n⚠️  Usuário ${userId} não tem conta. Criando "Conta Principal"...`);
          account = await Account.create({
            user: new mongoose.Types.ObjectId(userId),
            name: 'Conta Principal',
            type: 'checking',
            balance: 0,
            initialBalance: 0,
            isActive: true,
            includeInTotal: true,
            color: '#3b82f6',
            icon: 'Wallet'
          });
          console.log(`   ✅ Conta criada: ${account._id}`);
        }

        // Atualizar todas as transações deste usuário
        const result = await Transaction.updateMany(
          {
            user: new mongoose.Types.ObjectId(userId),
            account: { $exists: false }
          },
          { $set: { account: account._id } }
        );

        console.log(`\n👤 Usuário ${userId.slice(-6)}:`);
        console.log(`   📝 Transações atualizadas: ${result.modifiedCount}`);
        console.log(`   🏦 Conta vinculada: ${account.name} (${account._id})`);

        totalFixed += result.modifiedCount;
      }

      console.log(`\n✅ TOTAL: ${totalFixed} transações vinculadas a contas`);
    } else {
      console.log('✅ Todas as transações já têm conta vinculada!');
    }

    // ========================================
    // PARTE 2: Corrigir categorias inválidas
    // ========================================
    console.log('\n' + '=' .repeat(60));
    console.log('PARTE 2: CORRIGIR CATEGORIAS INVÁLIDAS NAS RECORRÊNCIAS');
    console.log('=' .repeat(60));

    // Encontrar recorrências com categorias inválidas
    const recurrings = await Recurring.find().lean();
    console.log(`\n📊 Total de recorrências: ${recurrings.length}`);

    // Verificar quais categorias existem para cada usuário
    const usersWithInvalidCategories = new Map();

    for (const r of recurrings) {
      const userId = r.user.toString();
      const categoryName = r.category;

      // Verificar se a categoria existe para este usuário
      const existingCategory = await Category.findOne({
        user: r.user,
        name: { $regex: new RegExp(`^${categoryName}$`, 'i') }
      });

      if (!existingCategory) {
        if (!usersWithInvalidCategories.has(userId)) {
          usersWithInvalidCategories.set(userId, new Set());
        }
        usersWithInvalidCategories.get(userId).add(categoryName);
      }
    }

    if (usersWithInvalidCategories.size > 0) {
      console.log(`\n⚠️  Usuários com categorias inválidas: ${usersWithInvalidCategories.size}`);

      let categoriesCreated = 0;
      let recurringsFixed = 0;

      for (const [userId, invalidCategories] of usersWithInvalidCategories) {
        console.log(`\n👤 Usuário ${userId.slice(-6)}:`);
        console.log(`   Categorias inválidas: ${Array.from(invalidCategories).join(', ')}`);

        for (const catName of invalidCategories) {
          // Encontrar definição da categoria
          const catDef = MISSING_CATEGORIES.find(
            c => c.name.toLowerCase() === catName.toLowerCase() ||
                 CATEGORY_MAP[catName]?.toLowerCase() === c.name.toLowerCase()
          );

          if (catDef) {
            // Verificar se já existe (case insensitive)
            const exists = await Category.findOne({
              user: new mongoose.Types.ObjectId(userId),
              name: { $regex: new RegExp(`^${catDef.name}$`, 'i') },
              type: catDef.type
            });

            if (!exists) {
              // Criar a categoria
              await Category.create({
                user: new mongoose.Types.ObjectId(userId),
                name: catDef.name,
                type: catDef.type,
                icon: catDef.icon,
                color: catDef.color,
                isDefault: false,
                isActive: true
              });
              console.log(`   ✅ Categoria criada: ${catDef.name}`);
              categoriesCreated++;
            }

            // Atualizar recorrências para usar o nome correto
            const correctName = CATEGORY_MAP[catName] || catDef.name;
            const updateResult = await Recurring.updateMany(
              {
                user: new mongoose.Types.ObjectId(userId),
                category: catName
              },
              { $set: { category: correctName } }
            );

            if (updateResult.modifiedCount > 0) {
              console.log(`   📝 ${updateResult.modifiedCount} recorrência(s) atualizada(s): "${catName}" → "${correctName}"`);
              recurringsFixed += updateResult.modifiedCount;
            }
          } else {
            // Categoria não encontrada na lista, criar uma genérica
            console.log(`   ⚠️  Categoria "${catName}" não está na lista conhecida. Criando...`);

            const exists = await Category.findOne({
              user: new mongoose.Types.ObjectId(userId),
              name: { $regex: new RegExp(`^${catName}$`, 'i') },
              type: 'expense'
            });

            if (!exists) {
              await Category.create({
                user: new mongoose.Types.ObjectId(userId),
                name: catName.charAt(0).toUpperCase() + catName.slice(1).toLowerCase(),
                type: 'expense',
                icon: 'Tag',
                color: '#6b7280',
                isDefault: false,
                isActive: true
              });
              console.log(`   ✅ Categoria criada: ${catName}`);
              categoriesCreated++;
            }
          }
        }
      }

      console.log(`\n✅ TOTAL: ${categoriesCreated} categorias criadas, ${recurringsFixed} recorrências corrigidas`);
    } else {
      console.log('✅ Todas as recorrências têm categorias válidas!');
    }

    // ========================================
    // RESUMO FINAL
    // ========================================
    console.log('\n' + '=' .repeat(60));
    console.log('RESUMO DA MIGRAÇÃO');
    console.log('=' .repeat(60));

    // Verificar estado final
    const finalTransWithoutAccount = await Transaction.countDocuments({
      account: { $exists: false }
    });

    const allRecurrings = await Recurring.find().lean();
    let invalidCategoriesCount = 0;

    for (const r of allRecurrings) {
      const exists = await Category.findOne({
        user: r.user,
        name: { $regex: new RegExp(`^${r.category}$`, 'i') }
      });
      if (!exists) invalidCategoriesCount++;
    }

    console.log(`\n📊 Estado Final:`);
    console.log(`   Transações sem conta: ${finalTransWithoutAccount}`);
    console.log(`   Recorrências com categorias inválidas: ${invalidCategoriesCount}`);

    if (finalTransWithoutAccount === 0 && invalidCategoriesCount === 0) {
      console.log('\n🎉 SUCESSO! Todos os problemas foram corrigidos!');
    } else {
      console.log('\n⚠️  Alguns problemas ainda precisam de atenção manual.');
    }

    console.log('\n✅ Migração concluída!');

  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');
  }
}

run();
