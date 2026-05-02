## 1. 排除機制

- [x] 1.1 `config.ts` 加入 `_settings.excludePatterns` 讀寫函式
- [x] 1.2 `scanner.ts` 掃描時依 excludePatterns 過濾資料夾
- [x] 1.3 ProjectCard 展開面板加「隱藏此專案」按鈕，寫入 exclude
- [x] 1.4 FilterBar 或設定區域顯示已排除的項目，可恢復

## 2. Dev Server 重寫

- [x] 2.1 建立 `src/lib/process-detect.ts`，用 `lsof` + `ps` 偵測監聽中的 dev server
- [x] 2.2 建立 port 可用性檢查工具函式（`net.createServer` 測試）
- [x] 2.3 重寫 `api/dev-server/route.ts`：start 用可用 port、status 用系統偵測、stop 用 PID kill
- [x] 2.4 ProjectCard 的 Dev 按鈕改為啟動時顯示 loading -> 成功後顯示 port 連結，頁面重整後仍能偵測狀態

## 3. 執行狀態面板

- [x] 3.1 新增 `api/processes/route.ts`，回傳所有監聯中的 Node dev server（port、PID、CPU%、Memory、對應專案）
- [x] 3.2 Dashboard 新增「執行中」區塊，列出跑中的 dev server，可一鍵開啟或停止
- [x] 3.3 顯示 CPU / Memory 使用量（透過 `ps -o %cpu,%mem -p <pid>`）
