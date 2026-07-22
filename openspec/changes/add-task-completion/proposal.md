# Change: 日常任務面板按客戶分組摺疊 + 勾銷寫回 Obsidian

## Why
日常任務面板 v1 上線後有兩個問題：一是選到「人工」分類時一次列出 44 筆待辦，整頁過長難用；二是面板唯讀，使用者看到已完成的待辦只能回 Obsidian 手動勾銷，無法在 dashboard 直接處理。本 change 讓面板可依客戶分組摺疊收短，並允許在 dashboard 批次「標記完成」把待辦勾銷寫回 Obsidian。

## What Changes
- 面板在各分類 pill 內改「按客戶分組」：每個客戶一個可摺疊區塊（客戶名＋待辦計數），預設收合，點開才展開該客戶待辦，明顯縮短整頁高度。
- 每筆待辦加入多選 checkbox（可跨客戶多選），面板提供「標記完成 (N)」動作。
- 新增寫回 API `PATCH /api/daily-tasks`：把選中的 `- [ ]` 待辦行改寫為 `- [x] … ✅ YYYY-MM-DD`，僅允許白名單 vault 內、且以行號＋原文校驗確認未誤勾。此為 v1 唯讀設計的**受控例外**：只做勾銷（可回溯），不刪除、不改動其他內容。
- 標記完成前需二次確認；寫回進行中禁用動作按鈕；成功後重新載入面板並清空選取。
- 待辦資料結構新增 `lineNumber`（來源 `.md` 檔內行號），供寫回精準定位。

## Impact
- Affected specs: `daily-tasks`（MODIFIED：面板顯示；ADDED：勾銷寫回）
- Affected code: 修改 `src/lib/types.ts`（`DailyTask.lineNumber`）、`src/lib/daily-tasks.ts`（parse 帶行號＋新增 completeTasks 寫回層）、`src/app/api/daily-tasks/route.ts`（新增 PATCH handler）、`src/lib/useDailyTasks.ts`（新增 completeTasks mutation）、`src/components/DailyTasks.tsx`（客戶分組摺疊＋多選＋標記完成＋二次確認）
- 破壞性考量：寫回會改動使用者 Obsidian 筆記，但限定「`- [ ]`→`- [x]` 勾銷」單一操作，行為可回溯；以行號＋原文雙重校驗防誤勾，校驗不符則該筆略過並回報，不中斷其他筆。
