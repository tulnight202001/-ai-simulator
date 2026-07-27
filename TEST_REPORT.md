# Test report — 2026-07-27

**文件版本：0.2.0-alpha｜更新日期：2026-07-27｜程式基準 Commit：bb9d072**

## 本回合結果

| 檢查 | 結果 | 證據／說明 |
|---|---|---|
| GitHub Actions `npm install` | ✅ 通過 | PR #1 最新一次「遊戲建置與測試」已成功安裝官方依賴。 |
| jsDelivr 依賴替代下載 | ⚠️ 環境阻塞 | `curl` 同樣收到 HTTP 403。沒有把遠端 CDN 依賴放進遊戲，以免破壞離線要求。 |
| GitHub Actions `npm test` | ✅ 通過 | PR #1 最新一次 Vitest 已成功完成。 |
| GitHub Actions `npm run check` | ❌ 前次失敗／已修正待重跑 | `tsconfig.json` 先前移除了 `vite/client`，導致 CSS side-effect import 沒有型別宣告；本次已恢復官方 Vite client 型別。 |
| GitHub Actions `npm run build` | ⚠️ 待重跑 | 前次 workflow 在 check 停止，尚未執行 build；本次推送後由同一 workflow 驗證。 |
| iPhone／PWA／離線重啟 | ⚠️ 未能執行 | 無 build／HTTPS Preview；必須在下一個可連 registry 的環境執行。 |
| 文件產生器語法與執行 | ✅ 通過 | Python 編譯檢查通過；成功由 Markdown 產生 `/docs` 與 Google Drive HTML。 |
| 人類文件同步檢查 | ✅ 通過 | 七份指定文件頁皆存在且具內容；五份 Google Drive HTML 均內嵌樣式且沒有網路依賴。 |
| PR 二進位檔檢查 | ✅ 通過 | 相對初始版本的 Git diff 不再包含 ZIP 或其他二進位檔；階段 ZIP 改由 GitHub Actions artifact 保存。 |
| 本機隔離 TypeScript 掃描 | ✅ 通過（輔助） | 使用暫時且未追蹤的依賴型別替身執行全域 `tsc -b`，確認專案自身沒有其他 TypeScript 診斷；正式結果仍以 GitHub Actions 安裝真實套件後的 check 為準。 |
| GitHub Actions CI | ⚠️ 已執行、待修正後重跑 | install 與 test 通過；前次 check 失敗使 build 未執行。本次提交只修正該失敗。 |
| 第一版資料完整性 | ✅ 靜態檢查 | 資料生成明確建立 7 + 10 + 10 + 10 + 10 共 47 關及五紀元；這只驗證資料，不代表關卡已能在場景遊玩。 |
| 正式視覺與響應式 | ⚠️ 重製中／尚未實際驗證 | 已開始替換占位設備與角色並改用全視口容器；尚無依賴完整的 browser build、桌面與 iPhone 截圖證據，不可標示通過。 |

## 下一輪必要驗證

1. `npm install && npm test && npm run check && npm run build`。
2. 啟動 production preview，桌機完成單步與雙步箱子各一次、等待倒數結算，確認 IndexedDB。
3. 以 iPhone 尺寸與真機驗證點擊尋路、互動熱區、安全區、無橫向溢位與背景返回。
4. HTTPS 首次載入後切斷網路、完全關閉再開啟，驗證 app shell、讀檔、重玩與再次自動存檔。
5. Chrome Performance／代表性 iPhone 記錄 FPS、記憶體與溫度；目前尚無可宣稱的效能通過證據。

## 規格驗收狀態

目前只具備第一個垂直切片的程式實作；`GAME_SPEC.md` 第 36 節第一版驗收 **尚未通過**。完整缺口記錄於 `CURRENT_STATE.md` 與 `IMPLEMENTATION_PLAN.md`。
