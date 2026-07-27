# 存檔格式

目前 schema version 為 2，保存多個生涯的模型、seed／亂數狀態、紀元、關卡最佳成績、獎勵領取、長期數值、升級、Agent、無限模式與生涯總評。`src/services/save.ts` 可讀取 version 1 垂直切片存檔並遷移。JSON 匯出包含格式識別與匯出時間；匯入必須先預覽，不可靜默覆蓋較新進度。
