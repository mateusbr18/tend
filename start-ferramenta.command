#!/bin/bash
cd "$(dirname "$0")"
echo "=== Ferramenta 1 — Setup ==="
echo ""
echo "Instalando dependencias..."
npm install 2>&1
echo ""
echo "Limpando banco antigo..."
rm -f ferramenta1.db ferramenta1.db-shm ferramenta1.db-wal
echo ""
echo "Iniciando servidor..."
echo ""
node server.js
