"""ホーム・分野一覧・全カードをスマホ幅とPC幅、ライトとダークで開き、表示崩れを確認する。

確認すること:
    - 横スクロールが出ない（ページ全体の scrollWidth が画面幅を超えない）
    - カードの図が読み込まれている
    - コンソールエラーが出ない
スクリーンショットは出力先に保存するので、図の文字の重なりは目で確認する。

ページは fetch でデータを読むため、確認中だけ簡易サーバーを立てる。

使い方（Playwright が入った Python で実行）:
    python tools/check_layout.py [分野/カード ...] [--out 出力先]
カードを省略すると全カードを確認する（例: python tools/check_layout.py economics/compound）。
"""

import argparse
import functools
import http.server
import json
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
VIEWPORTS = {"mobile": (375, 812), "desktop": (1200, 900)}
SCHEMES = ("light", "dark")


def serve() -> tuple[http.server.ThreadingHTTPServer, str]:
    """リポジトリ直下を配信する簡易サーバーを空いているポートで立てる"""
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args) -> None:
            """アクセスログは出さない"""

    handler = functools.partial(QuietHandler, directory=str(ROOT))
    class QuietServer(http.server.ThreadingHTTPServer):
        def handle_error(self, request, client_address) -> None:
            """再読み込みで切れた接続のエラーは無視する"""

    server = QuietServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/"


def routes(cards: list[str]) -> list[str]:
    """確認する画面の一覧（# 以降）"""
    data = json.loads((ROOT / "data" / "cards.json").read_text(encoding="utf-8"))
    if cards:
        return cards
    return ["", *[f["id"] for f in data["fields"]], *[f"{c['field']}/{c['id']}" for c in data["cards"]]]


def main() -> int:
    """各画面×画面幅×配色で表示し、問題があれば一覧を出して終了コード1を返す"""
    parser = argparse.ArgumentParser()
    parser.add_argument("cards", nargs="*")
    parser.add_argument("--out", default=str(ROOT / "tmp" / "screenshots"))
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    server, base = serve()

    problems: list[str] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for vp_name, (w, h) in VIEWPORTS.items():
            for scheme in SCHEMES:
                ctx = browser.new_context(viewport={"width": w, "height": h}, color_scheme=scheme)
                page = ctx.new_page()
                errors: list[str] = []
                page.on("console", lambda m, e=errors: e.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda ex, e=errors: e.append(str(ex)))
                for r in routes(args.cards):
                    label = f"#/{r} {vp_name} {scheme}"
                    errors.clear()
                    page.goto(f"{base}#/{r}")
                    page.reload()  # 画面を毎回まっさらな状態から描く
                    page.wait_for_load_state("networkidle")
                    if r.count("/") == 1:
                        slide = page.locator(f'.slide[data-key="{r}"]')
                        if slide.locator(".fig svg").count() == 0:
                            problems.append(f"{label}: 図が読み込まれていない")
                    scroll_w = page.evaluate("document.documentElement.scrollWidth")
                    if scroll_w > w:
                        problems.append(f"{label}: 横スクロールあり（scrollWidth={scroll_w}）")
                    problems.extend(f"{label}: コンソールエラー {e}" for e in errors)
                    name = (r or "home").replace("/", "_")
                    page.screenshot(path=out / f"{name}_{vp_name}_{scheme}.png", full_page=r.count("/") == 0)
                ctx.close()
        browser.close()
    server.shutdown()

    for p in problems:
        print("NG", p)
    print(f"確認完了: 問題 {len(problems)} 件 / スクリーンショット: {out}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
