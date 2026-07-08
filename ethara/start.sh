#!/bin/bash
# Robust launcher that keeps both servers alive.
# Usage: bash start.sh
#
# Uses `setsid` + `disown` to fully detach from the calling shell so
# the servers survive after the bash tool returns. Writes logs to
# /tmp/uvicorn.log and /tmp/next.log for debugging.

ROOT="/home/z/my-project/ethara"
LOG_UVICORN="/tmp/uvicorn.log"
LOG_NEXT="/tmp/next.log"

# Kill any leftover processes
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Start backend
echo "Starting backend on http://localhost:8000 ..."
cd "$ROOT/backend"
source venv/bin/activate
unset DATABASE_URL
setsid uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$LOG_UVICORN" 2>&1 < /dev/null &
disown
BACKEND_PID=$!

# Wait for backend to be healthy
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if curl -s http://localhost:8000/health 2>/dev/null | grep -q healthy; then
    echo "  ✓ Backend healthy (attempt $i, PID $BACKEND_PID)"
    break
  fi
done

if ! curl -s http://localhost:8000/health 2>/dev/null | grep -q healthy; then
  echo "  ✗ Backend failed to start. Log:"
  tail -20 "$LOG_UVICORN"
  exit 1
fi

# Start frontend
echo "Starting frontend on http://localhost:3000 ..."
cd "$ROOT/frontend"
setsid npm run dev > "$LOG_NEXT" 2>&1 < /dev/null &
disown
FRONTEND_PID=$!

# Wait for frontend
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  sleep 1
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "  ✓ Frontend up (attempt $i, PID $FRONTEND_PID)"
    break
  fi
done

CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
if [ "$CODE" != "200" ]; then
  echo "  ✗ Frontend failed to start (HTTP $CODE). Log:"
  tail -20 "$LOG_NEXT"
  exit 1
fi

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
echo " Logs: $LOG_UVICORN, $LOG_NEXT"
echo "=========================================="
