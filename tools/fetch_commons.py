"""Wikimedia Commons からパブリックドメインの画像を取得し、出典を記録する。

Commons 側で長辺1000px程度に縮小された版を取得し、images/<id>.jpg に保存する。
出典（作品名・作者・ライセンス・元ページ）は images/credits.json に追記し、
一覧表 images/CREDITS.md を作り直す。パブリックドメイン以外のライセンスは保存しない。

使い方:
    python3 tools/fetch_commons.py --check "File:ファイル名.jpg"         # ライセンス確認だけ
    python3 tools/fetch_commons.py <id> "File:ファイル名.jpg" "表示名"  # 取得して記録
"""

import fcntl
import html
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
CREDITS_JSON = IMAGES / "credits.json"
API = "https://commons.wikimedia.org/w/api.php"
UA = "kyoyo-zukan/1.0 (personal study page; https://github.com/mimicman/kyoyo-zukan)"
PD_LICENSES = ("public domain", "pd", "cc0")


def get(url: str) -> bytes:
    """User-Agent を付けて取得する。混雑時（429）は少し待って再試行する"""
    for wait in (0, 5, 15, 30):
        time.sleep(wait)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return res.read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
    raise RuntimeError(f"取得できませんでした（混雑）: {url}")


def plain(value: str) -> str:
    """Commons のメタデータに含まれる HTML タグを外して1行の文字列にする"""
    text = re.sub(r"<[^>]+>", "", html.unescape(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def info(title: str) -> dict:
    """ファイルの縮小版URL・作者・ライセンスを問い合わせる"""
    query = urllib.parse.urlencode({
        "action": "query", "titles": title, "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": 1000, "format": "json",
    })
    page = next(iter(json.loads(get(f"{API}?{query}"))["query"]["pages"].values()))
    if "imageinfo" not in page:
        raise SystemExit(f"見つかりません: {title}")
    ii = page["imageinfo"][0]
    meta = ii["extmetadata"]
    return {
        "title": page["title"],
        "thumb": ii["thumburl"],
        "source": ii["descriptionurl"],
        "artist": plain(meta.get("Artist", {}).get("value", "")) or "不明",
        "license": plain(meta.get("LicenseShortName", {}).get("value", "")),
    }


def is_pd(license_name: str) -> bool:
    """パブリックドメイン（またはCC0）かどうか"""
    return license_name.lower().startswith(PD_LICENSES)


def write_credits_md(credits: dict) -> None:
    """credits.json から人が読む一覧表を作る"""
    lines = ["# 画像の出典", "", "すべて Wikimedia Commons のパブリックドメイン（CC0を含む）画像を縮小して使用。", "",
             "| id | 作品 | 作者 | ライセンス | 元ページ |", "|---|---|---|---|---|"]
    for key, c in sorted(credits.items()):
        lines.append(f"| {key} | {c['name']} | {c['artist']} | {c['license']} | {c['source']} |")
    (IMAGES / "CREDITS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    """--check ならライセンスを表示、そうでなければ取得して記録する"""
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == "--check":
        i = info(args[1])
        print(f"{i['title']} | {i['license']} | {i['artist']} | PD={is_pd(i['license'])}")
        return
    if len(args) != 3:
        raise SystemExit(__doc__)
    key, title, name = args
    i = info(title)
    if not is_pd(i["license"]):
        raise SystemExit(f"パブリックドメインではないため保存しません: {i['license']}")
    IMAGES.mkdir(exist_ok=True)
    out = IMAGES / f"{key}.jpg"
    out.write_bytes(get(i["thumb"]))
    # 長辺800pxに縮小して軽くする（macOS の sips を使う）
    subprocess.run(["sips", "-Z", "800", "-s", "format", "jpeg", "-s", "formatOptions", "75", str(out)],
                   check=False, capture_output=True)
    # 複数の作業が同時に書いても壊れないよう、ロックを取ってから読み書きする
    with open(IMAGES / ".credits.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        credits = json.loads(CREDITS_JSON.read_text(encoding="utf-8")) if CREDITS_JSON.exists() else {}
        credits[key] = {"name": name, "artist": i["artist"], "license": i["license"], "source": i["source"]}
        CREDITS_JSON.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        write_credits_md(credits)
    print(f"保存: images/{key}.jpg（{i['license']} / {i['artist']}）")


if __name__ == "__main__":
    main()
