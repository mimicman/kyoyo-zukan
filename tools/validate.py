"""カードのデータ（data/index.json・data/fields/*.json）と図・画像を検査する。問題があれば一覧を出して終了コード1を返す。

検査すること:
    - 文字数の上限（見出し15字・ひとこと30字・キーワード説明40字・キーワード3つまで・つながり2件まで）
    - 説明の項目（要点3つ各60字・例60字・なぜ大事50字・もっと詳しく150〜400字）があるか
    - 章（chapters）があり、各カードの chapter が正しく、各章の先頭にまとめカード（kind: summary）が1枚あるか
    - 年代 years が [開始, 終了] の形か（まとめカード以外）
    - 人物辞典（data/people/*.json）の必須項目・文字数・参照先・画像の出典・id と名前の重複
    - 図（figures/<分野>/<id>.svg）と画像（images/<id>.jpg）があるか、画像の出典が credits.json にあるか
    - つながり先のカードが存在するか、カードの id が重複していないか
    - 図に色の直接指定や id 属性がないか（ダークモード対応と、埋め込んだときの id 衝突を防ぐため）

使い方:
    python3 tools/validate.py                      # 全分野
    python3 tools/validate.py --fields math,music  # 指定した分野だけ
"""

import json
import re
import sys
from pathlib import Path

from kyoyo_data import ROOT, load

LIMITS = {"title": 15, "line": 30, "note": 40, "keywords": 3, "links": 4, "point": 60, "example": 60, "why": 50,
          "event": 30, "legacy": 60}
MORE_RANGE = (150, 400)
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


def check_people(data: dict, keys: list[str], credits: dict, only) -> list[str]:
    """人物辞典のデータを調べる（--fields 指定時は、その名前の人物ファイルだけ）"""
    errors = []
    for name in data["people_files"]:
        if not (ROOT / "data" / "people" / f"{name}.json").exists():
            errors.append(f"people: data/people/{name}.json がない（index.json の people に載っている）")
    ids = [p["id"] for p in data["people"]]
    for pid in {i for i in ids if ids.count(i) > 1}:
        errors.append(f"people/{pid}: id が重複している")
    owner = {}
    for p in data["people"]:
        for n in [p["name"], *p.get("aliases", [])]:
            if n in owner and owner[n] != p["id"]:
                errors.append(f"people/{p['id']}: 名前「{n}」が {owner[n]} と重複")
            owner[n] = p["id"]
    for p in data["people"]:
        if only and p["_file"] not in only:
            continue
        key = f"people/{p['id']}"
        for name in ("name", "line", "did", "events", "more", "cards", "region"):
            if not p.get(name):
                errors.append(f"{key}: {name} がない")
        if len(p.get("line", "")) > LIMITS["line"]:
            errors.append(f"{key}: line が{LIMITS['line']}字を超えている")
        if len(p.get("did", [])) != 3 or any(len(x) > LIMITS["point"] for x in p.get("did", [])):
            errors.append(f"{key}: did はちょうど3つ、各{LIMITS['point']}字以内")
        for ev in p.get("events", []):
            if not isinstance(ev.get("year"), int) or len(ev.get("text", "")) > LIMITS["event"]:
                errors.append(f"{key}: events は年（整数）と{LIMITS['event']}字以内の text")
        if len(p.get("legacy", "")) > LIMITS["legacy"]:
            errors.append(f"{key}: legacy が{LIMITS['legacy']}字を超えている")
        if not MORE_RANGE[0] <= len(p.get("more", "")) <= MORE_RANGE[1]:
            errors.append(f"{key}: more は{MORE_RANGE[0]}〜{MORE_RANGE[1]}字")
        for n in p.get("aliases", []):
            if len(n) < 2:
                errors.append(f"{key}: 別名「{n}」は2文字以上にする")
        for k in p.get("cards", []):
            if k not in keys:
                errors.append(f"{key}: 関連カード {k} がない")
        if p.get("figure"):
            svg = ROOT / "figures" / "people" / f"{p['figure']}.svg"
            if svg.exists():
                errors.extend(check_svg(svg))
            else:
                errors.append(f"{key}: 図 {svg.relative_to(ROOT)} がない")
        if p.get("image"):
            img = p["image"]["id"]
            if not (ROOT / "images" / f"{img}.jpg").exists() or img not in credits:
                errors.append(f"{key}: 画像 {img} のファイルか出典がない")
    return errors


def main() -> int:
    """全カードを検査して結果を表示する"""
    only = None
    if "--fields" in sys.argv:
        only = set(sys.argv[sys.argv.index("--fields") + 1].split(","))
    data = load()
    credits_path = ROOT / "images" / "credits.json"
    credits = json.loads(credits_path.read_text(encoding="utf-8")) if credits_path.exists() else {}
    keys = [f"{c['field']}/{c['id']}" for c in data["cards"]]
    errors: list[str] = []

    for key in {k for k in keys if keys.count(k) > 1}:
        errors.append(f"{key}: id が重複している")
    if data["hero"]["image"] not in credits:
        errors.append(f"hero: 画像 {data['hero']['image']} の出典がない")

    # 章とまとめカード
    for f in data["fields"]:
        if only and f["id"] not in only:
            continue
        chs = [ch["id"] for ch in f.get("chapters", [])]
        if not chs:
            errors.append(f"{f['id']}: 章 chapters がない")
            continue
        fcards = [c for c in data["cards"] if c["field"] == f["id"]]
        for ch in chs:
            in_ch = [c for c in fcards if c.get("chapter") == ch]
            sums = [c for c in in_ch if c.get("kind") == "summary"]
            if len(sums) != 1:
                errors.append(f"{f['id']}: 章 {ch} のまとめカードが{len(sums)}枚（1枚にする）")
            elif in_ch[0] is not sums[0]:
                errors.append(f"{f['id']}: 章 {ch} のまとめカードを章の先頭に置く")
        for c in fcards:
            if c.get("chapter") not in chs:
                errors.append(f"{f['id']}/{c['id']}: chapter {c.get('chapter')} が章の一覧にない")

    for c in data["cards"]:
        key = f"{c['field']}/{c['id']}"
        if only and c["field"] not in only:
            continue
        ys = c.get("years")
        if ys is not None and not (isinstance(ys, list) and len(ys) == 2 and isinstance(ys[0], int)
                                   and (ys[1] is None or (isinstance(ys[1], int) and ys[0] <= ys[1]))):
            errors.append(f"{key}: years は [開始年, 終了年]（整数、紀元前は負）")
        points = c.get("points", [])
        if len(points) != 3:
            errors.append(f"{key}: 要点 points は3つ")
        for i, pt in enumerate(points, 1):
            if len(pt) > LIMITS["point"]:
                errors.append(f"{key}: 要点{i}が{LIMITS['point']}字を超えている（{len(pt)}字）")
        for name in ("example", "why"):
            if not c.get(name):
                errors.append(f"{key}: {name} がない")
            elif len(c[name]) > LIMITS[name]:
                errors.append(f"{key}: {name} が{LIMITS[name]}字を超えている（{len(c[name])}字）")
        more = c.get("more", "")
        if not MORE_RANGE[0] <= len(more) <= MORE_RANGE[1]:
            errors.append(f"{key}: more は{MORE_RANGE[0]}〜{MORE_RANGE[1]}字（{len(more)}字）")
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

    errors.extend(check_people(data, keys, credits, only))

    for e in errors:
        print("NG", e)
    checked = sum(1 for c in data["cards"] if not only or c["field"] in only)
    print(f"検査完了: カード {checked} 枚 / 問題 {len(errors)} 件")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
