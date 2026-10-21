"""カードのデータ（data/index.json・data/fields/*.json）と図・画像を検査する。問題があれば一覧を出して終了コード1を返す。

検査すること:
    - 文字数の上限（見出し15字・ひとこと30字・キーワード説明40字・キーワード3つまで・つながり2件まで）
    - 図（figures/<分野>/<id>.svg）と画像（images/<id>.jpg）があるか、画像の出典が credits.json にあるか
    - つながり先のカードが存在するか、カードの id が重複していないか
    - 図に色の直接指定や id 属性がないか（ダークモード対応と、埋め込んだときの id 衝突を防ぐため）

使い方:
    python3 tools/validate.py
"""

import json
import re
import sys
from pathlib import Path

from kyoyo_data import ROOT, load

LIMITS = {"title": 15, "line": 30, "note": 40, "keywords": 3, "links": 2}
COLOR_ATTR = re.compile(r'\b(fill|stroke|stop-color)="(#|rgb|hsl)|style="[^"]*(fill|stroke|color)\s*:', re.I)


def check_svg(path: Path) -> list[str]:
    """図のSVGが決まりに沿っているか調べる"""
    svg = path.read_text(encoding="utf-8")
    errors = []
    if 'viewBox="0 0 360 ' not in svg:
        errors.append(f"{path.relative_to(ROOT)}: viewBox の幅は360にする")
    if COLOR_ATTR.search(svg):
        errors.append(f"{path.relative_to(ROOT)}: 色を直接書かず、クラス（.ink .fl など）を使う")
    if re.search(r'\sid="', svg):
        errors.append(f"{path.relative_to(ROOT)}: id 属性は使わない（ページ内で衝突する）")
    return errors


def main() -> int:
    """全カードを検査して結果を表示する"""
    data = load()
    credits_path = ROOT / "images" / "credits.json"
    credits = json.loads(credits_path.read_text(encoding="utf-8")) if credits_path.exists() else {}
    keys = [f"{c['field']}/{c['id']}" for c in data["cards"]]
    errors: list[str] = []

    for key in {k for k in keys if keys.count(k) > 1}:
        errors.append(f"{key}: id が重複している")
    if data["hero"]["image"] not in credits:
        errors.append(f"hero: 画像 {data['hero']['image']} の出典がない")

    for c in data["cards"]:
        key = f"{c['field']}/{c['id']}"
        for name in ("title", "line"):
            if len(c[name]) > LIMITS[name]:
                errors.append(f"{key}: {name} が{LIMITS[name]}字を超えている（{len(c[name])}字）")
        if not 1 <= len(c["keywords"]) <= LIMITS["keywords"]:
            errors.append(f"{key}: キーワードは1〜{LIMITS['keywords']}個")
        for k in c["keywords"]:
            if len(k["note"]) > LIMITS["note"]:
                errors.append(f"{key}: 「{k['word']}」の説明が{LIMITS['note']}字を超えている（{len(k['note'])}字）")
        links = c.get("links", [])
        if len(links) > LIMITS["links"]:
            errors.append(f"{key}: つながりは{LIMITS['links']}件まで")
        for link in links:
            if link not in keys:
                errors.append(f"{key}: つながり先 {link} がない")
        svg = ROOT / "figures" / c["field"] / f"{c['id']}.svg"
        if svg.exists():
            errors.extend(check_svg(svg))
        else:
            errors.append(f"{key}: 図 {svg.relative_to(ROOT)} がない")
        if "image" in c:
            img = c["image"]["id"]
            if not (ROOT / "images" / f"{img}.jpg").exists():
                errors.append(f"{key}: 画像 images/{img}.jpg がない")
            if img not in credits:
                errors.append(f"{key}: 画像 {img} の出典が credits.json にない")

    for e in errors:
        print("NG", e)
    print(f"検査完了: カード {len(keys)} 枚 / 問題 {len(errors)} 件")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
