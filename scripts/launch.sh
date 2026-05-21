#!/bin/bash
# 啟動 Dashboard dev server 並開啟瀏覽器
# 規則：
#   1. 預設 port = 3001
#   2. 若 port 被「我們自己的 dashboard」佔用 → 直接開瀏覽器
#   3. 若 port 被其他程式佔用 → 自動往上找下一個空 port 啟動
#   4. port 空閒 → 直接啟動
#   5. 啟動前自動檢查依賴，缺套件就先跑 npm ci 修復（避免缺依賴造成假性「啟動逾時」）

PROJECT_DIR="$HOME/Desktop/vibe-coding playground/claude dashboard"
DEFAULT_PORT=3001
PORT_MAX=3099
DASHBOARD_MARKER="專案儀表板"  # <title> 內容，用來辨識是不是我們的 dashboard
DEV_LOG="/tmp/dashboard-dev.log"
export PATH="/usr/local/bin:$PATH"

# 檢查 port 是否有 LISTEN socket（忽略 CLOSED / 殘留連線）
port_is_listening() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1
}

# 檢查 port 上的服務是不是我們的 dashboard
is_our_dashboard() {
  local port=$1
  curl -s --max-time 2 "http://localhost:$port" 2>/dev/null | grep -q "$DASHBOARD_MARKER"
}

# 找一個可用的 port（從 start 開始往上找）
find_free_port() {
  local start=$1
  for p in $(seq "$start" "$PORT_MAX"); do
    if [ -z "$(port_is_listening "$p")" ]; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

# 確認依賴已安裝；缺 next 執行檔就自動修復（npm ci / 無 lockfile 時 npm install）
ensure_deps() {
  if [ -e "node_modules/.bin/next" ]; then
    return 0
  fi
  echo "偵測到依賴未安裝（缺 node_modules/.bin/next），開始自動修復…（約 1-2 分鐘）"
  if [ -f "package-lock.json" ]; then
    npm ci >>"$DEV_LOG" 2>&1
  else
    npm install >>"$DEV_LOG" 2>&1
  fi
  if [ -e "node_modules/.bin/next" ]; then
    echo "依賴安裝完成。"
    return 0
  fi
  echo "依賴安裝失敗，請檢查 $DEV_LOG"
  return 1
}

# 1. 預設 port 已有 dashboard 在跑 → 直接開
if [ -n "$(port_is_listening "$DEFAULT_PORT")" ] && is_our_dashboard "$DEFAULT_PORT"; then
  open "http://localhost:$DEFAULT_PORT"
  exit 0
fi

# 2. 預設 port 被別人佔用 → 找下一個空 port
if [ -n "$(port_is_listening "$DEFAULT_PORT")" ]; then
  PORT=$(find_free_port $((DEFAULT_PORT + 1)))
  if [ -z "$PORT" ]; then
    echo "找不到可用 port（$DEFAULT_PORT-$PORT_MAX 全被佔用）"
    exit 1
  fi
else
  PORT=$DEFAULT_PORT
fi

# 3. 啟動 dev server
cd "$PROJECT_DIR" || exit 1
: >"$DEV_LOG"   # 每次啟動清空舊 log

# 3a. 依賴自我檢查 + 自動修復（缺套件不再傻等 30 秒逾時）
ensure_deps || exit 1

# 3b. 背景啟動 dev server。包一層 bash 在 npm 結束時補寫結束標記，供偵測夭折用
DEV_PORT="$PORT" nohup bash -c '
  npm run dev -- -p "$DEV_PORT"
  echo "[launch.sh] DEV_SERVER_EXITED code=$?"
' >>"$DEV_LOG" 2>&1 &

# 4. 等待 server 就緒（最多 30 秒）
for i in {1..60}; do
  # dev server 還沒就緒就先退出 → 立刻失敗並印出真實錯誤，不再空等到逾時
  if grep -qF "DEV_SERVER_EXITED" "$DEV_LOG" 2>/dev/null; then
    echo "dev server 啟動失敗（process 已退出）。log 末段："
    tail -15 "$DEV_LOG"
    echo "完整 log：$DEV_LOG"
    exit 1
  fi
  if curl -s --max-time 1 "http://localhost:$PORT" &>/dev/null; then
    open "http://localhost:$PORT"
    exit 0
  fi
  sleep 0.5
done

echo "啟動逾時（30 秒未就緒）。log 末段："
tail -15 "$DEV_LOG"
echo "完整 log：$DEV_LOG"
exit 1
