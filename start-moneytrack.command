#!/bin/bash
#
# MoneyTrack - Script de Inicialização
# Duplo clique para iniciar o aplicativo
#

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Diretório do projeto
PROJECT_DIR="$(dirname "$0")"
cd "$PROJECT_DIR"

clear
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║       💰 MoneyTrack - Gestão Financeira Pessoal 💰          ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}[INFO]${NC} Iniciando MoneyTrack..."
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[ERRO]${NC} Node.js não encontrado. Por favor, instale o Node.js."
    read -p "Pressione Enter para fechar..."
    exit 1
fi

# Função para verificar se porta está em uso
check_port() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Parar processos anteriores se existirem
echo -e "${BLUE}[INFO]${NC} Verificando processos anteriores..."
pkill -f "node.*finance-app/backend" 2>/dev/null
pkill -f "vite.*finance-app/frontend" 2>/dev/null
sleep 1

# Iniciar Backend
echo -e "${BLUE}[INFO]${NC} Iniciando servidor backend (porta 3001)..."
cd "$PROJECT_DIR/backend"
npm run dev > /tmp/moneytrack-backend.log 2>&1 &
BACKEND_PID=$!

# Aguardar backend iniciar
echo -e "${BLUE}[INFO]${NC} Aguardando backend..."
for i in {1..30}; do
    if check_port 3001; then
        echo -e "${GREEN}[OK]${NC} Backend iniciado!"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Iniciar Frontend
echo -e "${BLUE}[INFO]${NC} Iniciando aplicação frontend (porta 5173)..."
cd "$PROJECT_DIR/frontend"
npm run dev > /tmp/moneytrack-frontend.log 2>&1 &
FRONTEND_PID=$!

# Aguardar frontend iniciar
echo -e "${BLUE}[INFO]${NC} Aguardando frontend..."
for i in {1..30}; do
    if check_port 5173; then
        echo -e "${GREEN}[OK]${NC} Frontend iniciado!"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Aguardar mais um pouco para garantir que está pronto
sleep 2

# Abrir navegador
echo -e "${BLUE}[INFO]${NC} Abrindo navegador..."
open "http://localhost:5173"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   ✅ MoneyTrack está rodando!                                ║"
echo "║                                                              ║"
echo "║   🌐 Acesse: http://localhost:5173                           ║"
echo "║                                                              ║"
echo "║   📱 Para instalar no desktop:                               ║"
echo "║      Chrome: Clique no ícone ⊕ na barra de endereço         ║"
echo "║      Safari: Arquivo → Adicionar ao Dock                     ║"
echo "║                                                              ║"
echo "║   ⚠️  Mantenha esta janela aberta enquanto usa o app         ║"
echo "║   🛑 Para fechar: Ctrl+C ou feche esta janela                ║"
echo "║                                                              ║"
echo -e "╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Manter script rodando
trap "echo -e '\n${YELLOW}[INFO]${NC} Encerrando MoneyTrack...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

# Loop para manter aberto
while true; do
    sleep 5
    # Verificar se processos ainda estão rodando
    if ! kill -0 $BACKEND_PID 2>/dev/null || ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${YELLOW}[AVISO]${NC} Um dos serviços parou. Verifique os logs em /tmp/moneytrack-*.log"
    fi
done
