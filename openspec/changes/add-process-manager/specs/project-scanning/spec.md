## ADDED Requirements

### Requirement: 專案排除機制

Scanner SHALL 支援排除特定資料夾，不將其顯示在看板中。排除規則儲存在 `projects-config.json` 的 `_settings.excludePatterns` 陣列中，支援 glob pattern。

#### Scenario: 排除符合 pattern 的資料夾
- **WHEN** `excludePatterns` 包含 `"Claude*"`
- **THEN** 名稱以 `Claude` 開頭的資料夾不出現在專案清單中

#### Scenario: 排除單一專案
- **WHEN** 使用者在 ProjectCard 點擊「隱藏此專案」
- **THEN** 該專案名稱被加入 `excludePatterns`
- **THEN** 重新掃描後該專案不再顯示

#### Scenario: 恢復被排除的專案
- **WHEN** 使用者在設定區域查看已排除清單
- **THEN** 可以移除特定 pattern 或專案名稱
- **THEN** 重新掃描後該專案重新出現
