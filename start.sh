#!/bin/bash
set -e

echo "=== MedVault — Medical Intelligence Ecosystem ==="
echo ""

# Backend setup
if [ ! -d ".venv" ]; then
  echo "[1/4] Creating Python virtual environment..."
  python3 -m venv .venv
else
  echo "[1/4] Virtual environment exists."
fi

echo "[2/4] Installing Python dependencies..."
.venv/bin/pip install -q -r backend/requirements.txt

# Frontend setup
echo "[3/4] Installing frontend dependencies..."
cd frontend
npm install --silent 2>/dev/null
cd ..

echo "[4/4] Starting servers..."
echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""

# Start backend in background
.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
cd frontend
npx vite --port 5173 &
FRONTEND_PID=$!
cd ..

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
