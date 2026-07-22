## 1. 後端：Obsidian 待辦讀取
- [x] 1.1 在 `src/lib/paths.ts` 集中定義 Obsidian vault 路徑與唯讀白名單（僅允許該目錄下 `.md`）
- [x] 1.2 `src/lib/daily-tasks.ts`：解析 `- [x]` 待辦行，抽出文字、`#tag`、`@負責人`、`📅 日期`、來源檔名（客戶名），略過 `_` 開頭聚合檔
- [x] 1.3 依標籤分組 ai-auto / ai-draft / human / uncategorized，含各組計數
- [x] 1.4 `src/app/api/daily-tasks/route.ts`：`GET` 回傳分組結果；含錯誤處理（vault 不存在時回明確狀態，不 crash）
- [x] 1.5 `tests/daily-tasks.test.ts`：解析器單元測試（tag 分組、日期/負責人抽取、聚合檔略過）

## 2. 前端：面板
- [x] 2.1 `src/lib/useDailyTasks.ts`：取數 hook，含 loading / error / empty / success 四態
- [x] 2.2 `src/components/DailyTasks.tsx`：三分類 pill 切換，未分類預設收合，緊湊可讀
- [x] 2.3 `Dashboard.tsx`：移除分頁切換與佔位，改直接置入 `DailyTasks` 面板

## 3. 看板精簡
- [x] 3.1 `ProjectCard.tsx` 精簡態：預設顯示名稱 / 狀態 / port，描述 / git / 時間戳 hover 或展開才顯示

## 4. 驗收
- [x] 4.1 `npx tsc --noEmit` 通過
- [x] 4.2 `npm test` 全綠（含新解析器測試）
- [x] 4.3 `npm run build` 成功
- [x] 4.4 Playwright 實測：面板顯示待辦、pill 切換、未分類收合、看板精簡態
