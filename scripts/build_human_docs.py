#!/usr/bin/env python3
"""從 Repository Markdown 產生可離線閱讀的 HTML；Markdown 是唯一內容來源。"""
from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.2.0-alpha"
UPDATED = "2026-07-27"
COMMIT = "bb9d072"

DOCUMENTS = [
    ("GAME_SPEC.md", "完整遊戲規格"),
    ("IMPLEMENTATION_PLAN.md", "完整實作計畫"),
    ("CURRENT_STATE.md", "目前狀態"),
    ("TEST_REPORT.md", "測試報告"),
    ("HANDOFF.md", "接手說明"),
    ("CHANGELOG.md", "重要變更紀錄"),
    ("NEXT_STEPS.md", "下一階段工作"),
]
GOOGLE_EXPORTS = {
    "PROJECT_OVERVIEW.html": "README.md",
    "CURRENT_STATE.html": "CURRENT_STATE.md",
    "IMPLEMENTATION_PLAN.html": "IMPLEMENTATION_PLAN.md",
    "TEST_REPORT.html": "TEST_REPORT.md",
    "HANDOFF.html": "HANDOFF.md",
}

STYLE = """
:root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;color:#17213c;background:#f3f6fb;line-height:1.7}*{box-sizing:border-box}body{margin:0}header{background:linear-gradient(135deg,#101b38,#245b88);color:white;padding:28px max(20px,calc((100% - 920px)/2))}header a{color:#bdefff}main{max-width:920px;margin:auto;background:white;padding:28px clamp(18px,5vw,54px);min-height:100vh}h1,h2,h3{line-height:1.25;color:#12234b}h1{font-size:clamp(2rem,7vw,3rem)}h2{margin-top:2em;border-bottom:2px solid #dce6f5;padding-bottom:.3em}a{color:#1769aa}code{background:#edf2f8;padding:.15em .35em;border-radius:5px;overflow-wrap:anywhere}pre{background:#10182d;color:#edf6ff;padding:16px;border-radius:12px;overflow:auto}pre code{background:none;padding:0}blockquote{border-left:4px solid #54b8d1;margin-left:0;padding-left:18px;color:#485673}table{border-collapse:collapse;width:100%;display:block;overflow:auto}th,td{border:1px solid #ccd7e7;padding:8px;text-align:left}.meta,.notice{border-radius:12px;padding:13px 16px}.meta{background:#eaf3ff}.notice{background:#fff3cf;border-left:5px solid #e4ae2d}nav{display:flex;gap:8px;flex-wrap:wrap}nav a{background:#ffffff18;border:1px solid #ffffff38;border-radius:999px;padding:5px 11px;text-decoration:none}@media(max-width:600px){header{padding:22px 18px}main{padding:22px 18px}}
"""

def inline(value: str) -> str:
    value = html.escape(value)
    value = re.sub(r"`([^`]+)`", r"<code>\1</code>", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", value)
    value = re.sub(r"\[([^]]+)]\(([^)]+)\)", r'<a href="\2">\1</a>', value)
    return value

def markdown(source: str) -> str:
    output: list[str] = []
    in_code = False
    in_list = False
    for raw in source.splitlines():
        line = raw.rstrip()
        if line.startswith("```"):
            if in_list: output.append("</ul>"); in_list = False
            output.append("</code></pre>" if in_code else "<pre><code>")
            in_code = not in_code
        elif in_code:
            output.append(html.escape(line) + "\n")
        elif match := re.match(r"^(#{1,4})\s+(.+)$", line):
            if in_list: output.append("</ul>"); in_list = False
            level = len(match.group(1)); output.append(f"<h{level}>{inline(match.group(2))}</h{level}>")
        elif re.match(r"^[-*]\s+", line):
            if not in_list: output.append("<ul>"); in_list = True
            output.append(f"<li>{inline(re.sub(r'^[-*]\s+', '', line))}</li>")
        elif re.match(r"^\d+\.\s+", line):
            if not in_list: output.append("<ul>"); in_list = True
            output.append(f"<li>{inline(re.sub(r'^\d+\.\s+', '', line))}</li>")
        elif not line:
            if in_list: output.append("</ul>"); in_list = False
        elif line.startswith("> "):
            output.append(f"<blockquote>{inline(line[2:])}</blockquote>")
        else:
            if in_list: output.append("</ul>"); in_list = False
            output.append(f"<p>{inline(line)}</p>")
    if in_list: output.append("</ul>")
    return "\n".join(output)

def page(title: str, source_name: str, body: str, relative_root: str = "../", navigation: bool = True) -> str:
    nav = "".join(f'<a href="{relative_root}docs/{name.removesuffix(".md")}.html">{label}</a>' for name,label in DOCUMENTS) if navigation else "<span>此檔案可直接離線開啟</span>"
    return f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}｜AI Simulator</title><style>{STYLE}</style></head><body><header><b>關於我重生為 AI 模型的⋯</b><p>人類可閱讀專案文件</p><nav>{nav}</nav></header><main><div class="meta">版本 {VERSION}｜更新 {UPDATED}｜程式基準 Commit {COMMIT}<br>內容來源：<code>{source_name}</code></div>{body}<hr><p>此 HTML 由 <code>scripts/build_human_docs.py</code> 從 Repository Markdown 自動產生，請勿單獨修改。</p></main></body></html>'''

def main() -> None:
    docs = ROOT / "docs"; exports = ROOT / "exports/google-drive"
    docs.mkdir(parents=True, exist_ok=True); exports.mkdir(parents=True, exist_ok=True)
    for name, title in DOCUMENTS:
        source = (ROOT / name).read_text(encoding="utf-8")
        (docs / name.replace(".md", ".html")).write_text(page(title, name, markdown(source)), encoding="utf-8")
    links = "".join(f'<li><a href="{name.removesuffix(".md")}.html">{label}</a>—資料來源 <code>{name}</code></li>' for name,label in DOCUMENTS)
    home = f'''<h1>AI Simulator 專案狀態</h1><p class="notice"><strong>目前是可玩垂直切片，不是完整第一版。</strong>完整第一版仍需五紀元、約 47 關、養成、Agent、生涯總評與無限模式。</p><h2>目前版本與完成度</h2><p><strong>{VERSION}</strong>｜更新日期 {UPDATED}｜程式基準 Commit {COMMIT}</p><p>整體第一版估計完成度：<strong>約 22%</strong>。此數字代表系統與內容里程碑的保守估算，不代表已通過發布驗收。</p><h2>目前可測試</h2><p>可檢查主選單、三個模型選擇、180 秒斜上方工作站、鍵盤／觸控移動、櫃台接箱、單步與雙步加工、五項負載、星級結算及本機存檔。</p><h2>已知問題與阻塞</h2><p>目前執行環境無法從 npm registry 下載 Phaser、Vite 與測試工具，因此尚無 production build、公開測試網址、iPhone 實機或完整離線重啟證據。</p><h2>下一步</h2><p>先讓 GitHub Actions 完成建置驗證，再把 47 關資料、完整工作區、客戶、升級與 Agent 接入即時場景。</p><h2>文件入口</h2><ul>{links}</ul><h2>雲端備份方式</h2><p>GitHub 是程式碼與版本的主要備份。此 <code>/docs</code> 目錄可由 GitHub Pages 免費發布；<code>/exports/google-drive</code> 內檔案可由使用者手動上傳 Google Drive，不需要也不得提交 Token。</p>'''
    (docs / "index.html").write_text(page("專案狀態首頁", "CURRENT_STATE.md、NEXT_STEPS.md 與其他狀態文件", home, navigation=True), encoding="utf-8")
    for output, source_name in GOOGLE_EXPORTS.items():
        source = (ROOT / source_name).read_text(encoding="utf-8")
        # Google Drive exports embed all CSS and omit cross-file dependencies.
        (exports / output).write_text(page(output.removesuffix('.html').replace('_',' '), source_name, markdown(source), navigation=False), encoding="utf-8")

if __name__ == "__main__": main()
