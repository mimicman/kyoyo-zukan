"""data/index.json・data/fields/*.json・data/people/*.json を読み、アプリと同じ形にまとめる。"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load() -> dict:
    """hero・fields（カードのある分野だけ）・cards（各カードに field を付けたもの）を返す"""
    index = json.loads((ROOT / "data" / "index.json").read_text(encoding="utf-8"))
    cards, fields = [], []
    for f in index["fields"]:
        path = ROOT / "data" / "fields" / f"{f['id']}.json"
        body = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"cards": []}
        if body["cards"]:
            fields.append({**f, "chapters": body.get("chapters", [])})
        cards.extend({**c, "field": f["id"]} for c in body["cards"])
    people = []
    for name in index.get("people", []):
        path = ROOT / "data" / "people" / f"{name}.json"
        if path.exists():
            people.extend({**p, "_file": name} for p in json.loads(path.read_text(encoding="utf-8"))["people"])
    return {"hero": index["hero"], "groups": index.get("groups", []), "fields": fields,
            "all_fields": index["fields"], "cards": cards, "people": people, "people_files": index.get("people", [])}
