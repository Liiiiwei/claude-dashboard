# Tasks: 日常任務面板分組摺疊 + 勾銷寫回

## 1. 後端資料層與寫回 API
- [x] 1.1 `DailyTask` 新增 `lineNumber: number`（來源 `.md` 檔內 1-based 行號）
- [x] 1.2 `daily-tasks.ts` 解析時帶入 `lineNumber`（相對其 `sourceFile`）
- [x] 1.3 新增 `completeTasks` 寫回層：逐筆定位 `sourceFile:lineNumber`，校驗該行仍為 `- [ ]` 且文字相符，改寫為 `- [x] … ✅ YYYY-MM-DD`
- [x] 1.4 路徑穿越防護沿用 vault 邊界檢查；vault 外或檔案不存在該筆記為 failed
- [x] 1.5 校驗不符（行已變動 / 已勾銷 / 文字不符）該筆略過並回報 reason，不中斷其他筆
- [x] 1.6 `PATCH /api/daily-tasks` handler：接 `{ tasks: [{sourceFile,lineNumber,text}] }`，回 `{ completed, failed:[{sourceFile,lineNumber,reason}], generatedAt }`
- [x] 1.7 後端測試：正常勾銷、行已變動校驗失敗、path traversal 阻擋、日期格式

## 2. 前端面板
- [x] 2.1 `useDailyTasks` 新增 `completeTasks(tasks)` mutation，成功後 refetch
- [x] 2.2 各分類 pill 內按 `client` 分組，每客戶可摺疊區塊（名稱＋計數），預設收合
- [x] 2.3 每筆待辦加多選 checkbox，可跨客戶多選，維持已選狀態
- [x] 2.4 「標記完成 (N)」按鈕：二次確認 → 呼叫 completeTasks → 寫回中禁用 → 成功後清空選取
- [x] 2.5 維持 loading / error / empty / success 四態；寫回失敗顯示哪幾筆未成功
- [x] 2.6 未分類群組維持既有收合行為

## 3. 驗證
- [x] 3.1 tsc 無誤、既有測試不回歸、新測試通過
- [x] 3.2 Playwright 逐態驗：分組收合/展開、多選、標記完成二次確認、寫回後 refetch
- [x] 3.3 實打 PATCH 驗 Obsidian 檔確實由 `- [ ]` 變 `- [x] ✅ 日期`（測試後還原）
