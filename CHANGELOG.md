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

## 0.3.0-alpha — 生涯管理與升級入口

### 已完成

- 加入 JSON 存檔匯入預覽、覆蓋確認及獨立存檔刪除確認。
- 將既有資料驅動升級接入生涯中心，包含動態價格、滿級、資源限制與立即保存。
- 加入 Agent 工作類型指派與休息設定的持久化 UI。

### 尚未完成

- 升級效果與 Agent 自動處理尚未接入即時場景；47 關、完整工作區、客戶流程與正式驗收仍未完成。

## 0.4.0-dev - 2026-07-28
- Added five-era, 47-level selection with progression locks and best stars.
- Connected all 11 workstations and the v1 recipe catalog to data-driven Phaser runtime maps.
- Added staged project boxes, wrong-station blocking, customer decisions, post-delivery add-ons, runtime upgrade effects, and limited automatic Agents.
- Added focused unit coverage for all new gameplay rule families.

## 0.5.0-dev — 2026-07-30

- 客戶正式改為六種 2-B 方向的高畫質 2.5D Q 版人類，固定站在櫃檯後；AI、資料夾與工作站保留在前場。
- 全部 11 種工作站升級為 v3 素材；AI 與五紀元背景保留 v2，素材版本可獨立混用。
- 新增頂部圖示訂單卡、個別耐心、最高五人排隊、到客節奏、資料夾交接與交付盤流程。
- 訂單與資料夾改為工作站專屬色的幾何圖示；錯誤機台點擊完全靜默且無扣分，中間步驟不再直接顯示下一站答案。
- 產品需求補齊目的、實際動作與完成成果；接單決策不再只顯示難以理解的產品短文。
- 新增 Era 1–5 首關試玩入口；試玩不寫入正式生涯、獎勵、星級或解鎖。
- 校準首頁／選角 AI 的手機顯示尺寸，並修正舊 service worker 快取造成頁面停留在淘汰介面的問題。
- 完成 390×844 手機直向視覺檢查。
- 修正決策中客戶可能換人、追加可能重複出現、最後瞬間交付可能不計分三個流程問題。
- 本批 `npm test` 22/22、TypeScript check 與 production build 全部通過；僅有既有 Phaser chunk size warning。
