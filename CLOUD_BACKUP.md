# 雲端備份

核心遊戲不登入也能完整遊玩。Repository 的 `/exports/google-drive` 是專案文件交接，不是玩家存檔。玩家 Google Drive 備份仍是選配功能；實作時只能在使用者主動授權後執行，Token 不得進入 Repository。OAuth 審查未完成時以 JSON 手動匯出／匯入作為完整替代。
