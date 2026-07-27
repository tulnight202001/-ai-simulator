# Test report — 2026-07-27

**文件版本：0.2.0-alpha｜更新日期：2026-07-27｜程式基準 Commit：bb9d072**

## 本回合結果

| 檢查 | 結果 | 證據／說明 |
|---|---|---|
| `npm install` | ⚠️ 環境阻塞 | registry 對 `phaser`（以及初次嘗試的 `@types/node`）回應 `403 Forbidden`；並非測試失敗。 |
| jsDelivr 依賴替代下載 | ⚠️ 環境阻塞 | `curl` 同樣收到 HTTP 403。沒有把遠端 CDN 依賴放進遊戲，以免破壞離線要求。 |
| `npm test` | ⚠️ 未能執行 | 因 Vitest 無法安裝；測試原始碼覆蓋任務順序、防止錯站加工、完成狀態、星級、過載減速與內容參照完整性。 |
| `npm run build` | ⚠️ 未能執行 | 因 TypeScript、Vite 與 Phaser 無法安裝。 |
| iPhone／PWA／離線重啟 | ⚠️ 未能執行 | 無 build／HTTPS Preview；必須在下一個可連 registry 的環境執行。 |
| 文件產生器語法與執行 | ✅ 通過 | Python 編譯檢查通過；成功由 Markdown 產生 `/docs` 與 Google Drive HTML。 |
| 人類文件同步檢查 | ✅ 通過 | 七份指定文件頁皆存在且具內容；五份 Google Drive HTML 均內嵌樣式且沒有網路依賴。 |
| PR 二進位檔檢查 | ✅ 通過 | 相對初始版本的 Git diff 不再包含 ZIP 或其他二進位檔；階段 ZIP 改由 GitHub Actions artifact 保存。 |
| 全域 TypeScript 掃描 | ⚠️ 部分執行 | 系統全域 `tsc` 可解析新核心；剩餘錯誤是尚未能下載的 Phaser、Vitest、Vite 型別。不能取代正式 `npm run check`。 |
| GitHub Actions CI | ⚠️ 尚未執行 | 已建立官方 Node 22、`npm install`、test、check、build workflow；目前 Repository 沒有 Git remote，Codex 無法 push 觸發。 |
| 第一版資料完整性 | ✅ 靜態檢查 | 資料生成明確建立 7 + 10 + 10 + 10 + 10 共 47 關及五紀元；這只驗證資料，不代表關卡已能在場景遊玩。 |

## 下一輪必要驗證

1. `npm install && npm test && npm run check && npm run build`。
2. 啟動 production preview，桌機完成單步與雙步箱子各一次、等待倒數結算，確認 IndexedDB。
3. 以 iPhone 尺寸與真機驗證點擊尋路、互動熱區、安全區、無橫向溢位與背景返回。
4. HTTPS 首次載入後切斷網路、完全關閉再開啟，驗證 app shell、讀檔、重玩與再次自動存檔。
5. Chrome Performance／代表性 iPhone 記錄 FPS、記憶體與溫度；目前尚無可宣稱的效能通過證據。

## 規格驗收狀態

目前只具備第一個垂直切片的程式實作；`GAME_SPEC.md` 第 36 節第一版驗收 **尚未通過**。完整缺口記錄於 `CURRENT_STATE.md` 與 `IMPLEMENTATION_PLAN.md`。
