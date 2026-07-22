# 專案儀表板（claude dashboard）

本機用的個人專案管理 Dashboard，掃描本機某個資料夾底下的所有專案，用看板呈現狀態、釘選、分組，並可偵測 / 啟動各專案的 dev server、查看執行中的 process 與系統資源。以 Next.js 16 打造，只在本機執行，不對外開放。

## 啟動方式

```bash
scripts/launch.sh
```

啟動腳本會自動：預設使用 **port 3001**；若 3001 已在跑本儀表板就直接開瀏覽器；被其他程式佔用則往上找 3002–3099 的空 port；啟動前自動檢查依賴，缺套件時會先跑 `npm ci`（或 `npm install`）修復。dev server 只綁定 `127.0.0.1`，log 寫在 `/tmp/dashboard-dev.log`。

也可以直接跑 `npm run dev -- -p 3001`，但少了上述防呆與自動修復。

## 環境變數

- `SCAN_DIR`：要掃描的專案根目錄。未設定時預設為 `~/Desktop/vibe-coding playground`（定義於 `src/lib/paths.ts`）。

## 資料檔

- `projects-config.json`：各專案的使用者設定（狀態、分組、優先序、釘選、備註），以專案資料夾名稱為 key；保留 key `_settings` 存放掃描排除清單（`excludePatterns`）。由儀表板 UI 讀寫，也可手動編輯（server 以檔案 mtime 判斷快取失效）。
- `port-registry.json`：各專案固定分配到的 port 對照（`assignments`），加上自動分配的 port 範圍（`portRange`，預設 3010–3099）與 `autoAssign` 開關。

## API 路由

位於 `src/app/api/`：`projects`（掃描與專案設定，GET/PUT/PATCH）、`dev-server`（啟動 / 停止 / 偵測 dev server）、`ports`（port 分配查詢與指派，GET/POST）、`processes`（列出執行中的 localhost 服務與 PID）、`system-stats`（CPU / 記憶體使用率）、`git-batch`（批次查 git 狀態）、`github-check`、`open`（開啟資料夾 / 編輯器）。

## 常用指令

```bash
npm test        # 跑 tests/ 底下的測試（node --test）
npm run build   # 正式編譯
npm run lint    # ESLint 檢查
```
