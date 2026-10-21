---
description: 教養の図解にカードを足す・直して GitHub Pages に反映する
argument-hint: "<やりたい変更（例: 経済に「ゲーム理論」のカードを追加）>"
---

`README.md` を読み、その手順と決まりに従って次を行う。

変更内容: $ARGUMENTS

1. 図（`figures/<分野>/<id>.svg`）と `data/cards.json` を変更する。文字は最小限にし、説明は図で済ませる。画像が必要なら、取得する前に画像名と取得元をユーザーに示して許可をもらい、`tools/fetch_commons.py` で取得する
2. `python3 tools/validate.py` で問題0件にする
3. `/Users/suzukitomohiro/workspace/AllInOneStorage/.venv/bin/python tools/check_layout.py <変更したカード>` で問題0件を確認し、スクリーンショットで図の文字が重なっていないことを目で確かめる
4. 変更をコミットして `main` に push する（日本語のメッセージ）
5. 何を変えたか、確認したこと、公開URL（https://mimicman.github.io/kyoyo-zukan/）を短く報告する
