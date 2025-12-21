#!/bin/bash
#
# MoneyTrack Auto-Save Script
# Salva automaticamente código (Git) e dados (MongoDB)
#

PROJECT_DIR="/Users/eduardobarreira/Desktop/finance-app"
BACKUP_DIR="$PROJECT_DIR/backup"
LOG_FILE="$BACKUP_DIR/auto-save.log"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

log "${GREEN}🚀 MoneyTrack Auto-Save Iniciado${NC}"

# 1. Backup do MongoDB
log "${YELLOW}📦 Fazendo backup do banco de dados...${NC}"
cd "$PROJECT_DIR/backend"
node "$PROJECT_DIR/scripts/auto-backup.js" 2>&1 | tee -a "$LOG_FILE"

# 2. Auto-commit do Git (se houver mudanças)
log "${YELLOW}📝 Verificando alterações no código...${NC}"
cd "$PROJECT_DIR"

# Verificar se há mudanças
if [[ -n $(git status --porcelain) ]]; then
    log "Alterações encontradas. Fazendo commit..."

    git add -A

    # Gerar mensagem de commit automática
    CHANGED_FILES=$(git diff --cached --name-only | wc -l | tr -d ' ')
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

    git commit -m "auto-save: $CHANGED_FILES arquivo(s) alterado(s) em $TIMESTAMP

🤖 Commit automático do MoneyTrack

Co-Authored-By: Claude <noreply@anthropic.com>"

    log "${GREEN}✅ Commit realizado com sucesso!${NC}"
else
    log "Nenhuma alteração no código para salvar."
fi

log "${GREEN}✅ Auto-Save concluído!${NC}"
echo ""
