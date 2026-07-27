# Test report — 2026-07-27

**文件版本：0.2.0-alpha｜更新日期：2026-07-27｜程式基準 Commit：60037d5**

## 本回合結果

| 檢查 | 結果 | 證據／說明 |
|---|---|---|
| GitHub Actions `npm install` | ✅ 通過 | PR #1 最新一次「遊戲建置與測試」已成功安裝官方依賴。 |
| GitHub Actions `npm test` | ✅ 通過 | Vitest 已完成，既有規則與資料完整性測試通過。 |
| GitHub Actions `npm run check` | ✅ 通過 | 失敗原因已確認為 Phaser 第三方宣告檔引用舊式 `ActiveXObject` 全域型別；加入 `@types/node`、保留 `vite/client`，並以標準 `skipLibCheck` 忽略第三方宣告檔相容性問題後通過。專案原始碼仍維持 `strict`。 |
| GitHub Actions `npm run build` | ✅ 通過 | Vite production build 已成功完成，並上傳 `production-build` artifact。 |
| Codex 容器 npm 存取 | ⚠️ 環境限制 | Codex 容器仍會收到 npm registry HTTP 403；正式驗證改由可正常安裝依賴的 GitHub Actions 執行，不影響本次 CI 結果。 |
| iPhone／PWA／離線重啟 | ⚠️ 尚未實際驗證 | 已有成功 build，但仍需 GitHub Pages 或其他 HTTPS Preview 才能進行真機、安裝與離線重啟測試。 |
| 文件產生器語法與執行 | ✅ 通過 | Python 編譯檢查通過；可由 Markdown 產生 `/docs` 與 Google Drive HTML。 |
| 人類文件同步檢查 | ✅ 通過 | 七份指定文件頁及五份 Google Drive HTML 已建立；本次 Markdown 更新需在下一次文件同步時重新產生 HTML。 |
| PR 二進位檔檢查 | ✅ 通過 | PR 不含 ZIP 或其他二進位生成物；階段 ZIP 改由 GitHub Actions artifact 保存。 |
| 第一版資料完整性 | ✅ 靜態檢查 | 資料生成建立 7 + 10 + 10 + 10 + 10 共 47 關及五紀元；這只驗證資料，不代表關卡已全部接入即時場景。 |

## 本次 CI 實際通過項目

1. `npm install`
2. `npm test`
3. `npm run check`
4. `npm run build`
5. production build artifact 上傳

## 下一輪必要驗證

1. 合併 PR #1 並啟用 GitHub Pages，取得 HTTPS 遊戲網址。
2. 桌機完成單步與雙步資料箱各一次、等待倒數結算，確認 IndexedDB。
3. 以 iPhone 尺寸與真機驗證點擊尋路、互動熱區、安全區、無橫向溢位與背景返回。
4. HTTPS 首次載入後切斷網路、完全關閉再開啟，驗證 app shell、讀檔、重玩與再次自動存檔。
5. Chrome Performance／代表性 iPhone 記錄 FPS、記憶體與溫度；目前尚無可宣稱的效能通過證據。

## 規格驗收狀態

目前只具備第一個垂直切片與完整第一版資料／生涯骨架；`GAME_SPEC.md` 第 36 節第一版驗收 **尚未通過**。完整缺口記錄於 `CURRENT_STATE.md` 與 `IMPLEMENTATION_PLAN.md`。
