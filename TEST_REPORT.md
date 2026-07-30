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

1. GitHub Pages 已啟用；後續以既有 HTTPS 網址持續驗證手機與 PWA 行為。
2. 桌機完成單步與雙步資料箱各一次、等待倒數結算，確認 IndexedDB。
3. 以 iPhone 尺寸與真機驗證點擊尋路、互動熱區、安全區、無橫向溢位與背景返回。
4. HTTPS 首次載入後切斷網路、完全關閉再開啟，驗證 app shell、讀檔、重玩與再次自動存檔。
5. Chrome Performance／代表性 iPhone 記錄 FPS、記憶體與溫度；目前尚無可宣稱的效能通過證據。

## 規格驗收狀態

目前只具備第一個垂直切片與完整第一版資料／生涯骨架；`GAME_SPEC.md` 第 36 節第一版驗收 **尚未通過**。完整缺口記錄於 `CURRENT_STATE.md` 與 `IMPLEMENTATION_PLAN.md`。

## 響應式視覺重製驗證

| 檢查 | 結果 | 證據／說明 |
|---|---|---|
| `npm install` | ⚠️ 環境限制 | npm registry 對 `@types/node` 回應 HTTP 403，未改動或移除最新 main 的依賴設定。 |
| `npm test` | ⚠️ 受安裝阻塞 | 因依賴無法安裝，容器內找不到 `vitest`；最新 main 的 CI 測試設定保持不變。 |
| `npm run check` | ⚠️ 受安裝阻塞 | 缺少未能下載的 `node` 與 `vite/client` 型別；`tsconfig.json` 的 types 與 `skipLibCheck` 完整保留。 |
| `npm run build` | ⚠️ 受安裝阻塞 | TypeScript 先因相同缺少依賴而停止，未進入 Vite build；正式 CI 設定未更動。 |
| 變更範圍 | ✅ 通過 | 未修改 `package.json`、`tsconfig.json` 或 `.github/workflows`，保留最新 main 的安裝、診斷 artifact、測試、檢查與建置修正。 |

## 2026-07-27 生涯管理 UI 驗證

| 檢查 | 結果 | 證據／說明 |
|---|---|---|
| `npm install` | ⚠️ 環境限制 | registry 對 `@types/node` 回應 HTTP 403。 |
| `npm test` | ⚠️ 受安裝阻塞 | 容器無 `vitest` 可執行檔。 |
| `npm run check` | ⚠️ 受安裝阻塞 | 缺少未能下載的 `node` 與 `vite/client` 型別。 |
| `npm run build` | ⚠️ 受安裝阻塞 | TypeScript 因相同缺少依賴而停止。 |
| `python3 -m py_compile scripts/build_human_docs.py scripts/create_release_zip.py` | ✅ 通過 | 文件與封裝腳本語法有效。 |
| `git diff --check` | ✅ 通過 | 變更無空白錯誤。 |
| 瀏覽器截圖 | ⚠️ 受安裝阻塞 | 無法啟動 Vite，故本回合沒有偽造 UI 截圖。 |

## 2026-07-28 執行期資料整合

- `npm test`：通過，3 個測試檔、17 個測試。新增關卡解鎖、配方階段、錯站阻擋、客戶決策、追加、升級效果、Agent 指派／限制覆蓋。
- `npm run check`：通過，未略過專案原始碼檢查。
- `npm run build`：通過；Vite 僅回報既有的單一 Phaser bundle 大於 500 kB 警告。
- GitHub Actions：本地 commit 後建立 PR，遠端狀態待 workflow 回報。

## 2026-07-30 客戶 v3、排隊訂單與試玩模式

| 檢查 | 結果 | 證據／說明 |
|---|---|---|
| `npm test` | ✅ 通過 | 3 個測試檔、22/22 測試通過；包含佇列、個別耐心、決策、交付、追加只出現一次與品質只計算一次。 |
| `npm run check` | ✅ 通過 | `tsc -b --pretty false` 通過，未降低 strict 檢查。 |
| `npm run build` | ✅ 通過 | production build 完成；僅有既存 Phaser 單一 bundle 大於 500 kB 的效能警告。 |
| 390×844 手機直向冒煙 | ✅ 通過 | 本機 Era 5 首關顯示頂部三張訂單卡、排隊數、個別耐心、五個客戶槽與前後場分層；客戶在櫃檯後、AI 在前場。 |
| 接單與一步加工 | ✅ 通過 | 點擊需求櫃檯可看到目的／動作／成果與五種決策；接受後資料夾交到 AI 手上，前往正確文字工作站後進度由 0/4 變為 1/4。 |
| v3 客戶圖片 | ✅ 通過 | `artCatalog` 六條 v3 路徑存在，透明邊角與尺寸後製檢查通過；本機關卡載入無客戶破圖。 |
| v3 工作站與幾何委託 | ✅ 通過 | 11 種工作站均由 v3 路徑載入；訂單卡與客戶／AI 資料夾顯示工作站專屬色及幾何圖示，單步圖示置中。 |
| 錯站與答案隱藏 | ✅ 程式檢查 | 錯機台分支沒有提示、震動、音效、扣分或負載變化；中間步驟完成後只提示對照圖案，不顯示下一站文字答案。 |
| 首頁／選角與快取 | ✅ 通過 | 390×844 下 AI 顯示尺寸與裁切正常；開發模式清除舊 SW 控制，正式版使用 `ai-simulator-v5-20260730` network-first 更新並保留離線回退。 |
| 試玩隔離 | ✅ 程式與測試通過 | Era 1–5 首關均可直接啟動；試玩結算不呼叫正式星級、獎勵、解鎖或 IndexedDB 保存。 |
| iPhone 真機 | ⚠️ 待使用者驗收 | 已完成等比例手機視窗檢查，仍需公開版本更新後由 iPhone 實際觸控與效能驗收。 |

註：首次在受限沙箱執行 Vitest 時，esbuild 子程序因 `spawn EPERM` 無法啟動；改在允許本機子程序的相同工作區執行後一次通過。這是執行環境限制，不是測試失敗。

## 2026-07-30 任務資訊與 Agent 並行完成驗收

本批程式、自動測試、型別檢查、建置及一次 390×844 視覺／玩法冒煙均已完成。

| 驗收項目 | 目前狀態 | 完成判準 |
|---|---|---|
| `npm test` | ✅ 通過 | 3 個測試檔、27/27 測試通過。 |
| `npm run check` | ✅ 通過 | TypeScript 檢查通過，未降低專案 strict 檢查。 |
| `npm run build` | ✅ 通過 | Production build 完成；僅有既存 Phaser chunk size warning。 |
| 十一機台大型圖示與配色 | ✅ 通過 | 390×844 Era 5 下，大型功能圖示、主色與輪廓可辨識全部十一種工作區；訂單與資料夾圖示一致。 |
| 訂單完整內容 | ✅ 通過 | 頂部訂單卡可觸控展開與關閉，完整顯示目的、動作、成果、順序模式與全部步驟。 |
| `ordered`／`flexible` | ✅ 通過 | 固定工序拒絕非下一步；自由工序可先做任一未完成步驟；完成勾選依 step index，不因完成數量誤判。 |
| 五種接單決策 | ✅ 通過 | 接受、追問、限制、替代、拒絕在選擇前顯示實際影響，核心套用對應耐心、工序、品質、報酬與滿意度。 |
| 錯機台完全靜默 | ✅ 程式分支確認 | 玩家或 Agent 點錯後不改分數、滿意度、資源或工序，也不發出提示、音效、震動或正確站答案。 |
| 可見跟隨 Agent | ✅ 通過 | Agent 在場景中可見、抱獨立資料夾跟隨；玩家可交箱、選機台與下指令，完成後 Agent 抱回資料夾。 |
| 兩至三機台並行 | ✅ 通過 | Era 4 上限兩台、Era 5 上限三台；各機台進度與資料夾獨立，訂單卡顯示玩家／Agent／機台狀態。 |
| 後期首關試玩 | ✅ 程式確認 | Era 4／5 試玩複本注入對應 Agent 等級與並行上限，結算仍不寫正式存檔。 |
| 390×844 手機直向冒煙 | ✅ 通過 | 首頁與選角角色尺寸正常、無遮擋；Era 5 的機台、訂單詳情、五決策、Agent 跟隨／指派／抱回及多機狀態正常。 |
| iPhone 公開版真機 | ⚠️ 待使用者驗收 | 程式仍須推送並更新公開版後，由使用者確認真機觸控、字級、效能與網路載入。 |

本批已按最小驗證原則完成一次完整檢查；除非公開版或 iPhone 回報具體問題，不再重複跑相同驗證。
