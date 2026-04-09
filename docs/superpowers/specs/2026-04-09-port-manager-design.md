# Port Manager — 設計規格

**日期**: 2026-04-09
**狀態**: Draft

## 問題

開發過程中會累積大量佔用 port 的 process：同一專案重複啟動、不同工具混佔、關掉 terminal 後殭屍 process 殘留。目前 dashboard 沒有統一管理機制。

## 設計目標

1. **固定 port 分配** — 每個專案記住自己的 port，重啟後不會漂移
2. **自動防呆** — 啟動時偵測重複、清理殭屍
3. **手動管理面板** — 頂部狀態列整合，可查看全部 port 並逐一或批次 kill

## 架構

### 1. Port Registry (`port-registry.json`)

存放在專案根目錄，結構：

```json
{
  "assignments": {
    "/Users/.../project-a": 3010,
    "/Users/.../project-b": 3011
  },
  "portRange": { "min": 3010, "max": 3099 },
  "autoAssign": true
}
```

- `assignments`: 專案絕對路徑 → 固定 port
- `portRange`: 自動分配的搜尋範圍
- `autoAssign`: true 時首次啟動未註冊專案會自動分配並寫入

### 2. Port Registry 模組 (`src/lib/port-registry.ts`)

職責：讀寫 `port-registry.json`，提供以下功能：

- `getAssignedPort(projectPath)` — 回傳該專案的固定 port，若無且 `autoAssign` 為 true 則自動分配下一個可用 port 並寫入
- `setAssignedPort(projectPath, port)` — 手動指定 port
- `removeAssignment(projectPath)` — 移除分配
- `getAllAssignments()` — 回傳全部分配表
- `getPortRange()` — 回傳 portRange 設定

實作模式參照既有的 `src/lib/config.ts`（module-level cache + readFile/writeFile）。

### 3. 修改 Dev Server API (`src/app/api/dev-server/route.ts`)

**啟動流程變更**：

```
POST { path, action: "start" }
  1. detectServerForPath(path) — 若已在跑，直接回傳
  2. getAssignedPort(path) — 取得固定 port（或自動分配新 port）
  3. 檢查該 port 是否被其他 process 佔用
     - 若被佔用 → kill 佔用的 process（殭屍清理）
  4. spawn npm run dev -p <port>
  5. 回傳 { running: true, port, pid }
```

移除原本的 `findAvailablePort(3010)` 邏輯，改用 registry。

### 4. 新增 Port Management API (`src/app/api/ports/route.ts`)

**GET** — 回傳所有 port 狀態：
```json
{
  "ports": [
    {
      "pid": 12345,
      "port": 3010,
      "projectName": "project-a",
      "projectPath": "/Users/.../project-a",
      "cpu": 2.1,
      "mem": 1.5,
      "assigned": true,
      "status": "running"
    }
  ],
  "registry": {
    "/Users/.../project-a": 3010,
    "/Users/.../project-b": 3011
  }
}
```

合併兩個資料來源：
- `detectListeningServers()` — 實際跑著的 process
- `getAllAssignments()` — registry 中的分配

這樣 UI 可以顯示：哪些在跑、哪些已分配但沒跑、哪些在跑但沒分配（外部 process）。

**POST** — port 操作：
- `{ action: "kill", pid: number }` — kill 單一 process
- `{ action: "killAll" }` — kill 所有 3000-9999 的 Node process
- `{ action: "assign", projectPath: string, port: number }` — 手動指定 port
- `{ action: "unassign", projectPath: string }` — 移除分配

### 5. 頂部狀態列 Port 面板

在現有的系統狀態列（CPU/RAM bar）右側整合 port 管理：

**收合狀態**（預設）：
```
CPU [====] 12%  |  RAM [======] 45%  |  Ports: 3 running  [管理]
```

**展開狀態**（點擊「管理」）：
展開一個 dropdown 面板，列出所有佔用的 port：

```
┌──────────────────────────────────────────────┐
│  Port 管理                    [全部終止]      │
├──────────────────────────────────────────────┤
│  :3000  dashboard (this)       — 略過         │
│  :3010  project-a    CPU 2%   [x] 終止        │
│  :3011  project-b    CPU 0%   [x] 終止        │
│  :3456  (未知)       CPU 5%   [x] 終止        │
├──────────────────────────────────────────────┤
│  已分配但未啟動:                               │
│  :3012  project-c                             │
└──────────────────────────────────────────────┘
```

功能：
- 每個 process 顯示 port、專案名、CPU 使用量
- 逐一終止按鈕
- 全部終止按鈕（排除 dashboard 自身）
- 未分配的 process 標記為「未知」
- 已分配但未啟動的專案列在下方（灰色）

### 6. 自動防呆邏輯

整合在 `dev-server/route.ts` 的啟動流程中：

1. **重複啟動防護** — `detectServerForPath()` 已存在，保留
2. **Port 衝突解決** — 啟動前檢查 assigned port 是否被佔，若是則先 kill
3. **殭屍偵測** — `/api/ports` GET 時比對 registry 與實際 process，標記不一致的為可疑

不新增定時清理機制，依賴使用者透過面板手動操作或啟動時自動處理。

## 元件結構

```
src/lib/port-registry.ts          — registry 讀寫
src/app/api/ports/route.ts        — port 管理 API
src/components/PortManager.tsx     — 頂部面板元件
```

修改既有檔案：
- `src/app/api/dev-server/route.ts` — 改用 registry 取得 port
- `src/components/Dashboard.tsx` — 整合 PortManager 元件到狀態列

## 不做的事

- 不做 port 歷史紀錄
- 不做定時自動清理排程
- 不做非 Node process 的偵測（維持現有 lsof 過濾邏輯）
- 不做 port forwarding 或 proxy
