# 專案管理儀表板 MVP — 設計規格

## 概述

本機運行的專案管理儀表板，掃描 `~/Desktop/vibe-coding playground/` 目錄，以卡片形式呈現所有專案，提供一鍵開啟 Finder 與 VS Code 的快捷操作。

## 技術棧

- **框架**：Next.js 15（App Router）
- **樣式**：Tailwind CSS
- **語言**：TypeScript
- **資料庫**：無（即時掃描檔案系統）
- **部署**：本機開發模式（`npm run dev`）

## 功能範圍

### 1. 專案掃描

- 固定掃描路徑：`~/Desktop/vibe-coding playground/`
- 掃描該目錄下的第一層資料夾（不遞迴）
- 排除非資料夾項目（如 `.md` 檔案、`.sh` 腳本）
- 每次點擊「刷新」按鈕時重新掃描

### 2. 專案類型自動偵測

依檔案特徵判斷，一個專案可能有多個標籤：

| 檔案特徵 | 標籤 |
|---|---|
| `package.json` 存在 | Node.js |
| `package.json` 內含 `next` 依賴 | Next.js |
| `appsscript.json` 存在 | Apps Script |
| `manifest.json` 存在且含 `manifest_version` | Chrome 擴充 |
| `*.py` 檔案存在 | Python |
| `Dockerfile` 存在 | Docker |
| `.git/` 目錄存在 | Git |
| 只有 `*.html` 檔案 | HTML |
| `*.json` 含 `"nodes"` 和 `"connections"` 欄位 | n8n |

### 3. 專案資訊擷取

每個專案擷取以下資訊：

- **名稱**：資料夾名稱
- **用途說明**：依序嘗試讀取 `CLAUDE.md` 第一個 `#` 標題或首行文字 → `README.md` 第一個 `#` 標題或首行文字 → 空白
- **技術標籤**：自動偵測結果（見上表）
- **最後更新時間**：資料夾的 mtime
- **最近 commit**：有 `.git/` 時執行 `git log -1 --format="%s"` 取得最近 commit 訊息
- **路徑**：完整本機路徑

### 4. 專案卡片 UI

每張卡片包含：
- 專案名稱（粗體）
- 用途說明（灰色副標題，無資料時不顯示）
- 技術標籤列（彩色圓角標籤）
- 底部資訊列：最後更新時間 · 最近 commit 訊息
- 操作按鈕：📂 開啟 Finder、▶ 開啟 VS Code

### 5. 排序與篩選

- **篩選**：頂部橫向標籤列，按技術類型篩選（全部 / Node.js / Next.js / Apps Script / Chrome 擴充 / Python / HTML / n8n）
- **排序**：最近更新優先（預設）、名稱 A-Z
- 篩選和排序狀態不持久化，重新整理頁面後回到預設

### 6. 操作功能

- **開啟 Finder**：呼叫 API Route，執行 `open /path/to/project`
- **開啟 VS Code**：呼叫 API Route，執行 `code /path/to/project`
- **刷新**：重新掃描目錄，更新所有專案資訊

## API Routes

### `GET /api/projects`
掃描目錄並回傳所有專案資訊。

回傳格式：
```json
[
  {
    "name": "ad-manager-pro",
    "description": "Meta 廣告管理後台",
    "path": "/Users/vincentsia/Desktop/vibe-coding playground/ad-manager-pro",
    "tags": ["Next.js", "Git"],
    "lastModified": "2026-03-27T10:00:00Z",
    "lastCommit": "fix: login redirect"
  }
]
```

### `POST /api/open`
開啟 Finder 或 VS Code。

請求格式：
```json
{
  "path": "/path/to/project",
  "action": "finder" | "vscode"
}
```

## UI 設計

- **主題**：深色（暗色背景、亮色文字）
- **佈局**：頂部標題列 + 篩選列 + 卡片 grid
- **卡片排列**：CSS Grid，桌面 3 欄、小螢幕自動縮減
- **狀態處理**：
  - 載入中：首次載入顯示 skeleton 卡片
  - 空狀態：「沒有找到任何專案」提示
  - 錯誤：頂部 toast 提示

## 不在 MVP 範圍

- 開發進度追蹤（進度條/百分比）
- 活躍度熱力圖 / KPI 統計
- 歸檔功能
- 淺色主題
- 時間軸視圖
- 響應式平板支援
- 匯出報表
- 自然語言搜尋
