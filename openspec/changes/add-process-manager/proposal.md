# Change: 新增 Process Manager 與專案排除機制

## Why

目前 Dev 按鈕點了不會啟動（in-memory Map 在 hot reload 後遺失），多個 dev server 的 port 會衝突，使用者無法看到哪些專案正在執行、佔用多少資源，且 skill 資料夾等非專案目錄會混在看板中。

## What Changes

- 用系統層級偵測（`lsof`/`ps`）取代 in-memory Map 追蹤 dev server 狀態
- 啟動前自動掃描可用 port，避免衝突
- 新增「執行中」狀態面板，顯示所有跑中的 localhost、PID、CPU/Memory
- Scanner 加入排除機制，讓使用者可在 config 或 UI 隱藏非專案資料夾

## Impact

- Affected specs: `process-management`（新增）、`project-scanning`（修改）
- Affected code:
  - `src/app/api/dev-server/route.ts` — 重寫啟動/停止/狀態邏輯
  - `src/lib/scanner.ts` — 加入 exclude 過濾
  - `src/lib/config.ts` — 加入 exclude 設定
  - `src/components/ProjectCard.tsx` — Dev 按鈕狀態改用系統偵測
  - `src/components/Dashboard.tsx` — 新增執行中面板
