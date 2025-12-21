#!/usr/bin/env node
/**
 * Script de Backup Automático do MoneyTrack
 * Salva todos os dados do MongoDB em arquivos JSON
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const BACKUP_DIR = path.join(__dirname, '../backup');

async function backup() {
  try {
    console.log('🔄 Iniciando backup automático...');

    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    // Criar diretório de backup se não existir
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const date = new Date().toISOString().split('T')[0];

    // Collections para backup
    const collections = [
      'transactions',
      'recurrings',
      'bills',
      'goals',
      'budgets',
      'accounts',
      'investments',
      'categories',
      'settings',
      'users'
    ];

    const summary = {};

    for (const collName of collections) {
      try {
        const docs = await db.collection(collName).find({}).toArray();

        // Remover senhas dos usuários
        if (collName === 'users') {
          docs.forEach(d => delete d.password);
        }

        const filename = `${collName}-${date}.json`;
        fs.writeFileSync(
          path.join(BACKUP_DIR, filename),
          JSON.stringify(docs, null, 2)
        );
        summary[collName] = docs.length;
      } catch (err) {
        summary[collName] = 'erro';
      }
    }

    // Salvar resumo do backup
    const backupLog = {
      timestamp: new Date().toISOString(),
      summary,
      totalCollections: Object.keys(summary).length
    };

    fs.writeFileSync(
      path.join(BACKUP_DIR, 'backup-log.json'),
      JSON.stringify(backupLog, null, 2)
    );

    console.log('✅ Backup concluído!');
    console.log('📊 Resumo:');
    Object.entries(summary).forEach(([k, v]) => {
      console.log(`   ${k}: ${v} documentos`);
    });

    await mongoose.disconnect();
    return true;
  } catch (error) {
    console.error('❌ Erro no backup:', error.message);
    return false;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  backup().then(() => process.exit(0));
}

module.exports = { backup };
