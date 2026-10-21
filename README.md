# 教養の図解（kyoyo-zukan）

教養（哲学・世界史・経済ほか）を、文字を少なく図解中心で学ぶ自分用のページ。GitHub Pages で公開している。

- **公開URL**: https://mimicman.github.io/kyoyo-zukan/
- 検索エンジンには載せない（`noindex` と `robots.txt`）。URLを知っていれば誰でも見られる点に注意し、個人情報は書かない
- 2026-10-21 に `AllInOneStorage/doc/教養/` から分離

## ページ

| ファイル | 内容 |
|---|---|
| `index.html` | 全体地図（分野の関係・時代×分野・学ぶ順番・各ページへの入口） |
| `philosophy.html` | 哲学・思想史 |
| `religion.html` | 宗教 |
| `world-history.html` | 世界史 |
| `japan.html` | 日本史・日本文化 |
| `politics.html` | 政治・法・国際関係 |
| `economics.html` | 経済・お金 |
| `science.html` | 科学史 |
| `psychology.html` | 心理学・脳 |
| `art.html` | 芸術 |
| `_template.html` | 新しいページの雛形 |
| `tools/check_layout.py` | 全ページの表示確認（Playwright） |

ビルドは不要。HTML を直して `main` に push すると、1〜2分で公開URLに反映される。

## 更新の手順

1. HTML を直す
2. 表示を確認する: `python tools/check_layout.py [ページ名.html ...]`（Playwright が入った Python で実行。幅375px・1200px × ライト・ダークで横スクロールとコンソールエラーを確認し、スクリーンショットを `tmp/screenshots/` に保存）
3. コミットして `main` に push する

Claude Code では `/kyoyo-update <やりたい変更>` でこの流れをまとめて実行できる。

## ページを増やすとき

1. `_template.html` をコピーして `<名前>.html` を作る。`<style>` の共通部分は変えず、ページ固有の指定は後ろに足す
2. 全ページの `nav.top` に新しいページへのリンクを足す
3. `index.html` の分野カードや「次の一歩」からリンクする

## 図の決まり

- 図はインラインSVG。viewBox の幅は 360〜400 で縦長に組む（PCでは最大520pxで表示）
- 色は直接書かず、雛形のクラス（`.t` `.box` `.phil` `.on-color` など）を使う。ダークモードはこれで自動対応する
- 年号は確実なものだけ書き、自信のないものは世紀単位にする。名言の引用や、すぐ古くなる統計値は書かない

## 文章の決まり

- 文字は少なく簡潔に。説明は図で済ませ、文章は図を読む手がかりにとどめる
- 「◯◯論」「◯◯主義」などの考え方や専門用語は、名前だけで終わらせない。ページ内の「考え方・用語の解説」（`dl.glossary`、各項目は `<div id="g-xxx">`）で1〜2文で説明し、本文やカードから `#g-xxx` でリンクする
- 政治・宗教など評価が分かれる話題は、特定の立場を支持・批判せず、背景の説明にとどめる
