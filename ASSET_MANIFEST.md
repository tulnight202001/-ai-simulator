# AI Simulator v2／v3 美術資產清單

本文件固定正式遊戲使用的美術路徑與製作規格。程式端的唯一對照來源是 `src/data/artCatalog.ts`；不得在畫面或場景內另寫第二套檔名規則。AI 角色與背景沿用 v2，客戶與工作站由 v3 覆蓋 v2。

## 產製與保留原則

- 圖片使用 Codex 內建 ImageGen 逐項獨立生成，不把角色、客戶或工作站從同一張大圖裁切當成正式素材。
- AI 角色、客戶與工作站先以純色色鍵背景產出，再使用本機色鍵工具去背，正式 PNG 必須保留透明背景與完整輪廓。
- 場景背景為獨立 9:16 圖片，不含角色、客戶、工作站、HUD、文字或不可互動的假設備。
- v2 AI 角色與背景存放於 `public/art/generated/v2/`；v3 客戶與工作站存放於 `public/art/generated/v3/`，均由 `artCatalog.ts` 以相對路徑提供，確保 localhost、靜態部署子路徑與 PWA 都能共用。
- 客戶 v3 原始生成檔保存在 `review/art/history/2026-07-30_customer-v3-sources/`；工作站 v3 原始生成檔保存在 `review/art/history/2026-07-30_station-v3-sources/`。
- ImageGen 原始輸出與去背前的色鍵圖保留於 `review/history/generated-art-sources/v2/`，不覆寫、不刪除既有 v1 圖片。
- 舊版 `public/art/generated/*-v1.png` 保留為歷史對照，不再作為 v2 UI 與遊戲場景的正式來源。

## AI 角色（6）

| ID | 色彩與至少三項非文字辨識特徵 | 正式路徑 |
| --- | --- | --- |
| relay | 翡翠青綠、工具環、對話粒子、中央核心 | `public/art/generated/v2/ai-relay-v2.png` |
| atlas | 暖橙金、文件光帶、穩定厚重輪廓、沉穩面罩 | `public/art/generated/v2/ai-atlas-v2.png` |
| muse | 藍紫稜鏡、雙感測器、多色資料流、創作姿態 | `public/art/generated/v2/ai-muse-v2.png` |
| forge | 綠黃光體、模組工具窗、自動化方塊、工程姿態 | `public/art/generated/v2/ai-forge-v2.png` |
| nova | 電藍光體、高速殘影、俐落面罩、衝刺姿態 | `public/art/generated/v2/ai-nova-v2.png` |
| abyss | 深海藍青、聲納環、壓縮立方體、沉靜核心 | `public/art/generated/v2/ai-abyss-v2.png` |

所有 AI 正式遊戲圖採一致比例、相同視角與近似站姿；首頁、角色選擇、存檔、工作站與遊戲內玩家必須使用同一角色檔，不以幾何佔位圖替代。

## 客戶（6）

| ID | 角色方向 | 正式路徑 |
| --- | --- | --- |
| polite | 禮貌、資料多、整齊企劃感 | `public/art/generated/v3/customer-polite-v3.png` |
| urgent | 急躁、時間壓力、前傾動勢 | `public/art/generated/v3/customer-urgent-v3.png` |
| vague | 困惑、需求模糊、飄散提示 | `public/art/generated/v3/customer-vague-v3.png` |
| last-change | 抱著多版修改、臨時追加感 | `public/art/generated/v3/customer-last-change-v3.png` |
| perfectionist | 精密檢查、像素級審查、挑剔感 | `public/art/generated/v3/customer-perfectionist-v3.png` |
| all-tools | 同時要求多工具、圖示環繞、期待過高 | `public/art/generated/v3/customer-all-tools-v3.png` |

客戶採 2-B 方向、約 2.75 頭身的可愛簡化 2.5D 人類造型，統一略俯視角度、圓潤材質與青藍場景光；六類不可只換色或共用同一張圖。正式檔保留透明完整輪廓，輕微呼吸／浮動由 `WorkstationScene` 的 tween 呈現，不拉伸人物。v2 客戶保留為歷史素材，不再由正式 catalog 載入。

## 工作站（11）

正式檔名一律為 `public/art/generated/v3/station-{id}-v3.png`：

`counter`、`text`、`search`、`document`、`art`、`music`、`recording`、`studio`、`video`、`code`、`deploy`。

每座工作站是本次 Codex 內建 ImageGen 獨立生成並完成透明處理的 PNG，採一致的厚實深藍機身、2.5D 略俯視角度、外框比例與光源。圖內不含文字；功能差異以設備輪廓、正面核心大圖示、專屬操作元件與主色辨識，縮至手機約 96px 時仍須可辨。背景不得預先烘焙工作站，以便深度排序、碰撞、點擊與 47 關配置重用。v2 工作站保留為歷史素材，不再由正式 catalog 載入。

## 時代背景（5）

| Era | 場景方向 | 正式路徑 |
| --- | --- | --- |
| 1 | 新手 AI 工作室、清楚中央通道、少量設備槽 | `public/art/generated/v2/background-era-1-v2.png` |
| 2 | 多工具實驗室、資料管線與擴充槽 | `public/art/generated/v2/background-era-2-v2.png` |
| 3 | 多媒體製作室、聲音與影像燈光語彙 | `public/art/generated/v2/background-era-3-v2.png` |
| 4 | Agent 調度室、多流程節點與協作網路 | `public/art/generated/v2/background-era-4-v2.png` |
| 5 | 高負載平台、強烈能量核心與終局壓力 | `public/art/generated/v2/background-era-5-v2.png` |

每個時代的三種 `mapId` 由程式調整工作站排序、鏡像或位置，不需重複生成 15 張背景；因此能維持視覺差異，同時避免浪費生成與載入成本。

## 程式介面

- `getModelArtPath(id)`：AI 角色。
- `getCustomerArtPath(id)`：客戶。
- `getStationArtPath(id)`：工作站。
- `getEraBackgroundPath(era)`：時代背景。

未知的角色或客戶 ID 會直接報錯，不靜默換成錯誤角色，以免再次發生選擇圖、存檔圖與遊戲內角色不一致。
