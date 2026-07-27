# Current state — 2026-07-27

**目前版本：0.2.0-alpha｜更新日期：2026-07-27｜程式基準 Commit：bb9d072**

**整體第一版估計完成度：約 22%｜目前階段：核心資料與生涯架構部分完成｜不是完整第一版**

## 重要交付狀態

**目前公開畫面：視覺與響應式不合格，需重製。** 已知問題包含上方無用途空白、畫布／鏡頭縮放錯誤、HUD 與場景物件重疊、設備仍是幾何占位、角色過小，以及桌面與手機缺少各自適合的資訊配置。現有部署只能視為內部自動建置，不是使用者測試版，也不再要求使用者逐階段驗收。

下一個正式測試網址只會在完整第一版的 47 關、11 工作區、客戶流程、成長、Agent、總評、無限、多存檔／備份與完整離線均已接入，且 install、test、check、build、桌機、常見 iPhone 與 PWA 驗收實際通過後提供。

### 視覺重製進度（部分完成、尚未驗證）

- 遊戲容器已改為使用完整可見區域，啟動標示改為「內部開發建置」，不再稱為使用者測試版。
- 櫃台、文字台、光繪板與程式電腦已改用各自不同的 Canvas 設備造型；AI 角色放大並增加頭部、臉部、身體、腳部與模型色辨識。
- 仍需完成真正的桌面／iPhone 場景重新排版、HUD 分離、11 工作區全套造型，以及實際瀏覽器截圖與不重疊驗證；目前不得視為視覺合格。

## 文件與備份（已完成）

- GitHub 維持程式碼、規格及版本歷史的主要備份來源。
- `/docs/index.html` 是適合手機閱讀的專案狀態入口；可由 GitHub Pages 免費發布。
- `/exports/google-drive` 保存由同一批 Markdown 自動產生的離線 HTML，可由使用者手動上傳 Google Drive，不需登入或保存 OAuth Token。
- 階段 ZIP 不再提交到 Git。`.github/workflows/release-archive.yml` 會產生 `ai-simulator-v0.2.0-alpha-20260727.zip` 並保存為 GitHub Actions artifact；內容不含依賴、快取、建置暫存或憑證。

## 本階段新增（部分完成）

- 建立五紀元共 47 關的資料表、11 種正式工作區、12 種單步至完整歌曲與 MV 配方、6 種客戶及升級資料；尚未全部接入即時 Phaser 場景。
- 建立多模型 IndexedDB 生涯 schema version 2、舊版 migration、星級最佳成績、有限重玩獎勵、長期數值、升級、Agent／無限／總評資料結構。
- 主選單可讀取多個生涯，模型三選一包含約 10% 稀有模型機率，結算會寫入長期生涯；JSON 可下載，匯入預覽核心已有但 UI 尚未接上。
- GitHub PR #1 的「遊戲建置與測試」已實際執行：`npm install` 與 `npm test` 通過，原本在 `npm run check` 因 CSS side-effect import 缺少 Vite client 型別而停止。本次已恢復 `vite/client` 型別；等待同一 PR 的 Actions 重新執行確認 check 與 build。

## 已完成（第一個可見垂直切片）

- 建立 Vite／TypeScript／Phaser 3 的可擴充 PWA 架構與五階段 `IMPLEMENTATION_PLAN.md`。
- 主選單、三個有取捨的原創模型三選一及固定外觀。
- 固定斜上方小型工作站；櫃台、文字台、光繪板、程式電腦；鍵盤移動、點設備尋路與大型觸控互動按鈕。
- 種子化單步／雙步任務、實體資料箱流程、短時間不可中斷加工、180 秒倒數、交付、分數與一至三星結算。
- CPU／GPU／RAM／Context／伺服器 HUD；設備消耗、閒置恢復及伺服器過載減速。
- 完成關卡後 IndexedDB 自動存檔；PWA manifest、service worker app-shell/runtime cache。
- 純規則與資料參照測試原始碼，以及架構、schema、控制、離線文件。

## 可測試方式

理想環境執行 `npm install && npm run dev`，瀏覽 Vite URL；選模型後到櫃台領箱，依 HUD 先後前往設備，最後回櫃台。可把時間暫改或完整等待 180 秒查看結算與 IndexedDB `ai-simulator`。

Codex 容器對 npm registry 仍回應 HTTP 403，因此無法在容器重跑真實套件；GitHub Actions 已證明安裝與測試可執行。本次只修正 CI TypeScript 型別設定，不新增或刪除遊戲功能。

### 測試網址與文件網址

- 遊戲 Preview：**阻塞，尚未產生公開網址**。
- 文件首頁：目前可直接開啟 `/docs/index.html`；GitHub Pages 公開網址 **尚未啟用**。
- 啟用方式：Repository 管理者進入 **Settings → Pages → Build and deployment → GitHub Actions**；推送後由 `.github/workflows/docs-pages.yml` 發布 `/docs`。公開後應把實際網址補回本節。

## 尚未完成（不可視為第一版完成）

- 接單分支（追問／拒絕／替代）、程序化客戶、追加／返工／抱怨，以及完整工作區與大型專案。
- 約 47 個正式關卡、五紀元、全部模組地圖、正式平衡與完整教學。
- 模型／設備／硬體升級、Agent、長期數值、多存檔 UI、獎勵上限。
- 生涯總評、基礎無限模式、JSON 備份／migration UI、選配 Google 備份。
- 正式美術／聲音與授權清冊、暫停／設定／減少動畫、iPhone 真機與離線重啟驗收。

## 下一階段

先在有 remote 的 GitHub 分支執行新建 CI，取得實際 install／test／check／build 結果並修正。接著把 47 關資料、全部工作區、客戶決策、追加返工、升級與 Agent 接入即時 Phaser 場景；目前僅資料存在不算功能完成。
