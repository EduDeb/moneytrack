/**
 * Script de Backup do MongoDB
 *
 * Este script faz backup do banco de dados MongoDB Atlas para uma pasta local.
 * Pode ser executado manualmente ou configurado como cron job.
 *
 * Uso: node scripts/backup-database.js
 *
 * Para agendar backup automático diário às 3h da manhã:
 * crontab -e
 * 0 3 * * * cd /path/to/backend && node scripts/backup-database.js >> logs/backup.log 2>&1
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 7;

if (!MONGODB_URI) {
  console.error('ERRO: MONGODB_URI não definida no .env');
  process.exit(1);
}

// Criar pasta de backup se não existir
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Criar pasta de logs se não existir
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function getBackupFolderName() {
  const now = new Date();
  return `backup_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
}

async function cleanOldBackups() {
  log(`Limpando backups mais antigos que ${RETENTION_DAYS} dias...`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory() && file.startsWith('backup_') && stats.mtime < cutoffDate) {
        fs.rmSync(filePath, { recursive: true, force: true });
        log(`  Removido: ${file}`);
        deletedCount++;
      }
    }

    if (deletedCount === 0) {
      log('  Nenhum backup antigo para remover.');
    } else {
      log(`  ${deletedCount} backup(s) antigo(s) removido(s).`);
    }
  } catch (error) {
    log(`AVISO: Erro ao limpar backups antigos: ${error.message}`);
  }
}

async function createBackup() {
  const backupFolder = getBackupFolderName();
  const backupPath = path.join(BACKUP_DIR, backupFolder);

  log('========================================');
  log('INICIANDO BACKUP DO MONGODB');
  log('========================================');
  log(`Destino: ${backupPath}`);

  // Verificar se mongodump está instalado
  return new Promise((resolve, reject) => {
    exec('which mongodump', (error) => {
      if (error) {
        log('AVISO: mongodump não encontrado. Instalando via MongoDB Database Tools...');
        log('Para instalar manualmente:');
        log('  macOS: brew install mongodb-database-tools');
        log('  Ubuntu: apt-get install mongodb-database-tools');
        log('');
        log('Alternativa: Use o backup automático do MongoDB Atlas:');
        log('  1. Acesse https://cloud.mongodb.com');
        log('  2. Vá em Database > Backups');
        log('  3. Configure Cloud Backup ou faça snapshot manual');

        // Criar arquivo de resumo do backup (para registro)
        const summaryPath = path.join(BACKUP_DIR, `${backupFolder}_summary.json`);
        const summary = {
          timestamp: new Date().toISOString(),
          status: 'skipped',
          reason: 'mongodump não instalado',
          instructions: 'Use MongoDB Atlas Backup ou instale mongodb-database-tools'
        };
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

        resolve({ success: false, reason: 'mongodump não instalado' });
        return;
      }

      // Executar mongodump
      const command = `mongodump --uri="${MONGODB_URI}" --out="${backupPath}" --gzip`;

      log('Executando mongodump...');

      exec(command, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          log(`ERRO: ${error.message}`);
          reject(error);
          return;
        }

        if (stderr && !stderr.includes('done dumping')) {
          log(`AVISO: ${stderr}`);
        }

        // Calcular tamanho do backup
        let totalSize = 0;
        const calculateSize = (dir) => {
          if (!fs.existsSync(dir)) return;
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const itemPath = path.join(dir, item);
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
              calculateSize(itemPath);
            } else {
              totalSize += stats.size;
            }
          }
        };

        calculateSize(backupPath);
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

        // Criar arquivo de resumo
        const summaryPath = path.join(backupPath, 'backup_summary.json');
        const summary = {
          timestamp: new Date().toISOString(),
          status: 'success',
          sizeBytes: totalSize,
          sizeMB: parseFloat(sizeMB),
          backupPath: backupPath,
          retentionDays: RETENTION_DAYS
        };
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

        log(`Backup concluído com sucesso!`);
        log(`Tamanho: ${sizeMB} MB`);
        log(`Localização: ${backupPath}`);

        resolve({ success: true, path: backupPath, size: sizeMB });
      });
    });
  });
}

async function run() {
  try {
    // Limpar backups antigos primeiro
    await cleanOldBackups();

    // Criar novo backup
    const result = await createBackup();

    log('========================================');
    if (result.success) {
      log('BACKUP COMPLETO');
    } else {
      log(`BACKUP IGNORADO: ${result.reason}`);
    }
    log('========================================');

  } catch (error) {
    log(`ERRO FATAL: ${error.message}`);
    process.exit(1);
  }
}

run();
