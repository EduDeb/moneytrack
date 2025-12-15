#!/bin/bash
#
# MoneyTrack - Script para Parar
#

echo "🛑 Encerrando MoneyTrack..."
pkill -f "node.*finance-app/backend"
pkill -f "vite.*finance-app/frontend"
echo "✅ MoneyTrack encerrado!"
sleep 2
