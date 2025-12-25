#!/bin/bash
#
# ╔══════════════════════════════════════════════════════════════╗
# ║              MoneyTrack - Iniciar Aplicação                   ║
# ║         Com Auto-Save de Código e Dados Ativado              ║
# ╚══════════════════════════════════════════════════════════════╝
#

PROJECT_DIR="/Users/eduardobarreira/Desktop/finance-app"
SCRIPTS_DIR="$PROJECT_DIR/scripts"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

clear
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║           💰  MoneyTrack - Gestão Financeira  💰            ║"
echo "║                                                              ║"
echo "║              🔄 Auto-Save Ativado                            ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado! Instale em: https://nodejs.org${NC}"
    exit 1
fi

# Matar processos anteriores
echo -e "${YELLOW}🔄 Encerrando processos anteriores...${NC}"
pkill -f "node.*server" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Iniciar Backend
echo -e "${GREEN}🚀 Iniciando Backend (porta 3001)...${NC}"
cd "$PROJECT_DIR/backend"
npm run dev > /tmp/moneytrack-backend.log 2>&1 &
BACKEND_PID=$!

# Aguardar backend iniciar (máximo 30 segundos)
echo -e "${YELLOW}   ⏳ Aguardando backend iniciar...${NC}"
BACKEND_READY=false
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        BACKEND_READY=true
        break
    fi
    sleep 1
done

if [ "$BACKEND_READY" = true ]; then
    echo -e "${GREEN}   ✅ Backend rodando!${NC}"
else
    echo -e "${RED}   ❌ Backend demorou para iniciar. Verifique /tmp/moneytrack-backend.log${NC}"
    echo -e "${YELLOW}   Continuando mesmo assim...${NC}"
fi

# Iniciar Frontend
echo -e "${GREEN}🚀 Iniciando Frontend (porta 5173)...${NC}"
cd "$PROJECT_DIR/frontend"
npm run dev > /tmp/moneytrack-frontend.log 2>&1 &
FRONTEND_PID=$!

# Aguardar frontend iniciar (máximo 20 segundos)
echo -e "${YELLOW}   ⏳ Aguardando frontend iniciar...${NC}"
FRONTEND_READY=false
for i in {1..20}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        FRONTEND_READY=true
        break
    fi
    sleep 1
done

if [ "$FRONTEND_READY" = true ]; then
    echo -e "${GREEN}   ✅ Frontend rodando!${NC}"
else
    echo -e "${RED}   ❌ Frontend demorou para iniciar. Verifique /tmp/moneytrack-frontend.log${NC}"
fi

# Fazer backup inicial
echo -e "${BLUE}📦 Fazendo backup inicial dos dados...${NC}"
cd "$PROJECT_DIR/backend"
node "$SCRIPTS_DIR/auto-backup.js" > /dev/null 2>&1
echo -e "${GREEN}   ✅ Backup concluído!${NC}"

# Configurar auto-save a cada 30 minutos
echo -e "${PURPLE}⏰ Configurando Auto-Save (a cada 30 minutos)...${NC}"
(
    while true; do
        sleep 1800  # 30 minutos
        bash "$SCRIPTS_DIR/auto-save.sh" > /dev/null 2>&1
    done
) &
AUTOSAVE_PID=$!

# Salvar PIDs para encerramento
echo "$BACKEND_PID $FRONTEND_PID $AUTOSAVE_PID" > /tmp/moneytrack-pids.txt

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}  ✅ MoneyTrack está rodando!${NC}"
echo ""
echo -e "  🌐 Acesse: ${CYAN}http://localhost:5173${NC}"
echo ""
echo -e "  📧 Email: ${YELLOW}arqdeboraso@gmail.com${NC}"
echo -e "  🔑 Senha: ${YELLOW}123456${NC}"
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${PURPLE}  💾 Auto-Save ativado:${NC}"
echo -e "     • Backup do banco: a cada 30 minutos"
echo -e "     • Commit do código: a cada 30 minutos"
echo ""
echo -e "${YELLOW}  Para salvar manualmente: bash $SCRIPTS_DIR/auto-save.sh${NC}"
echo -e "${RED}  Para encerrar: Pressione Ctrl+C ou feche este terminal${NC}"
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"

# Abrir no navegador
sleep 2
open "http://localhost:5173"

# Manter o script rodando e capturar Ctrl+C
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Encerrando MoneyTrack...${NC}"

    # Fazer backup final antes de encerrar
    echo -e "${BLUE}📦 Fazendo backup final...${NC}"
    bash "$SCRIPTS_DIR/auto-save.sh" 2>/dev/null

    # Matar processos
    kill $BACKEND_PID $FRONTEND_PID $AUTOSAVE_PID 2>/dev/null
    pkill -f "node.*server" 2>/dev/null
    pkill -f "vite" 2>/dev/null

    echo -e "${GREEN}✅ MoneyTrack encerrado. Seus dados foram salvos!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Manter script rodando
wait
