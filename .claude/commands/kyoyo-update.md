---
description: 教養の図解を更新して GitHub Pages に反映する
argument-hint: "<やりたい変更（例: 世界史に産業革命の図を追加）>"
---

`README.md` を読み、その手順と決まりに従って次を行う。

変更内容: $ARGUMENTS

1. HTML を変更する。ページを増やす場合は README の「ページを増やすとき」に従う。文字は少なく、図解（インラインSVG）中心にする
2. `/Users/suzukitomohiro/workspace/AllInOneStorage/.venv/bin/python tools/check_layout.py <変更したページ>` で表示を確認する。問題0件であること、スクリーンショットで図の文字が重なっていないことを確かめる
3. 変更をコミットして `main` に push する（日本語のメッセージ）
4. 何を変えたか、確認したこと、公開URL（https://mimicman.github.io/kyoyo-zukan/）を短く報告する
