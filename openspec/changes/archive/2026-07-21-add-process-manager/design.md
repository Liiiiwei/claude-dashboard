## Context

Dashboard 的 dev-server API 用 in-memory Map 追蹤啟動的 process，但 Next.js hot reload 會清空 module state，導致狀態遺失。Port 分配也沒有檢查衝突。此外，掃描目錄中有 skill 檔案夾、workspace 檔案等非專案項目，需要排除機制。

## Goals / Non-Goals

- Goals:
  - 可靠地啟動、停止、偵測 dev server
  - 避免 port 衝突
  - 顯示系統中所有監聽中的 Node dev server 及資源使用
  - 讓使用者排除非專案資料夾
- Non-Goals:
  - 不支援非 Node.js 的 dev server（Python、Go 等）
  - 不做完整的 process manager（不取代 pm2）
  - 不做自動啟動/排程

## Decisions

### 用 `lsof` + `ps` 偵測取代 in-memory Map

- **決策**：每次查詢狀態時，用 `lsof -iTCP -sTCP:LISTEN -P -n` 找出監聽中的 port，再用 `ps` 取得 PID 對應的 cwd 來比對專案路徑
- **理由**：不依賴 process 記憶體狀態，即使 server 重啟也能正確偵測
- **替代方案**：
  - 寫入 PID 檔案到各專案目錄 — 增加檔案污染，且 crash 後 PID 檔案不會自動清除
  - 用 SQLite 持久化 — 過度複雜

### Port 分配策略

- **決策**：啟動前用 `net.createServer` 測試 port 可用性，從 3010 開始遞增找到第一個可用 port
- **理由**：簡單可靠，不需要外部依賴

### 排除機制

- **決策**：在 `projects-config.json` 加入 `_settings.excludePatterns` 陣列，支援 glob pattern（如 `Claude*`、`*.code-workspace`）。UI 上提供「隱藏」按鈕。
- **理由**：沿用現有 config 檔案，不額外增加設定檔
- **替代方案**：
  - `.dashboardignore` 檔案 — 增加一個新檔案，不夠直覺
  - 只用 UI 標記 — 需要一個個手動標記

## Risks / Trade-offs

- `lsof`/`ps` 是 macOS/Linux 指令，不支援 Windows — 此專案為本機工具，使用者環境為 macOS，可接受
- 系統偵測有微小延遲（~100ms）— 可接受，比 in-memory 更可靠

## Open Questions

- 無
