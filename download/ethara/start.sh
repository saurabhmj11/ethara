#!/bin/bash
# Launch script for the Ethara system.
# Starts both backend and frontend servers.

set -e

ROOT="/home/z/my-project/ethara"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# Kill any leftover processes
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

# Start backend
echo "Starting backend on http://localhost:8000 ..."
cd "$BACKEND"
source venv/bin/activate
unset DATABASE_URL
setsid uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 < /dev/null &
disown
BACKEND_PID=$!

# Wait for backend
sleep 4
if curl -s http://localhost:8000/health | grep -q healthy; then
  echo "  ✓ Backend is healthy"
else
  echo "  ✗ Backend failed to start. Check /tmp/uvicorn.log"
  exit 1
fi

# Start frontend
echo "Starting frontend on http://localhost:3000 ..."
cd "$FRONTEND"
setsid npm run dev > /tmp/next.log 2>&1 < /dev/null &
disown
FRONTEND_PID=$!

# Wait for frontend
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -q 200; then
    echo "  ✓ Frontend is up"
    break
  fi
done

echo ""
echo "=========================================="
echo " Ethara system is running!"
echo "=========================================="
echo " Frontend:  http://localhost:3000"
echo " Backend:   http://localhost:8000"
echo " Swagger:   http://localhost:8000/docs"
echo ""
echo " Backend PID:  $BACKEND_PID"
echo " Frontend PID: $FRONTEND_PID"
echo ""
echo " Logs: /tmp/uvicorn.log, /tmp/next.log"
echo "=========================================="
