#!/bin/bash
# Capture screenshots for all Ethara pages.
# Restarts servers, takes screenshots, saves to /home/z/my-project/ethara/screenshots/

set -e

ROOT="/home/z/my-project/ethara"
SHOT_DIR="$ROOT/screenshots"
mkdir -p "$SHOT_DIR"

# Kill old servers
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Start backend
echo "Starting backend..."
cd "$ROOT/backend"
source venv/bin/activate
unset DATABASE_URL
setsid uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 < /dev/null &
disown

# Start frontend
echo "Starting frontend..."
cd "$ROOT/frontend"
setsid npm run dev > /tmp/next.log 2>&1 < /dev/null &
disown

# Wait for servers
echo "Waiting for servers..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  sleep 2
  B=$(curl -s http://localhost:8000/health 2>/dev/null)
  F=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  if echo "$B" | grep -q healthy && [ "$F" = "200" ]; then
    echo "  Both servers up (attempt $i)"
    break
  fi
  echo "  attempt $i: backend=$B frontend=$F"
done

# Set viewport
agent-browser set viewport 1440 900

# 1. Dashboard
echo "Screenshot 1: Dashboard"
agent-browser open http://localhost:3000/ --timeout 30000
sleep 3
agent-browser screenshot "$SHOT_DIR/01-dashboard.png" --full

# 2. Employees
echo "Screenshot 2: Employees"
agent-browser open http://localhost:3000/employees --timeout 30000
sleep 3
agent-browser screenshot "$SHOT_DIR/02-employees.png" --full

# 3. Projects
echo "Screenshot 3: Projects"
agent-browser open http://localhost:3000/projects --timeout 30000
sleep 3
agent-browser screenshot "$SHOT_DIR/03-projects.png" --full

# 4. Seat Map
echo "Screenshot 4: Seat Map"
agent-browser open http://localhost:3000/seats --timeout 30000
sleep 4
agent-browser screenshot "$SHOT_DIR/04-seat-map.png" --full

# 5. New Joiners
echo "Screenshot 5: New Joiners"
agent-browser open http://localhost:3000/new-joiners --timeout 30000
sleep 3
agent-browser screenshot "$SHOT_DIR/05-new-joiners.png" --full

# 6. Analytics
echo "Screenshot 6: Analytics"
agent-browser open http://localhost:3000/analytics --timeout 30000
sleep 3
agent-browser screenshot "$SHOT_DIR/06-analytics.png" --full

# 7. AI Assistant - type a query
echo "Screenshot 7: AI Assistant"
agent-browser open http://localhost:3000/ai-assistant --timeout 30000
sleep 3
agent-browser snapshot -i > /tmp/snap.txt 2>&1
INPUT_REF=$(grep -i "textbox" /tmp/snap.txt | head -1 | grep -oP '@\w+' | head -1)
echo "  Input ref: $INPUT_REF"
if [ -n "$INPUT_REF" ]; then
  agent-browser fill "$INPUT_REF" "How many available seats are there?"
  agent-browser press Enter
  sleep 8
fi
agent-browser screenshot "$SHOT_DIR/07-ai-assistant.png" --full

# 8. Swagger API docs
echo "Screenshot 8: Swagger"
agent-browser open http://localhost:8000/docs --timeout 30000
sleep 3
agent-browser screenshot "$SHOT_DIR/08-swagger.png" --full

agent-browser close

echo ""
echo "=== Screenshots saved ==="
ls -lh "$SHOT_DIR/"
