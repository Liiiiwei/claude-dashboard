# Project Context

## Purpose
本機用的個人專案管理 Dashboard：掃描 `SCAN_DIR` 底下的所有專案資料夾，以看板呈現狀態、釘選與分組，並偵測 / 啟動各專案的 dev server、檢視執行中的 process 與系統資源。只在本機（`127.0.0.1`）執行，預設 port 3001。

## Tech Stack
- Next.js 16.2.1（App Router），React 19.2.4
- TypeScript 5，樣式使用 Tailwind CSS 4
- Node.js 執行環境；透過 `lsof` / `ps` 等系統指令偵測 port 與 process
- 資料以本機 JSON 檔持久化（`projects-config.json`、`port-registry.json`），無資料庫
- 測試使用內建 `node --test`（搭配 `--experimental-strip-types`）

## Project Conventions

### Code Style
- 全繁體中文註解
- 集中定義共用常數（例如掃描目錄集中在 `src/lib/paths.ts` 的 `SCAN_DIR`），避免各處硬編重複

### Architecture Patterns
- API 路由集中在 `src/app/api/`：`projects`（掃描與設定讀寫）、`dev-server`、`ports`、`processes`、`system-stats`、`git-batch`、`github-check`、`open`
- 前端元件在 `src/components/`（看板、釘選列、Port 管理面板等），共用邏輯與 hook 在 `src/lib/`
- 設定讀寫走 `src/lib/config.ts`：module-level 快取以檔案 mtime 判斷失效，寫入用 atomic write 加 lock 避免並發覆蓋
- Port 分配邏輯在 `src/lib/port-registry.ts`，資料存 `port-registry.json`
- 啟動流程由 `scripts/launch.sh` 負責：port 偵測、依賴自我修復、背景啟動 dev server 並等待就緒

### Testing Strategy
- 測試放在 `tests/`，以 `npm test` 執行（`node --test --experimental-strip-types "tests/**/*.test.ts"`）
- 現有測試涵蓋 port registry、掃描器（scanner）、API guard 等核心邏輯

### Git Workflow
- Branch 命名：`vs/{description}`
- Commit 遵循 Conventional Commits（feat / fix / docs 等）

## Domain Context
- 「專案」= `SCAN_DIR` 底下的一個資料夾；使用者設定以資料夾名稱為 key 存於 `projects-config.json`
- 排除清單存於 `projects-config.json` 的 `_settings.excludePatterns`，用來隱藏 skill 等非專案資料夾

## Important Constraints
- 僅供本機使用，dev server 綁定 `127.0.0.1`，不對外開放
- 依賴 macOS / 類 Unix 的系統指令（`lsof`、`ps`）偵測 port 與 process

## External Dependencies
- 本機檔案系統與系統指令（`lsof`、`ps`、`git`）
- 無外部 API 或資料庫（`github-check` 路由的實際外呼行為待確認）
