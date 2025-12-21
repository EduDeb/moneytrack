#!/bin/bash

# ============================================
# MoneyTrack - Script de Inicialização
# ============================================

clear
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           💰 MoneyTrack - Gestão Financeira             ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Iniciando aplicação...                                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Diretório do projeto
PROJECT_DIR="/Users/eduardobarreira/Desktop/finance-app"

# Verificar se os diretórios existem
if [ ! -d "$PROJECT_DIR/backend" ] || [ ! -d "$PROJECT_DIR/frontend" ]; then
    echo "❌ Erro: Diretório do projeto não encontrado!"
    echo "   Verifique se o projeto está em: $PROJECT_DIR"
    read -p "Pressione Enter para fechar..."
    exit 1
fi

# Função para cleanup ao sair
cleanup() {
    echo ""
    echo "🔄 Encerrando servidores..."
    pkill -f "node.*finance-app/backend" 2>/dev/null
    pkill -f "vite.*finance-app/frontend" 2>/dev/null
    echo "✅ Servidores encerrados."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Iniciar Backend
echo "🚀 Iniciando Backend (porta 3001)..."
cd "$PROJECT_DIR/backend"
npm run dev > /tmp/moneytrack-backend.log 2>&1 &
BACKEND_PID=$!

# Aguardar backend iniciar
sleep 3

# Verificar se backend está rodando
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Backend rodando!"
else
    echo "⚠️  Backend iniciando... aguarde"
fi

# Iniciar Frontend
echo "🎨 Iniciando Frontend (porta 5173)..."
cd "$PROJECT_DIR/frontend"
npm run dev > /tmp/moneytrack-frontend.log 2>&1 &
FRONTEND_PID=$!

# Aguardar frontend iniciar
sleep 3

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    ✅ PRONTO!                            ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  🌐 Acesse: http://localhost:5173                        ║"
echo "║                                                          ║"
echo "║  📱 Para instalar como PWA:                              ║"
echo "║     No Chrome/Edge, clique no ícone de instalação        ║"
echo "║     na barra de endereços                                ║"
echo "║                                                          ║"
echo "║  ⌨️  Pressione Ctrl+C para encerrar                      ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Abrir navegador automaticamente (macOS)
sleep 2
open http://localhost:5173

# Manter script rodando
echo "📊 Logs disponíveis em:"
echo "   Backend:  /tmp/moneytrack-backend.log"
echo "   Frontend: /tmp/moneytrack-frontend.log"
echo ""
echo "Aguardando... (Ctrl+C para encerrar)"

wait
