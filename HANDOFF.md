# AI Simulator — Codex Cloud Handoff

**文件版本：0.2.0-alpha｜更新日期：2026-07-27｜程式基準 Commit：bb9d072**

## 讀取順序

非工程背景或快速接手的最短順序：

1. `/docs/index.html`：一頁掌握版本、完成度、問題與下一步。
2. `CURRENT_STATE.md`：確認能測什麼、不能測什麼。
3. `NEXT_STEPS.md`：直接取得下一階段工作清單。
4. `GAME_SPEC.md`：動工前確認完整且最高優先的第一版需求。
5. `IMPLEMENTATION_PLAN.md`、`TEST_REPORT.md`：確認架構階段及驗證證據。

工程開發前仍須遵守 `AGENTS.md` 指定的完整讀取順序。

## 專案狀態（2026-07-27）

- 已建立第一個可玩垂直切片的 TypeScript／Phaser／PWA 程式與資料驅動核心；這不是完整第一版。
- 第一版為單人 PWA／Web 遊戲。
- 核心不使用真實 AI API。
- 手機優先、電腦可玩、首次快取後離線。
- 正式開發必須以 `GAME_SPEC.md` 為準。
- 中文正式名稱末尾的 `⋯` 是 U+22EF，不能替換。
- 現有切片包含主選單、模型三選一、180 秒 2.5D 工作站、四設備、資料箱、單／雙步任務、五項負載、星級、IndexedDB 與 service worker。
- 此環境的 npm registry／jsDelivr 回應 HTTP 403，依賴未能安裝，故尚無 build、瀏覽器或公開 Preview 證據；詳細命令見 `TEST_REPORT.md`。

## 接手後第一步

1. 在可存取 npm registry 的環境執行 `npm install && npm test && npm run check && npm run build`。
2. 修正型別或 runtime 問題後，以 HTTPS 部署 Preview，完成桌機、iPhone 與斷網重啟驗證。
3. 按 `IMPLEMENTATION_PLAN.md` 第二階段實作客戶決策、追加返工、完整工作區、升級與多存檔；不可把目前切片標成第一版完成。

## Codex Cloud 使用方式

將此 Repository 連接至 Codex Cloud Environment 後，直接提交：

> 請執行 `CODEX_TASK.md`。先完整閱讀 `GAME_SPEC.md`，建立實作計畫與第一個可測試垂直切片。不得縮減第一版必要範圍。所有進度、測試與阻塞更新到 Repository 文件中。

## 每次任務結束前

- Commit 所有已完成變更。
- 更新 `CURRENT_STATE.md`。
- 更新 `TEST_REPORT.md`。
- 說明 Preview／Deployment URL。
- 列出下一步與仍未完成規格。
- 更新 `CHANGELOG.md` 與 `NEXT_STEPS.md`，並為七份主要文件填入日期、版本和程式基準 Commit。
- 執行 `python3 scripts/build_human_docs.py`，確認 `/docs` 與 `/exports/google-drive` 和 Markdown 同步。
- 正式階段推送後確認 `release-archive.yml` 成功產生 ZIP artifact；本機產生的 ZIP 已被忽略，不得加入 Git。
- GitHub Pages 只發布 `/docs`；Google Drive HTML 與 ZIP 由使用者或其他已授權工具手動上傳，不把 OAuth Token 放進 Repository。

## 本次交接：響應式視覺重製

- `src/game/WorkstationScene.ts`、`src/main.ts` 與 `src/style.css` 已完成既有垂直切片的響應式視覺重製，未更動資料、生涯、依賴、TypeScript 或 CI 設定。
- 容器執行 `npm install` 時 npm registry 回應 HTTP 403，連帶使本機 test、check、build 缺少依賴；應由既有 GitHub Actions 在可下載依賴的環境重新確認。
- 本次範圍到此停止，仍不得把垂直切片標示為完整第一版。
