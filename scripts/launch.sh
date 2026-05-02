#!/bin/bash
# 啟動 Dashboard dev server 並開啟瀏覽器

PROJECT_DIR="$HOME/Desktop/vibe-coding playground/claude dashboard"
PORT=3001
export PATH="/usr/local/bin:$PATH"

# 檢查是否已在執行
if lsof -ti:$PORT &>/dev/null; then
  open "http://localhost:$PORT"
  exit 0
fi

# 啟動 dev server
cd "$PROJECT_DIR" && npm run dev -- -p $PORT &>/dev/null &
SERVER_PID=$!

# 等待 server 就緒
for i in {1..30}; do
  if curl -s "http://localhost:$PORT" &>/dev/null; then
    open "http://localhost:$PORT"
    exit 0
  fi
  sleep 0.5
done

echo "啟動逾時"
exit 1
