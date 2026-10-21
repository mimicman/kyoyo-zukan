/* 教養の図解：画面の切り替え・スワイプ・キーワード表示
 * 画面は URL の # 以降で決まる
 *   #/                   ホーム
 *   #/<分野>             分野のカード一覧
 *   #/<分野>/<カード>     カード（同じ分野のカードを横スワイプで見る）
 */

const app = document.getElementById("app");
const svgCache = new Map();
let data = null;      // data/cards.json
let credits = {};     // images/credits.json
let deckField = null; // いま表示しているカード列の分野（同じ分野内の移動では作り直さない）

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

/** HTML に埋め込む文字列をエスケープする */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
const no = (c) => String(cardsOf(c.field).indexOf(c) + 1).padStart(2, "0");

/** 図解SVGを取得する（同じ図は1回だけ取りに行く） */
function loadSvg(card) {
  const url = `figures/${card.field}/${card.id}.svg`;
  if (!svgCache.has(url)) {
    svgCache.set(url, fetch(url).then((r) => (r.ok ? r.text() : "")).catch(() => ""));
  }
  return svgCache.get(url);
}

/** data-svg 属性を持つ要素に図解SVGを流し込む */
function fillSvgs(root) {
  root.querySelectorAll("[data-svg]").forEach(async (el) => {
    const svg = await loadSvg(findCard(el.dataset.svg));
    el.innerHTML = svg;
  });
}

/** 日付で決まる「今日の1枚」 */
function todayCard() {
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  return data.cards[day % data.cards.length];
}

/** 画像の出典を短く表す（例: 画像: ラファエロ / PD） */
function shortCredit(imgId) {
  const c = credits[imgId];
  return c ? `画像: ${c.name}` : "";
}

/* ---------- ホーム ---------- */
function renderHome() {
  const read = readStore.all();
  const t = todayCard();
  const tf = fieldOf(t.field);
  const hero = data.hero;
  app.innerHTML = `
    <header class="top"><a class="brand" href="#/">教養の図解</a><span class="count">${data.cards.length}枚</span></header>
    <main class="wrap">
      <figure class="hero">
        <img src="images/${hero.image}.jpg" alt="${esc(credits[hero.image]?.name || "")}">
        <span class="credit">${esc(shortCredit(hero.image))}</span>
        <figcaption class="ttl"><h1>教養の図解</h1><p>${esc(hero.tagline)}</p></figcaption>
      </figure>

      <h2 class="sec-h">今日の1枚</h2>
      <a class="today" data-field="${t.field}" href="#/${cardKey(t)}">
        <div class="thumb" data-svg="${cardKey(t)}"></div>
        <div><div class="k">${esc(tf.name)} ${no(t)}</div><h3>${esc(t.title)}</h3><p>${esc(t.line)}</p></div>
      </a>

      <h2 class="sec-h">分野</h2>
      <div class="fields">
        ${data.fields.map((f) => {
          const cs = cardsOf(f.id);
          const done = cs.filter((c) => read.has(cardKey(c))).length;
          return `<a class="field-tile" data-field="${f.id}" href="#/${f.id}">
            <span class="prog">${done}/${cs.length}</span>
            <svg class="ico" viewBox="0 0 48 48">${f.icon}</svg>
            <div><h3>${esc(f.name)}</h3><p>${esc(f.desc)}</p></div>
          </a>`;
        }).join("")}
      </div>
      <p class="soon">分野は少しずつ増やします</p>
    </main>`;
  fillSvgs(app);
}

/* ---------- 分野の一覧 ---------- */
function renderField(fieldId) {
  const f = fieldOf(fieldId);
  if (!f) return renderHome();
  const read = readStore.all();
  app.innerHTML = `
    <header class="top" data-field="${f.id}"><a class="back" href="#/">${ICON.back}ホーム</a></header>
    <main class="wrap" data-field="${f.id}">
      <div class="field-head">
        <svg class="ico" viewBox="0 0 48 48">${f.icon}</svg>
        <div><h1>${esc(f.name)}</h1><p>${esc(f.desc)}</p></div>
      </div>
      <div class="grid">
        ${cardsOf(f.id).map((c) => `
          <a class="tile" href="#/${cardKey(c)}">
            ${read.has(cardKey(c)) ? `<span class="read" aria-label="既読">${ICON.check}</span>` : ""}
            <div class="thumb" data-svg="${cardKey(c)}"></div>
            <div class="cap"><div class="no">${no(c)}</div><h3>${esc(c.title)}</h3></div>
          </a>`).join("")}
      </div>
    </main>`;
  fillSvgs(app);
}

/* ---------- カード ---------- */

/** カード1枚分の HTML */
function cardHtml(c) {
  const f = fieldOf(c.field);
  const img = c.image;
  const banner = img
    ? `<button class="banner has-img" type="button" data-view="${img.id}" aria-label="画像を拡大">
         <img src="images/${img.id}.jpg" alt="${esc(credits[img.id]?.name || "")}" style="object-position:${esc(img.pos || "50% 50%")}" loading="lazy">
         <span class="credit">${esc(shortCredit(img.id))}</span>
         <span class="ttl"><span class="k">${esc(f.name)} ${no(c)}・${esc(c.era)}</span><h2>${esc(c.title)}</h2></span>
       </button>`
    : `<div class="banner">
         <svg class="pattern" viewBox="0 0 48 48">${f.icon}</svg>
         <span class="ttl"><span class="k">${esc(f.name)} ${no(c)}・${esc(c.era)}</span><h2>${esc(c.title)}</h2></span>
       </div>`;
  const links = (c.links || []).map(findCard).filter(Boolean);
  return `
    <article class="card" data-field="${c.field}">
      ${banner}
      <div class="fig" data-svg="${cardKey(c)}" role="img" aria-label="${esc(c.title)}の図"></div>
      <p class="line">${esc(c.line)}</p>
      <div class="chips">
        ${c.keywords.map((k, i) => `<button class="chip" type="button" aria-expanded="false" data-kw="${i}">${esc(k.word)}</button>`).join("")}
      </div>
      <div class="note" hidden></div>
      ${links.length ? `<nav class="links"><span>つながり</span>
        ${links.map((l) => `<a href="#/${cardKey(l)}" data-field="${l.field}"><i>${esc(fieldOf(l.field).name)}</i>${esc(l.title)}</a>`).join("")}
      </nav>` : ""}
    </article>`;
}

/** カード列（1分野ぶん）を作り、指定のカードを表示する */
function renderDeck(fieldId, cardId) {
  const f = fieldOf(fieldId);
  const cards = cardsOf(fieldId);
  let idx = cards.findIndex((c) => c.id === cardId);
  if (!f || idx < 0) return renderField(fieldId);

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
        <span class="dots">${cards.map(() => "<i></i>").join("")}</span>
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

/** いま見ているカードの番号・点・既読を更新する */
function markCurrent(cards, idx) {
  const c = cards[idx];
  app.querySelector(".top .count").textContent = `${idx + 1} / ${cards.length}`;
  app.querySelectorAll(".dots i").forEach((d, i) => d.classList.toggle("on", i === idx));
  app.querySelector(".pager .prev").disabled = idx === 0;
  app.querySelector(".pager .next").disabled = idx === cards.length - 1;
  document.title = `${c.title}｜教養の図解`;
  readStore.add(cardKey(c));
  const hash = `#/${cardKey(c)}`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

/** カード列の操作（スワイプ・ボタン・キー・キーワード・画像拡大）をつなぐ */
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

/* ---------- 画面の切り替え ---------- */
function route() {
  const [fieldId, cardId] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (fieldId && cardId) return renderDeck(fieldId, cardId);
  deckField = null;
  document.body.classList.remove("deck-mode");
  document.title = "教養の図解";
  if (fieldId) renderField(fieldId);
  else renderHome();
  window.scrollTo(0, 0);
}

// ← → キーでカードを送る。Esc で一覧に戻る
document.addEventListener("keydown", (e) => {
  if (!deckField || app.querySelector("dialog[open]")) return;
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

/** データを読み込んで最初の画面を出す */
async function start() {
  try {
    [data, credits] = await Promise.all([
      fetch("data/cards.json").then((r) => r.json()),
      fetch("images/credits.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
  } catch {
    app.innerHTML = '<p class="wrap">データを読み込めませんでした。</p>';
    return;
  }
  route();
}
start();
