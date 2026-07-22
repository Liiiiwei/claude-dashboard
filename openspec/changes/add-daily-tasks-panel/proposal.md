# Change: 新增「日常任務」面板，直讀 Obsidian 跨客戶待辦

## Why
Dashboard 現有的「日常任務」分頁只是佔位（顯示「即將推出」），使用者幾乎不用；而使用者真正的跨客戶待辦已存在 Obsidian vault，靠 Dataview 聚合。目標是讓 Dashboard 直接顯示這些待辦，且不再藏在分頁後面。同時看板卡片資訊過密、整頁過長，需精簡。

## What Changes
- 新增唯讀 API `GET /api/daily-tasks`：掃描 Obsidian vault（`02-Projects/接案專案`、`02-Projects/公司專案`），解析 `- [ ]` 待辦行，依行內 `#ai-auto` / `#ai-draft` / `#human` 標籤分組，無標籤歸「未分類」。
- 新增前端 `DailyTasks` 面板：三分類 pill 切換（ai-auto / ai-draft / human），未分類預設收合；直接顯示，不走分頁切換。
- 移除 Dashboard 的「專案看板 / 日常任務」分頁切換與佔位畫面。
- 看板 `ProjectCard` 改精簡態：預設只顯示名稱、狀態、port，描述 / git / 時間戳於 hover 或展開時才顯示，降低整頁高度。
- Obsidian vault 路徑集中設定並納入讀取白名單，僅允許唯讀掃描該目錄下的 `.md`。

## Impact
- Affected specs: `daily-tasks`（新增）
- Affected code: 新增 `src/app/api/daily-tasks/route.ts`、`src/lib/daily-tasks.ts`（解析）、`src/lib/useDailyTasks.ts`、`src/components/DailyTasks.tsx`；修改 `src/lib/paths.ts`（vault 路徑白名單）、`src/components/Dashboard.tsx`（移除分頁、置入面板）、`src/components/ProjectCard.tsx`（精簡態）
- 非破壞：不改動既有 API 契約；v1 唯讀，不寫回 Obsidian
