# 下一階段實際工作

**文件版本：0.2.0-alpha｜更新日期：2026-07-27｜程式基準 Commit：bb9d072**

> 不再交付垂直切片供使用者測試。內部 Preview 僅供自動檢查；在 `GAME_SPEC.md` 完整第一版達標前，不要求使用者驗收半成品。

## 當前第一優先：重製正式視覺基礎

1. 重建全視口工作站與響應式鏡頭，消除空白、重疊與溢位。
2. 將 HUD、任務、狀態和互動控制移出主要走動區，分別設計桌面及 iPhone 排列。
3. 以一致的原創 SVG／Canvas 造型重畫角色、資料箱、櫃台及 11 種工作設備。
4. 建立桌面與常見 iPhone viewport 截圖／溢位檢查；結果只作內部開發證據。
5. 視覺基礎穩定後，把 47 關、客戶決策、追加返工、升級、Agent、總評及無限模式逐一接入，而不是再製作另一個展示切片。

## 第一優先：讓目前切片真正可驗證

### 尚未完成

1. 在能正常下載 npm 套件的環境執行安裝、單元測試、型別檢查與正式建置。
2. 修正建置或遊玩時發現的問題，再部署 HTTPS Preview。
3. 用桌機完整交付單步與雙步任務；確認 180 秒結算和本機存檔。
4. 用 iPhone 尺寸及真機檢查點擊尋路、互動按鈕、安全區、背景返回和效能。
5. 首次載入後斷網重啟，確認遊戲與存檔仍可開啟。

### 阻塞

- 目前環境存取 npm registry 時收到 HTTP 403，無法產生可公開測試的正式建置。
- 尚未有 GitHub Pages 網址。管理者需在 GitHub Repository 的 **Settings → Pages → Build and deployment → GitHub Actions** 啟用。
- 目前容器中的分支沒有 Git remote，無法由 Codex push 並觸發已建立的 CI；需在有 remote 的持續開發環境執行。

## 第二優先：核心系統第二階段

### 尚未完成

- 加入接受、追問、提醒限制、替代方案與拒絕的接單選擇。
- 加入不同性格客戶、追加要求、返工、抱怨與滿意度。
- 加入搜尋、文件、音樂、錄音、攝影、剪輯及部署等完整工作區。
- 建立版本化多存檔、模型／設備／硬體升級與備份預覽。

## 每個正式階段完成檢查表

- 更新七份人類可閱讀 Markdown 文件的版本、日期、狀態與程式基準 Commit。
- 執行 `python3 scripts/build_human_docs.py`，同步 `/docs` 與 `/exports/google-drive`。
- 本機可執行 `python3 scripts/create_release_zip.py` 檢查 ZIP；ZIP 已被忽略，不得 Commit。正式備份由 `release-archive.yml` 產生 workflow artifact。
- 檢查 ZIP 不含 `node_modules`、快取、建置暫存、Secrets、Token 或憑證。
- Commit 並推送 GitHub；確認 Pages 與測試網址，將結果寫回 `CURRENT_STATE.md`。

## 下一個 Codex 任務可直接接續的指令

> 從目前分支繼續，不要重建或退回舊視覺。先完成 `WorkstationScene` 的桌面／iPhone 響應式鏡頭、獨立 HUD、11 種設備與角色／資料箱正式 Canvas 美術，並以 GitHub Actions 真實依賴修正 install、test、check、build 至全綠。之後把 `src/data/v1Catalog.ts` 的 47 關、客戶決策、追加返工、升級、Agent、總評與無限模式全部接入 Phaser 即時場景。完整第一版門檻全數通過前，只稱內部 build，不要求使用者測試。每次接續都更新七份 Markdown、`/docs`、Google Drive exports 與 artifact ZIP 流程。
