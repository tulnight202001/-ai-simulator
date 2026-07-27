# Current state — 2026-07-27

**目前版本：0.2.0-alpha｜更新日期：2026-07-27｜程式基準 Commit：60037d5**

**整體第一版估計完成度：約 22%｜目前階段：核心資料與生涯架構部分完成｜不是完整第一版**

## 文件與備份（已完成）

- GitHub 維持程式碼、規格及版本歷史的主要備份來源。
- `/docs/index.html` 是適合手機閱讀的專案狀態入口；可由 GitHub Pages 免費發布。
- `/exports/google-drive` 保存由同一批 Markdown 自動產生的離線 HTML，可由使用者手動上傳 Google Drive，不需登入或保存 OAuth Token。
- 階段 ZIP 不再提交到 Git。`.github/workflows/release-archive.yml` 會產生 `ai-simulator-v0.2.0-alpha-20260727.zip` 並保存為 GitHub Actions artifact；內容不含依賴、快取、建置暫存或憑證。

## 本階段新增（部分完成）

- 建立五紀元共 47 關的資料表、11 種正式工作區、12 種單步至完整歌曲與 MV 配方、6 種客戶及升級資料；尚未全部接入即時 Phaser 場景。
- 建立多模型 IndexedDB 生涯 schema version 2、舊版 migration、星級最佳成績、有限重玩獎勵、長期數值、升級、Agent／無限／總評資料結構。
- 主選單可讀取多個生涯，模型三選一包含約 10% 稀有模型機率，結算會寫入長期生涯；JSON 可下載，匯入預覽核心已有但 UI 尚未接上。
- PR #1 的 GitHub Actions 已在官方依賴環境完整通過：`npm install`、`npm test`、`npm run check`、`npm run build` 均成功，並產生 production build artifact。
- TypeScript 失敗原因已確認為 Phaser 第三方宣告檔引用舊式 `ActiveXObject` 全域型別；以標準 `skipLibCheck` 忽略第三方宣告檔相容性問題，同時保留專案原始碼的 strict 型別檢查。

## 已完成（第一個可見垂直切片）

- 建立 Vite／TypeScript／Phaser 3 的可擴充 PWA 架構與五階段 `IMPLEMENTATION_PLAN.md`。
- 主選單、三個有取捨的原創模型三選一及固定外觀。
- 固定斜上方小型工作站；櫃台、文字台、光繪板、程式電腦；鍵盤移動、點設備尋路與大型觸控互動按鈕。
- 種子化單步／雙步任務、實體資料箱流程、短時間不可中斷加工、180 秒倒數、交付、分數與一至三星結算。
- CPU／GPU／RAM／Context／伺服器 HUD；設備消耗、閒置恢復及伺服器過載減速。
- 完成關卡後 IndexedDB 自動存檔；PWA manifest、service worker app-shell/runtime cache。
- 純規則與資料參照測試原始碼，以及架構、schema、控制、離線文件。

## 可測試方式

在可使用 npm 的環境執行 `npm install && npm run dev`，瀏覽 Vite URL；選模型後到櫃台領箱，依 HUD 先後前往設備，最後回櫃台。可把時間暫改或完整等待 180 秒查看結算與 IndexedDB `ai-simulator`。

GitHub Actions 已證明依賴安裝、自動測試、TypeScript 檢查及 production build 均可成功執行。Codex 容器本身仍會對 npm registry 回應 HTTP 403，但不再阻塞 Repository 的正式 CI 驗證。

### 測試網址與文件網址

- 遊戲 Preview：**尚未產生公開網址**；production build artifact 已成功建立。
- 文件首頁：目前可直接開啟 `/docs/index.html`；GitHub Pages 公開網址 **尚未啟用**。
- 啟用方式：Repository 管理者進入 **Settings → Pages → Build and deployment → GitHub Actions**；推送後由 `.github/workflows/docs-pages.yml` 發布遊戲與 `/docs`。公開後應把實際網址補回本節。

## 尚未完成（不可視為第一版完成）

- 接單分支（追問／拒絕／替代）、程序化客戶、追加／返工／抱怨，以及完整工作區與大型專案。
- 約 47 個正式關卡、五紀元、全部模組地圖、正式平衡與完整教學。
- 模型／設備／硬體升級、Agent、長期數值、多存檔 UI、獎勵上限。
- 生涯總評、基礎無限模式、JSON 備份／migration UI、選配 Google 備份。
- 正式美術／聲音與授權清冊、暫停／設定／減少動畫、iPhone 真機與離線重啟驗收。

## 下一階段

PR #1 的安裝、測試、TypeScript 檢查與 production build 已通過。下一步先合併 PR 並啟用 GitHub Pages，取得可用手機開啟的 HTTPS 測試網址；之後再把 47 關資料、全部工作區、客戶決策、追加返工、升級與 Agent 接入即時 Phaser 場景。目前僅資料存在不算功能完成。

## 響應式工作站視覺重製

- 工作站畫面已加入安全區感知的全螢幕外框，桌機顯示鍵盤提示，窄版直向手機顯示旋轉建議；Phaser 的固定邏輯座標與 `FIT` 縮放確保玩法座標不因版面尺寸改變。
- 2.5D 場景已重製為分層青藍工作站：地板邊界、透視網格、設備發光層、玩家陰影與高對比 HUD 更容易辨識，原有資料箱、工作區、計時與資源規則均保留。
- 本次只重製既有垂直切片的視覺與響應式呈現，沒有宣稱五紀元第一版內容完成。
