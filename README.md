# AI Simulator / 關於我重生為 AI 模型的⋯

手機優先的即時 AI 工作站管理 PWA。目前只有第一個**可玩垂直切片**，並非 `GAME_SPEC.md` 所定義的完整第一版。

## 人類可閱讀文件

- 直接開啟 [`docs/index.html`](docs/index.html) 查看手機友善的版本、完成度、目前可測試內容、已知問題與下一步。
- GitHub Pages 可用 `.github/workflows/docs-pages.yml` 免費發布 `/docs`；管理者需先在 Repository 的 Pages 設定選擇 GitHub Actions。
- `exports/google-drive` 內是可單獨開啟並手動上傳 Google Drive 的最新 HTML；Repository 不保存 OAuth Token。
- Markdown 是唯一內容來源。修改主要文件後執行 `python3 scripts/build_human_docs.py` 同步 HTML。
- 正式階段完成後執行 `python3 scripts/create_release_zip.py` 產生不含依賴、快取或敏感資料的完整交接 ZIP。

```bash
npm install
npm run dev
```

開啟顯示網址、選擇三個模型之一，到櫃台領取資料箱，依指示完成加工並送回櫃台。正式驗證使用 `npm test && npm run build`，並以 HTTPS 提供 `dist/` 才能測試安裝與離線。

完整約 47 關、養成、Agent、生涯總評與無限模式的五階段路線請見 `IMPLEMENTATION_PLAN.md`。
