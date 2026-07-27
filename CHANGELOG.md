# 重要變更紀錄

**文件版本：0.2.0-alpha｜更新日期：2026-07-27｜程式基準 Commit：bb9d072**

本文件用一般讀者能理解的方式記錄重要成果。GitHub 的 Commit 歷史仍是最完整、最主要的版本備份。

## 0.2.0-alpha — PR 二進位檔清理

### 已完成

- 從 Git 追蹤與 PR 差異移除階段 ZIP；程式碼、Markdown、HTML、產生器與 workflows 全數保留。
- ZIP 改由 `release-archive.yml` 在 GitHub Actions 產生並保存為 artifact，不再 Commit 二進位本體。
- `.gitignore` 新增 ZIP、build、快取，以及生成型 PNG、ICO、音訊格式，避免再次阻止 Codex Cloud 建立 PR。

## 0.2.0-alpha — 完整內容資料與生涯骨架

### 部分完成

- 加入五紀元共 47 關、全部 11 個工作區、單步至完整歌曲與 MV 配方、客戶及升級的資料表。
- 加入多模型生涯、舊存檔 migration、重玩獎勵上限、長期數值、升級、Agent、總評與無限解鎖的核心資料。
- 加入稀有模型抽取、多存檔入口、JSON 下載與 GitHub Actions install／test／check／build 設定。

### 尚未完成

- 上述完整資料尚未全部接入即時工作站；47 關仍不可逐關實際遊玩。
- Codex npm proxy 仍回應 403；目前沒有 Git remote，CI 與 Pages 尚未能在 GitHub 實際執行。

## 0.2.0-alpha — 人類可閱讀文件與備份流程

### 已完成

- 新增手機可閱讀的 `/docs` 專案狀態首頁及所有指定文件連結。
- 新增可單獨開啟、可手動上傳 Google Drive 的五份 HTML 文件。
- 新增單一來源產生器：HTML 一律由 Repository Markdown 產生，避免維護兩套互相矛盾的文字。
- 新增不含依賴、快取、憑證或 Token 的階段 ZIP 產生流程。
- 新增 GitHub Pages 自動發布設定；Repository 管理者仍需在 Pages 設定中選擇 GitHub Actions。

### 阻塞

- 尚未取得 Repository 的 GitHub Pages 公開網址，因此目前只能直接開啟 `/docs/index.html` 或由管理者啟用發布。

## 0.1.0 — 第一個可玩垂直切片

### 部分完成

- 建立主選單、模型三選一、斜上方小型工作站、資料箱、單步與雙步任務、負載、結算、本機存檔及 PWA 骨架。
- 這只是完整第一版的第一階段，不是五紀元與約 47 關的正式完成版本。

### 尚未完成

- 客戶決策、追加返工、完整工作區、升級、Agent、生涯總評、無限模式及完整手機／離線驗收。

## 0.2.0-alpha — 響應式工作站視覺重製

### 已完成

- 重製既有 2.5D 工作站的地板、透視網格、設備、玩家與 HUD 視覺層級。
- 加入安全區感知的全螢幕遊戲外框、桌機控制提示及窄版直向裝置旋轉提示。
- 僅調整視覺與響應式呈現；保留最新 main 的 TypeScript、CI、diagnostics artifact 與建置修正。
