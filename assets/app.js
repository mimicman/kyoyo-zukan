/* 教養の図解：画面の切り替え・スワイプ・キーワード・人物・年表
 * 画面は URL の # 以降で決まる
 *   #/                   ホーム
 *   #/<分野>             分野の目次（章ごと）
 *   #/<分野>/<カード>     カード（同じ分野のカードを横スワイプで見る。章をまたいで続く）
 *   #/timeline           年表（年代のあるカードと人物を、分野をまたいで並べる）
 *   #/people             人物辞典の一覧
 *   #/people/<人物>       人物ページ
 */

const app = document.getElementById("app");
const svgCache = new Map();
let data = null;      // data/index.json・data/fields/*.json・data/people/*.json をまとめたもの
let credits = {};     // images/credits.json
let deckField = null; // いま表示しているカード列の分野（同じ分野内の移動では作り直さない）

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  person: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="24" cy="15" r="7"/><path d="M10 42c0-9 6-15 14-15s14 6 14 15"/></svg>',
  timeline: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 6v36"/><circle cx="10" cy="12" r="3"/><circle cx="10" cy="24" r="3"/><circle cx="10" cy="36" r="3"/><path d="M18 12h20M18 24h14M18 36h18"/></svg>',
};

/** HTML に埋め込む文字列をエスケープする */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** 既読の記録（ブラウザ内に保存。使えない環境では記録しないだけ） */
const readStore = {
  key: "kyoyo-zukan:read",
  all() {
    try { return new Set(JSON.parse(localStorage.getItem(this.key) || "[]")); } catch { return new Set(); }
  },
  add(id) {
    try { const s = this.all(); s.add(id); localStorage.setItem(this.key, JSON.stringify([...s])); } catch { /* 保存できなくても表示は続ける */ }
  },
};

const fieldOf = (id) => data.fields.find((f) => f.id === id);
const cardsOf = (fieldId) => data.cards.filter((c) => c.field === fieldId);
const cardKey = (c) => `${c.field}/${c.id}`;
const findCard = (key) => data.cards.find((c) => cardKey(c) === key);
const personOf = (id) => data.people.find((p) => p.id === id);
const isSummary = (c) => c.kind === "summary";

/** 分野の章の一覧（章の定義がない分野は1章として扱う） */
function chaptersOf(fieldId) {
  const f = fieldOf(fieldId);
  return f.chapters?.length ? f.chapters : [{ id: "", name: f.name, desc: "" }];
}
/** 章に属するカード（まとめカードが先頭） */
function chapterCards(fieldId, chapterId) {
  const cs = cardsOf(fieldId).filter((c) => (c.chapter || "") === chapterId);
  return [...cs.filter(isSummary), ...cs.filter((c) => !isSummary(c))];
}
/** 分野のカードを章の順に並べたもの（カード列の順番） */
function orderedCards(fieldId) {
  return chaptersOf(fieldId).flatMap((ch) => chapterCards(fieldId, ch.id));
}
/** カードの番号（例: 「2-3」、まとめカードは「第2章」） */
function cardNo(c) {
  const chs = chaptersOf(c.field);
  const ci = chs.findIndex((ch) => ch.id === (c.chapter || ""));
  const inCh = chapterCards(c.field, c.chapter || "").filter((x) => !isSummary(x));
  if (isSummary(c)) return `第${ci + 1}章`;
  return chs.length > 1 ? `${ci + 1}-${inCh.indexOf(c) + 1}` : String(inCh.indexOf(c) + 1).padStart(2, "0");
}

/** 図解SVGを取得する（同じ図は1回だけ取りに行く） */
function loadSvg(url) {
  if (!svgCache.has(url)) {
    svgCache.set(url, fetch(url).then((r) => (r.ok ? r.text() : "")).catch(() => ""));
  }
  return svgCache.get(url);
}
const figUrl = (c) => `figures/${c.field}/${c.id}.svg`;

/** data-svg 属性（SVGのURL）を持つ要素に図を流し込む */
function fillSvgs(root) {
  root.querySelectorAll("[data-svg]").forEach(async (el) => {
    el.innerHTML = await loadSvg(el.dataset.svg);
  });
}

/** 日付で決まる「今日の1枚」（まとめカードは除く） */
function todayCard() {
  const pool = data.cards.filter((c) => !isSummary(c));
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  return pool[day % pool.length];
}

/** 画像の出典を短く表す */
function shortCredit(imgId) {
  const c = credits[imgId];
  return c ? `画像: ${c.name}` : "";
}

/** 年を読みやすく（-509→前509年、-46億年→約46億年前） */
function fmtYear(y) {
  if (y == null) return "?";
  // 紀元前の年（負の数）を「今から何年前」に直して表す
  const ago = -y + 2000;
  if (y <= -100000000) return `約${+(ago / 100000000).toFixed(1)}億年前`;
  if (y <= -10000) return `約${+(ago / 10000).toFixed(1)}万年前`;
  return y < 0 ? `前${-y}年` : `${y}年`;
}
function fmtSpan(ys) {
  if (!ys) return "";
  const [a, b] = ys;
  if (a == null) return `〜${fmtYear(b)}`;
  return b != null && b !== a ? `${fmtYear(a)}〜${fmtYear(b)}` : fmtYear(a);
}

/* ---------- 人名の自動リンク ---------- */

let personRe = null;
let personByName = new Map();
/** 人物辞典の名前・別名から、文中の人名を見つける正規表現を作る（長い名前を優先） */
function buildPersonIndex() {
  personByName = new Map();
  data.people.forEach((p) => [p.name, ...(p.aliases || [])].forEach((n) => { if (n && n.length >= 2) personByName.set(n, p.id); }));
  const names = [...personByName.keys()].sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // カタカナ語の一部（「カントリー」の中の「カント」など）は人名として扱わない
  personRe = names.length ? new RegExp(`(?<![ァ-ヶー])(?:${names.join("|")})(?![ァ-ヶー])`, "g") : null;
}
/** 文をエスケープし、辞典にある人名をボタンにする（1枚のカードで同じ人は最初の1回だけ） */
function linkPeople(text, seen) {
  const s = esc(text);
  if (!personRe || !seen) return s;
  return s.replace(personRe, (m) => {
    const id = personByName.get(m);
    if (!id || seen.has(id)) return m;
    seen.add(id);
    return `<button type="button" class="person" data-person="${id}">${m}</button>`;
  });
}

/* ---------- ホーム ---------- */

/** ホームの分野タイル（既読数つき） */
function fieldTile(f, read) {
  const cs = cardsOf(f.id).filter((c) => !isSummary(c));
  const done = cs.filter((c) => read.has(cardKey(c))).length;
  return `<a class="field-tile" data-field="${f.id}" href="#/${f.id}">
    <span class="prog">${done}/${cs.length}</span>
    <svg class="ico" viewBox="0 0 48 48">${f.icon}</svg>
    <div><h3>${esc(f.name)}</h3><p>${esc(f.desc)}</p></div>
  </a>`;
}

function renderHome() {
  const read = readStore.all();
  const t = todayCard();
  const tf = fieldOf(t.field);
  const hero = data.hero;
  const total = data.cards.filter((c) => !isSummary(c)).length;
  app.innerHTML = `
    <header class="top"><a class="brand" href="#/">教養の図解</a><span class="count">${total}枚</span></header>
    <main class="wrap">
      <figure class="hero">
        <img src="images/${hero.image}.jpg" alt="${esc(credits[hero.image]?.name || "")}">
        <span class="credit">${esc(shortCredit(hero.image))}</span>
        <figcaption class="ttl"><h1>教養の図解</h1><p>${esc(hero.tagline)}</p></figcaption>
      </figure>

      <h2 class="sec-h">今日の1枚</h2>
      <a class="today" data-field="${t.field}" href="#/${cardKey(t)}">
        <div class="thumb" data-svg="${figUrl(t)}"></div>
        <div><div class="k">${esc(tf.name)} ${cardNo(t)}</div><h3>${esc(t.title)}</h3><p>${esc(t.line)}</p></div>
      </a>

      <div class="views">
        <a class="view-tile" href="#/timeline">${ICON.timeline}<div><h3>年表で見る</h3><p>同じ時代に何があったか</p></div></a>
        <a class="view-tile" href="#/people">${ICON.person}<div><h3>人物辞典</h3><p>${data.people.length}人の「何をした人か」</p></div></a>
      </div>

      ${data.groups.map((g) => {
        const fs = data.fields.filter((f) => f.group === g.id);
        if (!fs.length) return "";
        return `<h2 class="sec-h">${esc(g.name)}</h2>
          <div class="fields">${fs.map((f) => fieldTile(f, read)).join("")}</div>`;
      }).join("")}
      <p class="soon">全${data.fields.length}分野</p>
    </main>`;
  fillSvgs(app);
}

/* ---------- 分野の目次（章ごと） ---------- */
function renderField(fieldId) {
  const f = fieldOf(fieldId);
  if (!f) return renderHome();
  const read = readStore.all();
  const chs = chaptersOf(fieldId);
  app.innerHTML = `
    <header class="top" data-field="${f.id}"><a class="back" href="#/">${ICON.back}ホーム</a></header>
    <main class="wrap" data-field="${f.id}">
      <div class="field-head">
        <svg class="ico" viewBox="0 0 48 48">${f.icon}</svg>
        <div><h1>${esc(f.name)}</h1><p>${esc(f.desc)}</p></div>
      </div>
      ${chs.length > 1 ? `<nav class="toc">${chs.map((ch, i) => `<a href="#/${f.id}" data-jump="ch-${i}"><b>${i + 1}</b>${esc(ch.name)}</a>`).join("")}</nav>` : ""}
      ${chs.map((ch, i) => {
        const cs = chapterCards(fieldId, ch.id);
        const sum = cs.find(isSummary);
        const rest = cs.filter((c) => !isSummary(c));
        return `<section class="chapter" id="ch-${i}">
          ${chs.length > 1 ? `<h2 class="ch-h"><span>第${i + 1}章</span>${esc(ch.name)}</h2>${ch.desc ? `<p class="ch-desc">${esc(ch.desc)}</p>` : ""}` : ""}
          ${sum ? `<a class="sum-tile" href="#/${cardKey(sum)}">
            <div class="thumb" data-svg="${figUrl(sum)}"></div>
            <div class="cap"><div class="no">まとめ</div><h3>${esc(sum.title)}</h3><p>${esc(sum.line)}</p></div>
          </a>` : ""}
          <div class="grid">
            ${rest.map((c) => `
              <a class="tile" href="#/${cardKey(c)}">
                ${read.has(cardKey(c)) ? `<span class="read" aria-label="既読">${ICON.check}</span>` : ""}
                <div class="thumb" data-svg="${figUrl(c)}"></div>
                <div class="cap"><div class="no">${cardNo(c)}</div><h3>${esc(c.title)}</h3></div>
              </a>`).join("")}
          </div>
        </section>`;
      }).join("")}
    </main>`;
  app.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById(a.dataset.jump)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  fillSvgs(app);
}

/* ---------- カード ---------- */

/** つながりマップ：左にこのカードへつながるカード、右に次に読むカード */
function linkMap(c) {
  const key = cardKey(c);
  const incoming = data.cards.filter((x) => (x.links || []).includes(key)).slice(0, 4);
  const outgoing = (c.links || []).map(findCard).filter(Boolean);
  if (!incoming.length && !outgoing.length) return "";
  const node = (x) => `<a href="#/${cardKey(x)}" data-field="${x.field}"><i>${esc(fieldOf(x.field).name)}</i>${esc(x.title)}</a>`;
  return `<nav class="linkmap" aria-label="つながり">
    <div class="lm-col lm-in"><span class="lm-h">ここから来る</span>${incoming.map(node).join("") || '<em>—</em>'}</div>
    <div class="lm-center" data-field="${c.field}"><span>${esc(c.title)}</span></div>
    <div class="lm-col lm-out"><span class="lm-h">次に読む</span>${outgoing.map(node).join("") || '<em>—</em>'}</div>
  </nav>`;
}

/** まとめカードの「この章のカード」一覧 */
function chapterList(c) {
  const rest = chapterCards(c.field, c.chapter || "").filter((x) => !isSummary(x));
  return `<nav class="ch-list"><span>この章のカード</span>
    ${rest.map((x) => `<a href="#/${cardKey(x)}"><b>${cardNo(x)}</b><span><strong>${esc(x.title)}</strong>${esc(x.line)}</span></a>`).join("")}
  </nav>`;
}

/** カード1枚分の HTML */
function cardHtml(c) {
  const f = fieldOf(c.field);
  const img = c.image;
  const seen = new Set();
  const label = isSummary(c) ? `${esc(f.name)} ${cardNo(c)}のまとめ` : `${esc(f.name)} ${cardNo(c)}・${esc(c.era)}`;
  const banner = img
    ? `<button class="banner has-img" type="button" data-view="${img.id}" aria-label="画像を拡大">
         <img src="images/${img.id}.jpg" alt="${esc(credits[img.id]?.name || "")}" style="object-position:${esc(img.pos || "50% 50%")}" loading="lazy">
         <span class="credit">${esc(shortCredit(img.id))}</span>
         <span class="ttl"><span class="k">${label}</span><h2>${esc(c.title)}</h2></span>
       </button>`
    : `<div class="banner">
         <svg class="pattern" viewBox="0 0 48 48">${f.icon}</svg>
         <span class="ttl"><span class="k">${label}</span><h2>${esc(c.title)}</h2></span>
       </div>`;
  return `
    <article class="card${isSummary(c) ? " summary" : ""}" data-field="${c.field}">
      ${banner}
      <div class="fig" data-svg="${figUrl(c)}" role="img" aria-label="${esc(c.title)}の図"></div>
      <p class="line">${linkPeople(c.line, seen)}</p>
      ${c.points ? `<ol class="points">${c.points.map((pt) => `<li>${linkPeople(pt, seen)}</li>`).join("")}</ol>` : ""}
      ${c.example || c.why ? `<dl class="facts">
        ${c.example ? `<div class="example"><dt>例</dt><dd>${linkPeople(c.example, seen)}</dd></div>` : ""}
        ${c.why ? `<div class="why"><dt>なぜ大事</dt><dd>${linkPeople(c.why, seen)}</dd></div>` : ""}
      </dl>` : ""}
      ${isSummary(c) ? chapterList(c) : ""}
      <div class="chips">
        ${(c.keywords || []).map((k, i) => `<button class="chip" type="button" aria-expanded="false" data-kw="${i}">${esc(k.word)}</button>`).join("")}
      </div>
      <div class="note" hidden></div>
      ${c.more ? `<details class="more"><summary>もっと詳しく</summary><p>${linkPeople(c.more, seen)}</p></details>` : ""}
      ${linkMap(c)}
    </article>`;
}

/** カード列（1分野ぶん、章の順）を作り、指定のカードを表示する */
function renderDeck(fieldId, cardId) {
  const f = fieldOf(fieldId);
  if (!f) return renderHome();
  const cards = orderedCards(fieldId);
  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return renderField(fieldId);

  if (deckField !== fieldId) {
    deckField = fieldId;
    document.body.classList.add("deck-mode");
    app.innerHTML = `
      <header class="top" data-field="${f.id}">
        <a class="back" href="#/${f.id}">${ICON.back}${esc(f.name)}</a>
        <span class="count"></span>
      </header>
      <main class="deck" data-field="${f.id}">
        ${cards.map((c) => `<section class="slide" data-key="${cardKey(c)}">${cardHtml(c)}</section>`).join("")}
      </main>
      <nav class="pager" data-field="${f.id}">
        <button type="button" class="prev" aria-label="前のカード">${ICON.back}</button>
        <span class="dots"></span>
        <button type="button" class="next" aria-label="次のカード">${ICON.next}</button>
      </nav>
      <dialog class="viewer"><button class="close" type="button" aria-label="閉じる">×</button><img alt=""><p></p></dialog>`;
    fillSvgs(app);
    bindDeck(cards);
  }
  const deck = app.querySelector(".deck");
  deck.style.scrollBehavior = "auto";
  deck.scrollLeft = idx * deck.clientWidth;
  deck.style.scrollBehavior = "";
  markCurrent(cards, idx);
}

/** いま見ているカードの章・番号・点・既読を更新する（点は章の中のカード数） */
function markCurrent(cards, idx) {
  const c = cards[idx];
  const chs = chaptersOf(c.field);
  const ch = chs.find((x) => x.id === (c.chapter || "")) || chs[0];
  const inCh = chapterCards(c.field, ch.id);
  const pos = inCh.indexOf(c);
  app.querySelector(".top .count").textContent = chs.length > 1 ? `${ch.name}　${pos + 1}/${inCh.length}` : `${pos + 1} / ${inCh.length}`;
  app.querySelector(".dots").innerHTML = inCh.map((_, i) => `<i class="${i === pos ? "on" : ""}"></i>`).join("");
  app.querySelector(".pager .prev").disabled = idx === 0;
  app.querySelector(".pager .next").disabled = idx === cards.length - 1;
  document.title = `${c.title}｜教養の図解`;
  readStore.add(cardKey(c));
  const hash = `#/${cardKey(c)}`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

/** カード列の操作（スワイプ・ボタン・キーワード・画像拡大）をつなぐ */
function bindDeck(cards) {
  const deck = app.querySelector(".deck");
  const current = () => Math.round(deck.scrollLeft / deck.clientWidth);
  const go = (i) => deck.scrollTo({ left: Math.max(0, Math.min(cards.length - 1, i)) * deck.clientWidth });

  // スワイプが止まったら、そのカードを「いま見ている」ものにする
  let timer;
  deck.addEventListener("scroll", () => {
    clearTimeout(timer);
    timer = setTimeout(() => markCurrent(cards, current()), 120);
  });
  app.querySelector(".pager .prev").onclick = () => go(current() - 1);
  app.querySelector(".pager .next").onclick = () => go(current() + 1);

  // キーワード：押すとその説明を出す。もう一度押すと閉じる
  deck.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) {
      const card = chip.closest(".card");
      const c = findCard(chip.closest(".slide").dataset.key);
      const note = card.querySelector(".note");
      const open = chip.getAttribute("aria-expanded") === "true";
      card.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-expanded", "false"));
      if (open) { note.hidden = true; return; }
      const k = c.keywords[chip.dataset.kw];
      chip.setAttribute("aria-expanded", "true");
      note.innerHTML = `<b>${esc(k.word)}</b>${esc(k.note)}`;
      note.hidden = false;
      return;
    }
    const view = e.target.closest("[data-view]");
    if (view) openViewer(view.dataset.view);
  });

  const viewer = app.querySelector("dialog.viewer");
  viewer.querySelector(".close").onclick = () => viewer.close();
  viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });
}

/** 画像を拡大して、出典をくわしく出す */
function openViewer(imgId) {
  const viewer = app.querySelector("dialog.viewer");
  const c = credits[imgId] || {};
  viewer.querySelector("img").src = `images/${imgId}.jpg`;
  viewer.querySelector("img").alt = c.name || "";
  viewer.querySelector("p").innerHTML =
    `${esc(c.name || "")}<br>作者: ${esc(c.artist || "")} ／ ${esc(c.license || "")} ／ <a href="${esc(c.source || "#")}" target="_blank" rel="noopener">Wikimedia Commons</a>`;
  viewer.showModal();
}

/* ---------- 人物 ---------- */

/** 人物の色（日本の人物は日本史、世界の人物は世界史の色） */
const personField = (p) => (p.region === "日本" ? "japan" : "history");

/** 人名をタップしたときに下から出るミニ紹介 */
function openPersonSheet(id) {
  const p = personOf(id);
  if (!p) return;
  let sheet = document.querySelector("dialog.sheet");
  if (!sheet) {
    sheet = document.createElement("dialog");
    sheet.className = "sheet";
    document.body.appendChild(sheet);
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest(".close") || e.target.closest("a")) sheet.close();
    });
  }
  sheet.dataset.field = personField(p);
  sheet.innerHTML = `
    <button class="close" type="button" aria-label="閉じる">×</button>
    <div class="sh-head">
      ${p.image ? `<img src="images/${p.image.id}.jpg" alt="" style="object-position:${esc(p.image.pos || "50% 25%")}">` : `<span class="sh-ico">${ICON.person}</span>`}
      <div><h3>${esc(p.name)}</h3><p>${esc(fmtSpan(p.years))}</p></div>
    </div>
    <p class="sh-line">${esc(p.line)}</p>
    <ol class="points">${(p.did || []).map((d) => `<li>${esc(d)}</li>`).join("")}</ol>
    <a class="sh-more" href="#/people/${p.id}">人物ページを見る ${ICON.next}</a>`;
  sheet.showModal();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button.person");
  if (b) { e.preventDefault(); openPersonSheet(b.dataset.person); }
});

/** 人物辞典の一覧（日本・世界、生まれた年の順） */
function renderPeople() {
  const byYear = (a, b) => (a.years?.[0] ?? a.years?.[1] ?? 0) - (b.years?.[0] ?? b.years?.[1] ?? 0);
  const section = (region) => {
    const ps = data.people.filter((p) => (region === "日本") === (p.region === "日本")).sort(byYear);
    if (!ps.length) return "";
    return `<h2 class="sec-h">${region}の人物（${ps.length}人）</h2>
      <div class="people-list">${ps.map((p) => `
        <a class="person-row" href="#/people/${p.id}" data-field="${personField(p)}">
          ${p.image ? `<img src="images/${p.image.id}.jpg" alt="" loading="lazy" style="object-position:${esc(p.image.pos || "50% 25%")}">` : `<span class="pr-ico">${ICON.person}</span>`}
          <span><b>${esc(p.name)}</b><small>${esc(fmtSpan(p.years))}</small><em>${esc(p.line)}</em></span>
        </a>`).join("")}</div>`;
  };
  app.innerHTML = `
    <header class="top"><a class="back" href="#/">${ICON.back}ホーム</a><span class="count">${data.people.length}人</span></header>
    <main class="wrap">
      <div class="field-head plain"><span class="ico">${ICON.person}</span><div><h1>人物辞典</h1><p>何をした人かを、年表と3つの要点で</p></div></div>
      ${section("日本")}${section("世界")}
    </main>`;
}

/** 人物ページ */
function renderPerson(id) {
  const p = personOf(id);
  if (!p) return renderPeople();
  const f = personField(p);
  const cards = (p.cards || []).map(findCard).filter(Boolean);
  document.title = `${p.name}｜教養の図解`;
  app.innerHTML = `
    <header class="top" data-field="${f}"><a class="back" href="#/people">${ICON.back}人物辞典</a></header>
    <main class="wrap person-page">
      <article class="card" data-field="${f}">
        ${p.image ? `<button class="banner has-img" type="button" data-view="${p.image.id}" aria-label="画像を拡大">
            <img src="images/${p.image.id}.jpg" alt="${esc(credits[p.image.id]?.name || "")}" style="object-position:${esc(p.image.pos || "50% 25%")}">
            <span class="credit">${esc(shortCredit(p.image.id))}</span>
            <span class="ttl"><span class="k">${esc(p.region)}・${esc(fmtSpan(p.years))}</span><h2>${esc(p.name)}</h2></span>
          </button>`
        : `<div class="banner"><svg class="pattern" viewBox="0 0 48 48">${ICON.person.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>
            <span class="ttl"><span class="k">${esc(p.region)}・${esc(fmtSpan(p.years))}</span><h2>${esc(p.name)}</h2></span></div>`}
        ${p.figure ? `<div class="fig" data-svg="figures/people/${p.figure}.svg" role="img" aria-label="${esc(p.name)}の図"></div>` : ""}
        <p class="line">${esc(p.line)}</p>
        <ol class="events">${(p.events || []).map((ev) => `<li><b>${esc(fmtYear(ev.year))}</b><span>${esc(ev.text)}</span></li>`).join("")}</ol>
        <h3 class="mini-h">何をしたか</h3>
        <ol class="points">${(p.did || []).map((d) => `<li>${esc(d)}</li>`).join("")}</ol>
        ${p.legacy ? `<dl class="facts"><div class="why"><dt>今に残る</dt><dd>${esc(p.legacy)}</dd></div></dl>` : ""}
        ${p.more ? `<details class="more"><summary>もっと詳しく</summary><p>${esc(p.more)}</p></details>` : ""}
        ${cards.length ? `<nav class="links"><span>この人が出てくるカード</span>
          ${cards.map((x) => `<a href="#/${cardKey(x)}" data-field="${x.field}"><i>${esc(fieldOf(x.field).name)}</i>${esc(x.title)}</a>`).join("")}
        </nav>` : ""}
      </article>
    </main>
    <dialog class="viewer"><button class="close" type="button" aria-label="閉じる">×</button><img alt=""><p></p></dialog>`;
  const viewer = app.querySelector("dialog.viewer");
  app.querySelector("[data-view]")?.addEventListener("click", (e) => openViewer(e.currentTarget.dataset.view));
  viewer.querySelector(".close").onclick = () => viewer.close();
  fillSvgs(app);
}

/* ---------- 年表 ---------- */

// 年表の大きな区切り（地域で呼び方が違う「古代・中世」は使わず、世紀でそろえる）
const ERAS = [
  { name: "紀元前", to: 1 },
  { name: "1〜10世紀", to: 1001 },
  { name: "11〜15世紀", to: 1501 },
  { name: "16〜18世紀", to: 1801 },
  { name: "19世紀", to: 1901 },
  { name: "20世紀以降", to: Infinity },
];
/** 世紀の見出し（-450→前5世紀、1192→12世紀、大昔は「先史」） */
function centuryOf(y) {
  if (y <= -10000) return "1万年以上前";
  if (y < -3000) return "前4千年紀以前";
  return y < 0 ? `前${Math.floor((-y - 1) / 100) + 1}世紀` : `${Math.floor((y - 1) / 100) + 1}世紀`;
}

let timelineFilter = "all";
function renderTimeline() {
  const items = [
    ...data.cards.filter((c) => c.years && !isSummary(c)).map((c) => ({
      y: c.years[0], kind: "tl-card", group: fieldOf(c.field).group, field: c.field,
      label: c.title, sub: fieldOf(c.field).name, href: `#/${cardKey(c)}`,
    })),
    ...data.people.filter((p) => p.years && (p.years[0] ?? p.years[1]) != null).map((p) => ({
      y: p.years[0] ?? p.years[1] - 40, kind: "tl-person", group: "people", field: personField(p),
      label: p.name, sub: "人物", href: `#/people/${p.id}`,
    })),
  ].sort((a, b) => a.y - b.y);
  const groups = [{ id: "all", name: "すべて" }, ...data.groups, { id: "people", name: "人物" }];
  const shown = items.filter((it) => timelineFilter === "all" || it.group === timelineFilter);

  let html = "";
  let lastEra = null;
  let lastCent = null;
  for (const it of shown) {
    const era = ERAS.find((e) => it.y < e.to);
    if (era !== lastEra) { html += `<h2 class="tl-era">${era.name}</h2>`; lastEra = era; lastCent = null; }
    const cent = centuryOf(it.y);
    if (cent !== lastCent) { html += `<h3 class="tl-cent">${cent}</h3>`; lastCent = cent; }
    html += `<a class="tl-item ${it.kind}" href="${it.href}" data-field="${it.field}">
      <span class="tl-y">${esc(fmtYear(it.y))}</span><span class="tl-dot"></span>
      <span class="tl-t"><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></span></a>`;
  }
  app.innerHTML = `
    <header class="top"><a class="back" href="#/">${ICON.back}ホーム</a><span class="count">${shown.length}件</span></header>
    <main class="wrap">
      <div class="field-head plain"><span class="ico">${ICON.timeline}</span><div><h1>年表</h1><p>分野をまたいで、同じ時代を見比べる</p></div></div>
      <nav class="tl-filter">${groups.map((g) => `<button type="button" data-g="${g.id}" aria-pressed="${g.id === timelineFilter}">${esc(g.name)}</button>`).join("")}</nav>
      <div class="timeline">${html}</div>
    </main>`;
  app.querySelectorAll(".tl-filter button").forEach((b) => b.addEventListener("click", () => {
    timelineFilter = b.dataset.g;
    renderTimeline();
  }));
}

/* ---------- 画面の切り替え ---------- */
function route() {
  const [a, b] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  document.querySelector("dialog.sheet[open]")?.close();
  if (a && b && a !== "people") return renderDeck(a, b);
  deckField = null;
  document.body.classList.remove("deck-mode");
  document.title = "教養の図解";
  if (a === "timeline") renderTimeline();
  else if (a === "people") (b ? renderPerson(b) : renderPeople());
  else if (a) renderField(a);
  else renderHome();
  window.scrollTo(0, 0);
}

// ← → キーでカードを送る。Esc で目次に戻る
document.addEventListener("keydown", (e) => {
  if (!deckField || document.querySelector("dialog[open]")) return;
  if (e.key === "ArrowRight") app.querySelector(".pager .next").click();
  if (e.key === "ArrowLeft") app.querySelector(".pager .prev").click();
  if (e.key === "Escape") location.hash = `#/${deckField}`;
});
// 画面の向きや幅が変わったら、見ていたカードの位置に合わせ直す
window.addEventListener("resize", () => {
  const deck = app.querySelector(".deck");
  if (!deck) return;
  const key = location.hash.replace(/^#\//, "");
  const i = [...deck.children].findIndex((s) => s.dataset.key === key);
  if (i >= 0) { deck.style.scrollBehavior = "auto"; deck.scrollLeft = i * deck.clientWidth; deck.style.scrollBehavior = ""; }
});
window.addEventListener("hashchange", route);

/** JSON を読む（ないときは既定値） */
const getJson = (url, fallback) => fetch(url).then((r) => (r.ok ? r.json() : fallback)).catch(() => fallback);

/** データを読み込んで最初の画面を出す */
async function start() {
  try {
    const [index, creditsJson] = await Promise.all([getJson("data/index.json", null), getJson("images/credits.json", {})]);
    credits = creditsJson;
    // 分野ごとのカードと章を並行して読む（まだカードのない分野は出さない）
    const perField = await Promise.all(index.fields.map((f) => getJson(`data/fields/${f.id}.json`, { cards: [] })));
    const perPeople = await Promise.all((index.people || []).map((n) => getJson(`data/people/${n}.json`, { people: [] })));
    const fields = index.fields.map((f, i) => ({ ...f, chapters: perField[i].chapters || [] }));
    data = {
      hero: index.hero,
      groups: index.groups || [{ id: "", name: "分野" }],
      fields: fields.filter((_, i) => perField[i].cards.length > 0),
      cards: perField.flatMap((j, i) => j.cards.map((c) => ({ ...c, field: index.fields[i].id }))),
      people: perPeople.flatMap((j) => j.people || []),
    };
    buildPersonIndex();
  } catch {
    app.innerHTML = '<p class="wrap">データを読み込めませんでした。</p>';
    return;
  }
  route();
}
start();
