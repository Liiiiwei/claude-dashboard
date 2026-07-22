## ADDED Requirements

### Requirement: Obsidian 待辦讀取 API
系統 SHALL 提供唯讀 API `GET /api/daily-tasks`，掃描設定的 Obsidian vault 專案資料夾，解析 Markdown 待辦行並回傳分組結果。此 API MUST 僅讀取白名單目錄下的 `.md` 檔，且不得寫入 Obsidian。

#### Scenario: 成功回傳分組待辦
- **WHEN** 呼叫 `GET /api/daily-tasks` 且 vault 可讀
- **THEN** 回傳 JSON，含 `ai-auto`、`ai-draft`、`human`、`uncategorized` 四組未完成待辦與各組計數

#### Scenario: 只取未完成待辦
- **WHEN** 專案檔同時含 `- [ ]` 與 `- [x]` 行
- **THEN** 僅 `- [ ]`（未完成）行進入回傳結果，`- [x]` 被排除

#### Scenario: 略過聚合檔
- **WHEN** vault 內存在底線開頭的聚合檔（如 `_全客戶待辦.md`）
- **THEN** 該檔內容不被解析（避免把 Dataview 查詢碼當待辦）

#### Scenario: vault 不存在
- **WHEN** 設定的 vault 路徑不存在或不可讀
- **THEN** API 回傳明確的錯誤狀態而非 crash，前端可顯示錯誤態

### Requirement: 待辦分類與欄位抽取
系統 SHALL 依待辦行內的標籤分組，並抽取結構化欄位供前端顯示。

#### Scenario: 依標籤分組
- **WHEN** 待辦行含 `#ai-auto`、`#ai-draft` 或 `#human`
- **THEN** 該待辦歸入對應分組；三者皆無時歸入 `uncategorized`

#### Scenario: 抽取欄位
- **WHEN** 待辦行含 `@負責人` 與 `📅 YYYY-MM-DD`
- **THEN** 回傳的待辦物件帶有負責人與到期日欄位；缺項為 null。客戶名取自來源檔名（去 `.md`）

### Requirement: 日常任務面板直接顯示
Dashboard SHALL 直接顯示日常任務面板，不透過分頁切換；面板 MUST 處理 loading / error / empty / success 四種狀態。

#### Scenario: 直接可見不需切換
- **WHEN** 使用者載入 Dashboard
- **THEN** 日常任務面板直接呈現，無需點分頁；原「專案看板 / 日常任務」分頁切換被移除

#### Scenario: 分類切換與未分類收合
- **WHEN** 面板載入完成
- **THEN** 提供 ai-auto / ai-draft / human 三分類切換，未分類群組預設收合、可點開
