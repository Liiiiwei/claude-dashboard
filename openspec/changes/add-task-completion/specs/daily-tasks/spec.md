## MODIFIED Requirements

### Requirement: 日常任務面板直接顯示
Dashboard SHALL 直接顯示日常任務面板，不透過分頁切換；面板 MUST 處理 loading / error / empty / success 四種狀態。各分類內 SHALL 依客戶分組並可摺疊，以控制面板高度。

#### Scenario: 直接可見不需切換
- **WHEN** 使用者載入 Dashboard
- **THEN** 日常任務面板直接呈現，無需點分頁；原「專案看板 / 日常任務」分頁切換已移除

#### Scenario: 分類切換與未分類收合
- **WHEN** 面板載入完成
- **THEN** 提供 ai-auto / ai-draft / human 三分類切換，未分類群組預設收合、可點開

#### Scenario: 按客戶分組摺疊
- **WHEN** 使用者在某分類 pill 下檢視待辦
- **THEN** 待辦依所屬客戶分組，每組顯示客戶名與待辦計數，預設收合，點開才展開該組待辦

## ADDED Requirements

### Requirement: 待辦勾銷寫回
系統 SHALL 提供寫回 API `PATCH /api/daily-tasks`，將使用者選定的未完成待辦於來源 Obsidian 檔中標記為已完成。此為唯讀設計的受控例外：僅允許 `- [ ]` → `- [x] … ✅ YYYY-MM-DD` 勾銷，不得刪除或改動其他內容，且僅限白名單 vault 內的檔案。

#### Scenario: 成功勾銷
- **WHEN** 呼叫 `PATCH /api/daily-tasks`，body 帶 `{ sourceFile, lineNumber, text }` 且該行仍為 `- [ ]` 並與 `text` 相符
- **THEN** 該行改寫為 `- [x] <原內容> ✅ <當日日期>`，回傳計入 `completed`

#### Scenario: 行已變動校驗失敗
- **WHEN** 指定的 `lineNumber` 該行已非 `- [ ]`、已被勾銷、或文字與 `text` 不符
- **THEN** 該筆略過並計入 `failed` 並附 reason，其餘各筆不受影響

#### Scenario: 阻擋越界寫入
- **WHEN** `sourceFile` 解析後落在 vault 白名單目錄之外
- **THEN** 拒絕該筆寫入並計入 `failed`，不觸及該檔

### Requirement: 待辦資料含行號
每筆待辦 SHALL 帶有 `lineNumber`，指向其在來源 `.md` 檔中的 1-based 行號，供寫回精準定位。

#### Scenario: 回傳帶行號
- **WHEN** `GET /api/daily-tasks` 回傳待辦
- **THEN** 每筆待辦含 `lineNumber`，其值對應該待辦在 `sourceFile` 中的實際行號
