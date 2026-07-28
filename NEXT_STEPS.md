# NEXT STEPS

更新：2026-07-28。完整第一版尚未達 `GAME_SPEC.md` 驗收標準。

## 下一個任務可直接續作

1. 在 `src/core/v1Runtime.ts` 與 `WorkstationScene` 完成**真正可切換的多資料箱攜帶／暫存架**：依 `caseSlots` 顯示槽位、允許選箱、每箱各自保存階段與客戶綁定，加入測試。
2. 將客戶流程深化為資料驅動狀態機：矛盾需求、逾時抱怨、品質不足返工、追加後再次交付；把投訴原因與滿意度明細寫入 `Career`，不可只顯示訊息。
3. 為 Agent 加入 catalog 數值（速度、品質、錯誤率、RAM/server 負載），限定單步簡單任務並讓錯誤產生可返工成果；完成指定工作區、冷卻、休息與負載 UI。
4. 以平衡模擬驗證 47 關星級門檻、獎勵與每紀元解鎖，確保三分鐘內各種配方實際可完成，禁止以延長等待替代複雜度。
5. 完成教學、暫停、設定／聲音、能力詳情、生涯總評與無限模式；所有工作完成後再依 `GAME_SPEC.md` 做第一版驗收，未達標不得宣稱完成。

每次工作必須執行 `npm test`、`npm run check`、`npm run build`、`python3 scripts/build_human_docs.py`，同步 `/docs` 與 `/exports/google-drive`，並更新交接文件。
