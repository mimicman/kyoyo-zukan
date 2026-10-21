"""全ページをスマホ幅とPC幅、ライトとダークで開き、レイアウト崩れを確認する。

確認すること:
    - 幅375pxで横スクロールが出ない（scrollWidth が画面幅を超えない）
    - コンソールエラーが出ない
スクリーンショットは出力先に保存するので、図の文字の重なりは目で確認する。

使い方（Playwright が入った Python で実行）:
    python tools/check_layout.py [ページ名.html ...] [--out 出力先]
ページ名を省略すると全ページを確認する。
"""

import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
VIEWPORTS = {"mobile": (375, 812), "desktop": (1200, 900)}
SCHEMES = ("light", "dark")


def pages(names: list[str]) -> list[Path]:
    """確認するページ（指定がなければ _ で始まる雛形以外の全ページ）"""
    if names:
        return [ROOT / n for n in names]
    return sorted(p for p in ROOT.glob("*.html") if not p.name.startswith("_"))


def main() -> int:
    """各ページ×画面幅×配色で表示し、問題があれば一覧を出して終了コード1を返す"""
    parser = argparse.ArgumentParser()
    parser.add_argument("pages", nargs="*")
    parser.add_argument("--out", default=str(ROOT / "tmp" / "screenshots"))
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    problems: list[str] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for page_path in pages(args.pages):
            for vp_name, (w, h) in VIEWPORTS.items():
                for scheme in SCHEMES:
                    ctx = browser.new_context(viewport={"width": w, "height": h}, color_scheme=scheme)
                    page = ctx.new_page()
                    errors: list[str] = []
                    page.on("console", lambda m, e=errors: e.append(m.text) if m.type == "error" else None)
                    page.goto(page_path.as_uri())
                    label = f"{page_path.name} {vp_name} {scheme}"
                    scroll_w = page.evaluate("document.documentElement.scrollWidth")
                    if scroll_w > w:
                        problems.append(f"{label}: 横スクロールあり（scrollWidth={scroll_w}）")
                    for e in errors:
                        problems.append(f"{label}: コンソールエラー {e}")
                    page.screenshot(path=out / f"{page_path.stem}_{vp_name}_{scheme}.png", full_page=True)
                    ctx.close()
        browser.close()

    for p in problems:
        print("NG", p)
    print(f"確認完了: 問題 {len(problems)} 件 / スクリーンショット: {out}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
