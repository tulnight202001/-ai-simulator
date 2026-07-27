# 下一階段實際工作

**文件版本：0.2.0-alpha｜更新日期：2026-07-27｜程式基準 Commit：bb9d072**

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

> 從目前分支繼續，不要重建專案。先推送並讀取 GitHub Actions 的 npm install、test、check、build 結果，修正至全綠；再把 `src/data/v1Catalog.ts` 的 47 關、11 工作區、客戶決策、追加返工、升級與 Agent 全部接入 Phaser 即時場景。完成後實際跑桌機、手機尺寸、IndexedDB、PWA 離線測試，更新七份 Markdown、`/docs`、Google Drive exports 與安全 ZIP。不可因資料表存在就宣稱完整第一版完成。
