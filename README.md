# 教養の図解（kyoyo-zukan）

教養を **1テーマ＝1枚の図解カード** で学ぶ自分用のページ。文字は最小限にして、図と画像で覚える。

- **公開URL**: https://mimicman.github.io/kyoyo-zukan/
- 検索エンジンには載せない（`noindex` と `robots.txt`）。URLを知っていれば誰でも見られるので、個人情報は書かない
- ビルドは不要。`main` に push すると、1〜2分で公開URLに反映される

## 画面

| URL | 画面 |
|---|---|
| `#/` | ホーム（今日の1枚・分野） |
| `#/<分野>` | 分野のカード一覧（既読に印） |
| `#/<分野>/<カード>` | カード。左右スワイプ・← →キーで前後、Escで一覧へ |

## ファイル

| パス | 中身 |
|---|---|
| `index.html` | 画面の土台と、図で使う矢印（`url(#a-ink)` `url(#a-soft)` `url(#a-<分野>)`） |
| `assets/style.css` | 配色（ライト/ダーク）・レイアウト・図のクラス |
| `assets/app.js` | 画面の切り替え・スワイプ・キーワード表示・画像の拡大 |
| `data/cards.json` | 分野とカードのデータ。**文字はすべてここに書く** |
| `figures/<分野>/<カードid>.svg` | カードの図解 |
| `images/<id>.jpg` / `credits.json` / `CREDITS.md` | パブリックドメインの画像と出典 |
| `tools/validate.py` | データの検査（文字数・ファイルの有無・出典・図の決まり） |
| `tools/check_layout.py` | 全画面の表示確認（Playwright） |
| `tools/fetch_commons.py` | Wikimedia Commons から画像を取得して出典を記録 |

## カードを1枚足す

1. `figures/<分野>/<id>.svg` に図を描く（下の「図の決まり」）
2. `data/cards.json` の `cards` に追記する。同じ分野の中では並び順がそのまま番号になる
   ```json
   {
     "id": "supply-demand", "field": "economics", "title": "需要と供給", "era": "18世紀〜",
     "line": "買いたい量と売りたい量が釣り合う所で、価格が決まる",
     "image": { "id": "adam-smith", "pos": "50% 25%" },
     "keywords": [{ "word": "均衡価格", "note": "需要と供給がちょうど一致するときの価格" }],
     "links": ["economics/inflation"]
   }
   ```
   `image` は任意（`pos` は帯に切り抜くときの中心）。`links` は関連カード（他分野も可）
3. 画像を使うなら取得する（パブリックドメイン/CC0 以外は保存されない）
   ```
   python3 tools/fetch_commons.py --check "File:ファイル名.jpg"
   python3 tools/fetch_commons.py <画像id> "File:ファイル名.jpg" "表示名（作者）"
   sips -Z 800 -s formatOptions 75 images/<画像id>.jpg
   ```
4. `python3 tools/validate.py` で問題0件にする
5. `<Playwright入りのpython> tools/check_layout.py <分野>/<id>` で表示を確認し、`tmp/screenshots/` の画像で図の文字の重なりを見る
6. コミットして push

分野を増やすときは、`data/cards.json` の `fields` に追加し、`assets/style.css` の分野色（`--c-<分野>` をライト・ダーク両方と `[data-field]`）と、`index.html` の矢印 `a-<分野>` を足す。

## 文字の決まり（validate.py が検査）

| 要素 | 上限 |
|---|---|
| 見出し `title` | 15字 |
| ひとこと `line`（図が言いたいことを1行で） | 30字 |
| キーワード | 3つまで、説明 `note` は40字 |
| つながり `links` | 2件まで |

- 段落の文章は書かない。説明は図で済ませる
- 年号は確実なものだけ書き、自信のないものは世紀単位にする。名言の引用や、すぐ古くなる統計値は書かない
- 政治・宗教など評価が分かれる話題は、特定の立場を取らない

## 図の決まり

- `viewBox="0 0 360 280"`（縦は必要なら伸ばしてよい）。図がカードの主役
- 色は直接書かず、クラスだけで指定する（ダークモードに自動で対応するため）
  - 塗り: `.ink`（文字色）`.soft`（薄い文字色）`.fl`（分野色）`.on`（分野色の上の文字）`.tint`（分野色の淡い面）`.paper` `.bgc`
  - 線: `.st` `.st-soft` `.st-f` `.st-line`、点線は `.dash`
  - 文字: `.t-xl` `.t-l` `.t-m` `.t-s` `.t-xs`、中央揃え `.mid`、右揃え `.end`、線と重なる文字は `.halo`（背景色のふち取り）
- `id` 属性は使わない（ページに埋め込むと衝突する）。矢印は `index.html` の共通のものを使う
- 一覧のサムネイルでは図の文字は消える。文字がなくても形で区別できる図にする
