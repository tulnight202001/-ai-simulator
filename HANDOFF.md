# AI Simulator — Codex Cloud Handoff

## 讀取順序

1. `CODEX_TASK.md`
2. `GAME_SPEC.md`
3. Codex 建立的 `IMPLEMENTATION_PLAN.md`
4. `CURRENT_STATE.md`
5. `TEST_REPORT.md`

## 專案狀態

- 目前只有完整規格，尚未建立程式。
- 第一版為單人 PWA／Web 遊戲。
- 核心不使用真實 AI API。
- 手機優先、電腦可玩、首次快取後離線。
- 正式開發必須以 `GAME_SPEC.md` 為準。
- 中文正式名稱末尾的 `⋯` 是 U+22EF，不能替換。

## Codex Cloud 使用方式

將此 Repository 連接至 Codex Cloud Environment 後，直接提交：

> 請執行 `CODEX_TASK.md`。先完整閱讀 `GAME_SPEC.md`，建立實作計畫與第一個可測試垂直切片。不得縮減第一版必要範圍。所有進度、測試與阻塞更新到 Repository 文件中。

## 每次任務結束前

- Commit 所有已完成變更。
- 更新 `CURRENT_STATE.md`。
- 更新 `TEST_REPORT.md`。
- 說明 Preview／Deployment URL。
- 列出下一步與仍未完成規格。
