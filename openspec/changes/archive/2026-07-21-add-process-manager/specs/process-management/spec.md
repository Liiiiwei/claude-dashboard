## ADDED Requirements

### Requirement: Dev Server 啟動

系統 SHALL 提供啟動專案 dev server 的功能，自動分配可用 port（從 3010 開始），啟動前 SHALL 檢查 port 未被佔用。

#### Scenario: 成功啟動 dev server
- **WHEN** 使用者對有 `dev` script 的專案點擊 Dev 按鈕
- **THEN** 系統找到可用 port 並啟動 `npm run dev -p <port>`
- **THEN** 回傳 port 與 PID，按鈕轉為 port 連結

#### Scenario: port 衝突自動跳過
- **WHEN** port 3010 已被佔用
- **THEN** 系統自動嘗試 3011、3012... 直到找到可用 port

### Requirement: Dev Server 狀態偵測

系統 SHALL 用系統層級指令（`lsof`、`ps`）偵測正在執行的 dev server，不依賴 in-memory 狀態。頁面重整後 SHALL 仍能正確顯示執行狀態。

#### Scenario: 頁面重整後仍顯示執行中的 server
- **WHEN** dev server 正在執行，使用者重整頁面
- **THEN** 系統透過 `lsof` 偵測到該 port 仍在監聽
- **THEN** ProjectCard 顯示對應的 port 連結

#### Scenario: server 已停止
- **WHEN** dev server process 已結束
- **THEN** 系統偵測到 port 不再監聽
- **THEN** ProjectCard 恢復顯示 Dev 按鈕

### Requirement: Dev Server 停止

系統 SHALL 提供停止指定 dev server 的功能，透過 PID 終止 process。

#### Scenario: 成功停止 dev server
- **WHEN** 使用者點擊停止按鈕
- **THEN** 系統 kill 對應 PID 的 process
- **THEN** UI 恢復為 Dev 按鈕

### Requirement: 執行狀態面板

Dashboard SHALL 顯示所有執行中的 dev server 清單，包含 port、PID、CPU 使用率、Memory 使用量、對應的專案名稱。

#### Scenario: 顯示執行中的 dev server
- **WHEN** 有一個或多個 dev server 在執行
- **THEN** Dashboard 頂部顯示執行中面板
- **THEN** 每個項目顯示 port、PID、CPU%、Memory、專案名稱
- **THEN** 提供一鍵開啟瀏覽器與停止的操作

#### Scenario: 沒有執行中的 server
- **WHEN** 沒有任何 dev server 在執行
- **THEN** 不顯示執行狀態面板
