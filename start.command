#!/bin/bash
cd ~/Desktop/ferramenta1
echo "📦 Instalando dependências..."
npm install
echo ""
echo "🗑️  Limpando banco de dados antigo..."
rm -f ferramenta1.db ferramenta1.db-shm ferramenta1.db-wal
echo ""
echo "🚀 Iniciando servidor..."
echo ""
node server.js
