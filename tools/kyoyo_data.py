"""data/index.json と data/fields/*.json を読み、アプリと同じ形（分野一覧＋全カード）にまとめる。"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load() -> dict:
    """hero・fields（カードのある分野だけ）・cards（各カードに field を付けたもの）を返す"""
    index = json.loads((ROOT / "data" / "index.json").read_text(encoding="utf-8"))
    cards, fields = [], []
    for f in index["fields"]:
        path = ROOT / "data" / "fields" / f"{f['id']}.json"
        field_cards = json.loads(path.read_text(encoding="utf-8"))["cards"] if path.exists() else []
        if field_cards:
            fields.append(f)
        cards.extend({**c, "field": f["id"]} for c in field_cards)
    return {"hero": index["hero"], "fields": fields, "all_fields": index["fields"], "cards": cards}
