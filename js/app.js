/* IPAT 기간 암기 퀴즈 — 정리 노트 데이터(js/data.js)로 문제를 만든다. */
(function () {
  "use strict";

  const DATA = window.IPAT_DATA;
  const CATS = DATA.cats;
  const $ = (sel, el = document) => el.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩";

  // ───────────────────────── 문항 원본(행) 만들기 ─────────────────────────
  const ITEMS = [];
  DATA.laws.forEach((law) => {
    law.charts.forEach((chart, ci) => {
      chart.groups.forEach((g, gi) => {
        g.rows.forEach((row, ri) => {
          let text = row.text;
          if (!/<b>/.test(text)) {
            const inner = row.bars.map((b) => b.t).filter(Boolean).join(" · ");
            if (/<b>/.test(inner)) text = inner;
          }
          const blanks = [...text.matchAll(/<b>(.*?)<\/b>/g)].map((m) => m[1]);
          ITEMS.push({
            id: `${law.key}-${ci}-${gi}-${ri}`,
            law, chart, group: g, row, text, blanks,
            main: pickMainBar(row.bars),
          });
        });
      });
    });
  });

  function pickMainBar(bars) {
    const prio = { h: 6, s: 5, o: 4, l: 3, d: 2, g: 1 };
    let best = null;
    for (const b of bars) {
      if (!(b.k in prio) || b.e - b.s < 0.05) continue;
      const score = prio[b.k] * 100 + (b.e - b.s);
      if (!best || score > best.score) best = { ...b, score };
    }
    return best;
  }

  const TYPES = {
    choice: { label: "빈칸 고르기", ok: (it) => it.blanks.length > 0 },
    write: { label: "숫자 쓰기", ok: (it) => it.blanks.length > 0 },
    draw: { label: "간트 그리기", ok: (it) => !!it.main },
  };

  // ───────────────────────── 기록(localStorage) ─────────────────────────
  const KEY = "ipat-period-quiz-v1";
  let STATS = {};
  try { STATS = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { STATS = {}; }
  const saveStats = () => { try { localStorage.setItem(KEY, JSON.stringify(STATS)); } catch (e) { /* 저장 불가 환경 */ } };
  function record(id, type, ok) {
    const s = (STATS[id] = STATS[id] || { c: 0, w: 0 });
    ok ? s.c++ : s.w++;
    s.last = ok ? 1 : 0;
    s[type] = ok ? 1 : 0;
    saveStats();
  }

  // ───────────────────────── 공용 그리기 ─────────────────────────
  const col = (cat) => CATS[cat] || ["#475569", "#1e293b", "#e2e8f0"];
  function richText(s) {
    return s
      .replace(/\[\[nw:(.*?)\]\]/g, '<span class="nw">$1</span>')
      .replace(/\[\[fu:(.*?)\]\]/g, '<span class="fu">$1</span>');
  }
  function barCss(kind, cat) {
    const [c, , l] = col(cat);
    switch (kind) {
      case "h": return `background: repeating-linear-gradient(-45deg, ${c} 0 2px, ${l} 2px 6px); border: 1.5px solid ${c}`;
      case "o": return `background: radial-gradient(${c} 1.3px, transparent 1.7px) 0 0 / 6px 6px, ${l}; border: 1.5px solid ${c}`;
      case "l": return `background: ${l}; border: 1.5px solid ${c}`;
      case "d": return `background: transparent; border: 1.5px dashed ${c}`;
      case "g": return `background: #eef0f3; border: 1px solid #c9ced6`;
      case "s": return `background: ${c}`;
      case "p": return `border: 2.5px solid ${c}`;
      case "k": return `background: ${c}`;
      default: return `background: ${l}`;
    }
  }
  // 막대 좌표(사건 번호, 소수 가능) ↔ 0~1 위치
  function fracOf(chart, i) {
    const p = chart.pos, n = p.length - 1;
    if (i <= 0) return p[0];
    if (i >= n) return p[n];
    const a = Math.floor(i);
    return p[a] + (p[a + 1] - p[a]) * (i - a);
  }
  function idxOf(chart, f) {
    const p = chart.pos, n = p.length - 1;
    if (f <= p[0]) return 0;
    if (f >= p[n]) return n;
    for (let a = 0; a < n; a++) {
      if (f <= p[a + 1]) return a + (f - p[a]) / (p[a + 1] - p[a] || 1);
    }
    return n;
  }
  const pct = (x) => (x * 100).toFixed(3) + "%";

  function axisEl(chart, short) {
    const ax = h("div", { class: "axis" }, h("div", { class: "ln" }));
    chart.ms.forEach((m, i) => {
      ax.append(h("div", { class: "ms " + (m.style || ""), style: `left: ${pct(chart.pos[i])}` },
        h("i"), h("span", { html: (short ? m.short : m.label).replace(" (", "<br>(").replace("우리나라 ", "우리나라<br>").replace("존속기간 ", "존속기간<br>") })));
    });
    return ax;
  }
  function vlines(chart, cls = "vl") {
    return chart.pos.map((p) => h("div", { class: cls, style: `left: ${pct(p)}` }));
  }
  function barsEl(chart, row, cat) {
    const tr = h("div", { class: "track" }, vlines(chart));
    row.bars.forEach((b) => {
      const left = fracOf(chart, b.s), right = fracOf(chart, b.e);
      const st = `left: ${pct(left)}; ${b.k === "p" || b.k === "k" ? "" : `width: calc(${pct(right - left)});`} ${barCss(b.k, cat)}`;
      tr.append(h("div", { class: "bar-b " + b.k, style: st, html: b.k === "s" && b.t ? richText(b.t) : "" }));
    });
    return tr;
  }
  function describeAt(chart, i) {
    const r = Math.round(i);
    if (Math.abs(i - r) < 0.12) return chart.ms[r].label;
    const a = Math.floor(i), b = Math.min(a + 1, chart.ms.length - 1);
    return `${chart.ms[a].short}와 ${chart.ms[b].short} 사이`;
  }

  // ───────────────────────── 상태 ─────────────────────────
  const state = { law: "all", mode: "notes", onlyWrong: false, hideNum: false, count: 10, session: null };
  const lawList = [{ key: "all", title: "전체" }, ...DATA.laws.map((l) => ({ key: l.key, title: l.title }))];
  const modeList = [
    { key: "notes", label: "정리 노트" },
    { key: "choice", label: TYPES.choice.label },
    { key: "write", label: TYPES.write.label },
    { key: "draw", label: TYPES.draw.label },
    { key: "mix", label: "섞어서" },
  ];

  function renderTabs() {
    const lt = $("#lawTabs");
    lt.replaceChildren(...lawList.map((l) => h("button", {
      class: state.law === l.key ? "on" : "",
      onclick: () => { state.law = l.key; state.session = null; render(); },
    }, l.title)));
    const mt = $("#modeTabs");
    mt.replaceChildren(...modeList.map((m) => h("button", {
      class: state.mode === m.key ? "on" : "",
      onclick: () => { state.mode = m.key; state.session = null; render(); },
    }, m.label)));
    $("#onlyWrong").checked = state.onlyWrong;
  }
  function renderScore() {
    const el = $("#score");
    const s = state.session;
    if (!s) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = `${s.right} / ${s.done} 정답`;
  }

  // ───────────────────────── 정리 노트 보기 ─────────────────────────
  function renderNotes(app) {
    const laws = state.law === "all" ? DATA.laws : DATA.laws.filter((l) => l.key === state.law);
    app.append(h("div", { class: "hint", style: "margin: 4px 0 0" },
      "행을 누르면 그 행으로 바로 문제를 풀 수 있어요. ‘숫자 가리기’를 켜면 굵은 숫자를 눌러야 보입니다."));
    laws.forEach((law) => {
      app.append(h("div", { class: "law-head" },
        h("h2", {}, law.title),
        h("div", { class: "tools" },
          h("button", { class: "btn" + (state.hideNum ? " primary" : ""), onclick: () => { state.hideNum = !state.hideNum; render(); } },
            state.hideNum ? "숫자 보이기" : "숫자 가리기"))));
      law.charts.forEach((chart, ci) => {
        const grid = h("div", { class: "grid" + (state.hideNum ? " hide-num" : "") });
        grid.append(h("div", { class: "axis-row" }, h("div", { class: "corner" }, chart.corner || "분류 · 제도 ↓ · 사건 →"), axisEl(chart, false)));
        chart.groups.forEach((g, gi) => {
          const [c, d, l] = col(g.cat);
          const rows = h("div", { class: "grp-rows" });
          g.rows.forEach((row, ri) => {
            const id = `${law.key}-${ci}-${gi}-${ri}`;
            const st = STATS[id];
            const dot = st ? h("span", { class: "stat-dot", title: `맞음 ${st.c} · 틀림 ${st.w}`, style: `background: ${st.last ? "var(--ok)" : "var(--bad)"}` }) : null;
            const textEl = h("div", { class: "rtext", html: richText(row.text) });
            if (row.cmt && row.cmt.length) row.cmt.forEach((cm) => textEl.append(" ", h("span", { class: "cm" }, cm)));
            const r = h("div", { class: "row clickable", title: "이 행으로 문제 풀기" },
              h("div", { class: "rname", style: `color: ${d}` }, row.name, dot),
              h("div", { class: "rbody" }, barsEl(chart, row, g.cat), row.text ? textEl : null));
            r.addEventListener("click", (e) => {
              if (e.target.tagName === "B" && state.hideNum) { e.target.classList.toggle("show"); return; }
              startSession([ITEMS.find((it) => it.id === id)], "mix", true);
            });
            rows.append(r);
          });
          grid.append(h("div", { class: "grp" },
            h("div", { class: "grp-label", style: `background: ${l}; color: ${d}` }, g.label), rows));
        });
        app.append(h("div", { class: "chart" }, grid));
      });
    });
  }

  // ───────────────────────── 퀴즈 시작 화면 ─────────────────────────
  function pool(mode) {
    const items = ITEMS.filter((it) => state.law === "all" || it.law.key === state.law);
    if (mode === "mix") return items.filter((it) => Object.values(TYPES).some((t) => t.ok(it)));
    return items.filter((it) => TYPES[mode].ok(it));
  }
  function weightOf(it) {
    const s = STATS[it.id];
    if (state.onlyWrong) return s && (s.w > 0 && s.last === 0) ? 1 + s.w : 0;
    if (!s) return 1.2;
    return 0.4 + (1.5 * s.w) / (1 + s.c) + (s.last === 0 ? 1 : 0);
  }
  function weightedSample(items, n) {
    const bag = items.map((it) => ({ it, w: weightOf(it) })).filter((x) => x.w > 0);
    const out = [];
    while (out.length < n && bag.length) {
      const total = bag.reduce((a, x) => a + x.w, 0);
      let r = Math.random() * total, k = 0;
      while (r > bag[k].w && k < bag.length - 1) { r -= bag[k].w; k++; }
      out.push(bag[k].it);
      bag.splice(k, 1);
    }
    return out;
  }

  function renderStart(app) {
    const items = pool(state.mode);
    const desc = {
      choice: ["빈칸 고르기", "정리 노트의 굵은 기간이 빈칸으로 바뀝니다. 빈칸마다 보기 중에서 고르세요."],
      write: ["숫자 쓰기", "보기 없이 기간을 직접 적습니다. ‘3개월’, ‘1년 6개월’처럼 숫자와 단위를 함께 쓰세요."],
      draw: ["간트 그리기", "설명을 읽고 타임라인 위에 기간이 시작하는 사건과 끝나는 사건을 직접 끌어서 그립니다."],
      mix: ["섞어서", "세 가지 유형이 행마다 무작위로 나옵니다."],
    }[state.mode];
    const wrongN = items.filter((it) => STATS[it.id] && STATS[it.id].last === 0).length;
    const sel = h("select", { onchange: (e) => (state.count = +e.target.value) },
      ...[10, 20, 30, 0].map((n) => h("option", { value: n, selected: state.count === n }, n ? `${n}문제` : `전부 (${items.length})`)));
    app.append(
      h("div", { class: "qwrap" },
        h("div", { class: "card" },
          h("div", { class: "kind" }, desc[0]),
          h("h3", {}, (state.law === "all" ? "전체 법" : lawList.find((l) => l.key === state.law).title) + " · " + items.length + "개 행"),
          h("div", { class: "ask" }, desc[1]),
          h("div", { class: "startbar" },
            sel,
            h("span", { class: "muted" }, wrongN ? `최근에 틀린 행 ${wrongN}개` : "아직 틀린 기록이 없어요"),
            h("button", { class: "btn blue", style: "margin-left: auto", onclick: () => {
              const n = state.count || items.length;
              let qs = weightedSample(items, n);
              if (!qs.length) { alert("‘틀린 문제 위주’에 해당하는 행이 아직 없어요. 체크를 끄고 먼저 풀어 보세요."); return; }
              startSession(qs, state.mode);
            } }, "시작"))),
        h("div", { class: "start" },
          tile("빈칸 고르기", "보기 4개 중 고르기 · 숫자키 1~4로도 선택"),
          tile("숫자 쓰기", "‘12개월’과 ‘1년’처럼 같은 길이는 정답으로 인정"),
          tile("간트 그리기", "끌어서 그리기 · 사건 원 근처는 자동으로 붙음 · 손잡이로 조절"),
          tile("틀린 문제 위주", "틀린 행일수록 자주 나와요. 기록은 이 브라우저에만 저장"))));
    function tile(t, p) { return h("div", { class: "tile" }, h("h4", {}, t), h("p", {}, p)); }
  }

  // ───────────────────────── 세션 ─────────────────────────
  function startSession(items, mode, single) {
    const qs = [];
    for (const it of items) {
      if (!it) continue;
      if (single) {
        Object.keys(TYPES).forEach((t) => TYPES[t].ok(it) && qs.push({ it, type: t }));
      } else {
        const types = mode === "mix" ? Object.keys(TYPES).filter((t) => TYPES[t].ok(it)) : [mode];
        qs.push({ it, type: types[Math.floor(Math.random() * types.length)] });
      }
    }
    state.session = { qs, i: 0, done: 0, right: 0, wrong: [], back: single ? "notes" : null };
    if (single) state.mode = "mix";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderSession(app) {
    const s = state.session;
    renderScore();
    if (s.i >= s.qs.length) return renderResult(app);
    const q = s.qs[s.i];
    const wrap = h("div", { class: "qwrap" },
      h("div", { class: "qmeta" }, h("span", {}, `${s.i + 1} / ${s.qs.length}`), h("button", { class: "link", onclick: () => { state.session = null; if (s.back) state.mode = s.back; render(); } }, "그만하기")),
      h("div", { class: "progress" }, h("div", { style: `width: ${(s.i / s.qs.length) * 100}%` })));
    const card = h("div", { class: "card" });
    wrap.append(card);
    app.append(wrap);
    const it = q.it;
    const [c, d, l] = col(it.group.cat);
    card.append(
      h("div", { class: "kind" }, TYPES[q.type].label + " · " + it.law.title),
      h("div", {}, h("span", { class: "chip", style: `background: ${l}; color: ${d}` }, it.group.label)),
      h("h3", { style: `color: ${d}` }, it.row.name));
    const finish = (ok, extra) => {
      s.done++;
      if (ok) s.right++; else s.wrong.push(q);
      record(it.id, q.type, ok);
      renderScore();
      const fb = h("div", { class: "feedback " + (ok ? "ok" : "bad") },
        h("b", {}, ok ? "정답이에요." : "아쉬워요."), extra ? " " + extra : "",
        h("div", { class: "full", html: richText(it.text || it.row.text) }));
      if (it.row.cmt && it.row.cmt.length) {
        const cm = h("div", { style: "margin-top: 6px" });
        it.row.cmt.forEach((x) => cm.append(h("span", { class: "cm" }, x)));
        fb.append(cm);
      }
      card.insertBefore(fb, $(".actions", card));
      const next = h("button", { class: "btn primary", onclick: () => { s.i++; render(); } }, s.i + 1 < s.qs.length ? "다음 문제 →" : "결과 보기");
      $(".actions", card).replaceChildren(next);
      next.focus();
    };
    if (q.type === "choice") buildChoice(card, it, finish);
    else if (q.type === "write") buildWrite(card, it, finish);
    else buildDraw(card, it, finish);
  }

  // ── 빈칸 고르기 ──
  const UNIT_POOLS = {
    일: ["10일", "14일", "15일", "20일", "30일", "60일", "90일"],
    개월: ["1개월", "2개월", "3개월", "4개월", "6개월", "9개월", "12개월", "18개월"],
    년: ["1년", "2년", "3년", "4년", "5년", "7년", "10년", "14년", "15년", "20년", "25년", "30년", "50년", "70년"],
    전: ["1년 전", "2년 전", "6개월 전", "3개월 전"],
    복합: ["1년 2개월", "1년 3개월", "1년 4개월", "1년 6개월", "1년 8개월", "2년 6개월", "2년 7개월", "2년 8개월"],
    수: ["12", "16", "18", "19", "20", "22", "24", "28", "30", "31", "36"],
    말: ["지체 없이", "7일 안", "14일 안", "1개월 안"],
  };
  function unitOf(v) {
    if (/전$/.test(v)) return "전";
    if (/^\d+$/.test(v)) return "수";
    if (/년/.test(v) && /개월/.test(v)) return "복합";
    if (/개월$/.test(v)) return "개월";
    if (/일$/.test(v)) return "일";
    if (/년$/.test(v)) return "년";
    return "말";
  }
  function magnitude(v) {
    let m = 0;
    v.replace(/(\d+)\s*(년|개월|일)?/g, (_, n, u) => { n = +n; m += u === "년" ? n * 365 : u === "개월" ? n * 30 : u === "일" ? n : n; });
    return m;
  }
  function optionsFor(v) {
    const u = unitOf(v);
    const allVals = new Set(ITEMS.flatMap((it) => it.blanks).filter((x) => unitOf(x) === u));
    const cand = [...new Set([...(UNIT_POOLS[u] || []), ...allVals])].filter((x) => x !== v);
    const mv = magnitude(v);
    cand.sort((a, b) => Math.abs(Math.log((magnitude(a) + 1) / (mv + 1))) - Math.abs(Math.log((magnitude(b) + 1) / (mv + 1))));
    const pick = shuffle(cand.slice(0, 6)).slice(0, 3);
    return shuffle([v, ...pick]);
  }
  function tokens(text) {
    // [{t:'text'} | {b: value, k: index}]
    const out = []; let last = 0, k = 0;
    for (const m of text.matchAll(/<b>(.*?)<\/b>/g)) {
      out.push({ t: text.slice(last, m.index) });
      out.push({ b: m[1], k: k++ });
      last = m.index + m[0].length;
    }
    out.push({ t: text.slice(last) });
    return out;
  }

  function buildChoice(card, it, finish) {
    card.append(h("div", { class: "ask" }, "빈칸에 들어갈 기간을 아래 보기에서 고르세요."));
    const toks = tokens(it.text);
    const n = it.blanks.length;
    const chosen = Array(n).fill(null);
    let focus = 0, checked = false;
    const blankEls = [];
    const qt = h("div", { class: "qtext" });
    toks.forEach((tk) => {
      if (tk.t != null) qt.insertAdjacentHTML("beforeend", richText(tk.t));
      else {
        const b = h("span", { class: "blank", onclick: () => { if (!checked) { focus = tk.k; paint(); } } },
          n > 1 ? h("span", { class: "no" }, CIRCLED[tk.k]) : null, h("span", { class: "val" }, ""));
        blankEls.push(b); qt.append(b);
      }
    });
    const opts = it.blanks.map(optionsFor);
    const bank = h("div", { class: "bank" });
    const optEls = opts.map((list, k) => {
      const els = list.map((v, oi) => h("button", { class: "opt", onclick: () => choose(k, v) }, v));
      bank.append(h("div", { class: "bank-row" }, n > 1 ? h("span", { class: "no" }, CIRCLED[k]) : null, els));
      return els;
    });
    const checkBtn = h("button", { class: "btn blue", disabled: true, onclick: grade }, "채점");
    card.append(qt, bank, h("div", { class: "actions" }, h("button", { class: "btn", onclick: () => { chosen.fill(null); focus = 0; paint(); } }, "지우기"), checkBtn));
    function choose(k, v) {
      if (checked) return;
      chosen[k] = v;
      const nextEmpty = chosen.findIndex((x) => x == null);
      focus = nextEmpty === -1 ? k : nextEmpty;
      paint();
    }
    function paint() {
      blankEls.forEach((b, k) => {
        $(".val", b).textContent = chosen[k] || "";
        b.className = "blank" + (chosen[k] ? " filled" : "") + (!checked && k === focus ? " focus" : "");
      });
      optEls.forEach((els, k) => els.forEach((e) => e.classList.toggle("sel", e.textContent === chosen[k])));
      checkBtn.disabled = chosen.some((x) => x == null);
    }
    function grade() {
      if (checked || chosen.some((x) => x == null)) return;
      checked = true;
      let all = true;
      blankEls.forEach((b, k) => {
        const ok = chosen[k] === it.blanks[k];
        all = all && ok;
        b.className = "blank " + (ok ? "ok" : "bad");
        if (!ok) b.append(h("span", { class: "ans-fix" }, " → " + it.blanks[k]));
      });
      optEls.forEach((els, k) => els.forEach((e) => {
        if (e.textContent === it.blanks[k]) e.classList.add("right");
        else if (e.textContent === chosen[k]) e.classList.add("wrong");
        e.disabled = true;
      }));
      finish(all);
    }
    card._key = (e) => {
      if (/^[1-4]$/.test(e.key) && !checked) { const v = opts[focus][+e.key - 1]; if (v) choose(focus, v); }
      else if (e.key === "Enter" && !checked) grade();
    };
    paint();
  }

  // ── 숫자 쓰기 ──
  function normalize(v) { return v.replace(/\s+/g, "").replace(/개월|달/g, "M").replace(/년/g, "Y").replace(/일/g, "D"); }
  function sameLength(a, b) {
    const pa = parseLen(a), pb = parseLen(b);
    return pa && pb && pa.m === pb.m && pa.d === pb.d && pa.n === pb.n && pa.before === pb.before;
  }
  function parseLen(v) {
    v = v.replace(/\s+/g, "");
    const before = /전$/.test(v); v = v.replace(/전$/, "");
    if (/^\d+$/.test(v)) return { n: +v, m: 0, d: 0, before };
    let m = 0, d = 0, okAny = false;
    const rest = v.replace(/(\d+)(년|개월|달|일)/g, (_, n, u) => { okAny = true; n = +n; if (u === "년") m += 12 * n; else if (u === "일") d += n; else m += n; return ""; });
    if (!okAny || rest) return null;
    return { n: null, m, d, before };
  }
  function buildWrite(card, it, finish) {
    card.append(h("div", { class: "ask" }, "빈칸에 기간을 직접 적으세요. (예: 3개월, 1년 6개월, 30일)"));
    const qt = h("div", { class: "qtext" });
    const inputs = [];
    tokens(it.text).forEach((tk) => {
      if (tk.t != null) qt.insertAdjacentHTML("beforeend", richText(tk.t));
      else {
        const inp = h("input", { class: "blank", type: "text", inputmode: "text", autocomplete: "off", "aria-label": `빈칸 ${tk.k + 1}`, placeholder: it.blanks.length > 1 ? CIRCLED[tk.k] : "" });
        inp.style.width = Math.max(96, it.blanks[tk.k].length * 17 + 30) + "px";
        inputs.push(inp); qt.append(inp);
      }
    });
    let checked = false;
    const checkBtn = h("button", { class: "btn blue", onclick: grade }, "채점");
    card.append(qt, h("div", { class: "hint" }, "Enter로 채점 · ‘12개월’과 ‘1년’처럼 길이가 같으면 정답으로 인정해요."), h("div", { class: "actions" }, checkBtn));
    inputs.forEach((inp, k) => inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (checked) return; if (k < inputs.length - 1 && !inputs[k + 1].value) inputs[k + 1].focus(); else grade(); }
    }));
    setTimeout(() => inputs[0] && inputs[0].focus(), 30);
    function grade() {
      if (checked) return;
      checked = true;
      let all = true, loose = false;
      inputs.forEach((inp, k) => {
        const ans = it.blanks[k], val = inp.value.trim();
        const exact = normalize(val) === normalize(ans) || normalize(val) + "전" === normalize(ans);
        const eq = exact || sameLength(val, ans) || sameLength(val + "전", ans);
        if (eq && !exact) loose = true;
        all = all && eq;
        inp.readOnly = true;
        inp.classList.add(eq ? "ok" : "bad");
        if (!eq || !exact) inp.insertAdjacentElement("afterend", h("span", { class: "ans-fix" }, (eq ? " (법 표기: " : " → ") + ans + (eq ? ")" : "")));
      });
      finish(all, loose ? "길이는 같지만 법 조문 표기를 확인하세요." : "");
    }
  }

  // ── 간트 그리기 ──
  function buildDraw(card, it, finish) {
    const chart = it.chart;
    const multi = it.row.bars.filter((b) => b.k !== "p" && b.k !== "k" && b.e - b.s >= 0.05).length > 1;
    card.append(h("div", { class: "ask" },
      "설명을 읽고, 이 기간이 어느 사건에서 시작해 어디서 끝나는지 아래 칸에 끌어서 그리세요." +
      (multi ? " (구간이 여러 개면 핵심 빗금 구간 하나만)" : "")));
    card.append(h("div", { class: "qtext", style: "font-size: 16px; line-height: 1.7", html: richText(it.text || it.row.text) }));
    const short = window.innerWidth < 700 || chart.ms.length > 11;
    const pad = h("div", { class: "pad" }, vlines(chart));
    const draw = h("div", { class: "draw" }, axisEl(chart, short), pad,
      h("div", { class: "draw-legend" },
        h("span", {}, "■ 내가 그린 기간"), h("span", { style: "color: var(--ok)" }, "□ 정답 (채점 후)"),
        h("span", {}, "원 근처에서 놓으면 그 사건에 딱 붙어요")));
    card.append(draw);
    let us = null, ue = null, drag = null, checked = false;
    const mine = h("div", { class: "mine", style: barCss(it.main.k === "g" ? "h" : it.main.k, it.group.cat) + "; display: none" });
    const hs = h("div", { class: "handle", style: "display: none" }), he = h("div", { class: "handle", style: "display: none" });
    const ls = h("div", { class: "lbl" }), le = h("div", { class: "lbl" });
    pad.append(mine, hs, he, ls, le);
    const checkBtn = h("button", { class: "btn blue", disabled: true, onclick: grade }, "채점");
    card.append(h("div", { class: "actions" }, h("button", { class: "btn", onclick: () => { if (!checked) { us = ue = null; paint(); } } }, "다시 그리기"), checkBtn));

    function snap(clientX) {
      const r = pad.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      let best = null;
      chart.pos.forEach((p, i) => { const dx = Math.abs(p - f) * r.width; if (dx < 12 && (!best || dx < best.dx)) best = { dx, i }; });
      if (best) return best.i;
      return Math.round(idxOf(chart, f) * 20) / 20;
    }
    pad.addEventListener("pointerdown", (e) => {
      if (checked) return;
      pad.setPointerCapture(e.pointerId);
      const i = snap(e.clientX);
      const r = pad.getBoundingClientRect();
      const near = (v) => v != null && Math.abs(fracOf(chart, v) * r.width - (e.clientX - r.left)) < 14;
      if (near(us)) drag = "s"; else if (near(ue)) drag = "e";
      else { us = i; ue = i; drag = "e"; }
      paint();
    });
    pad.addEventListener("pointermove", (e) => {
      if (!drag || checked) return;
      const i = snap(e.clientX);
      if (drag === "s") us = i; else ue = i;
      paint();
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      if (us != null && ue != null && ue < us) [us, ue] = [ue, us];
      paint();
    };
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);

    function paint() {
      const has = us != null && ue != null;
      [mine, hs, he, ls, le].forEach((x) => (x.style.display = has ? "" : "none"));
      checkBtn.disabled = !has || Math.abs(ue - us) < 0.04;
      if (!has) return;
      const a = Math.min(us, ue), b = Math.max(us, ue);
      const fa = fracOf(chart, a), fb = fracOf(chart, b);
      mine.style.left = pct(fa); mine.style.width = pct(fb - fa);
      hs.style.left = pct(fracOf(chart, us)); he.style.left = pct(fracOf(chart, ue));
      ls.style.left = pct(fa); le.style.left = pct(fb);
      ls.textContent = ""; le.textContent = "";
    }
    function grade() {
      if (checked || us == null) return;
      checked = true;
      const a = Math.min(us, ue), b = Math.max(us, ue);
      const S = it.main.s, E = it.main.e;
      const tol = 0.35;
      const okS = Math.abs(a - S) <= tol, okE = Math.abs(b - E) <= tol;
      it.row.bars.forEach((bb) => {
        if (bb.k === "p" || bb.k === "k" || bb.e - bb.s < 0.02) return;
        const f1 = fracOf(chart, bb.s), f2 = fracOf(chart, bb.e);
        const main = bb.s === S && bb.e === E;
        pad.append(h("div", { class: "truth", style: `left: ${pct(f1)}; width: ${pct(f2 - f1)}; ${main ? "" : "opacity: .45; border-style: dashed"}` }));
      });
      const msg = `시작 ${okS ? "✓" : "✗"} (정답: ${describeAt(chart, S)}) · 끝 ${okE ? "✓" : "✗"} (정답: ${describeAt(chart, E)})`;
      finish(okS && okE, msg);
    }
  }

  // ── 결과 ──
  function renderResult(app) {
    const s = state.session;
    const rate = s.qs.length ? Math.round((s.right / s.qs.length) * 100) : 0;
    const ul = h("ul");
    s.wrong.forEach((q) => ul.append(h("li", {},
      h("b", {}, `[${q.it.law.title}] ${q.it.row.name}`), ` (${TYPES[q.type].label}) — `,
      h("span", { html: richText(q.it.text || q.it.row.text) }))));
    app.append(h("div", { class: "qwrap" }, h("div", { class: "card result" },
      h("div", { class: "kind" }, "결과"),
      h("div", { class: "big" }, `${s.right} / ${s.qs.length}`),
      h("div", { class: "muted" }, `정답률 ${rate}%`),
      s.wrong.length ? h("div", { style: "margin-top: 14px; font-weight: 700" }, "틀린 행") : h("div", { style: "margin-top: 14px" }, "모두 맞혔어요!"),
      s.wrong.length ? ul : null,
      h("div", { class: "actions", style: "justify-content: center" },
        s.wrong.length ? h("button", { class: "btn blue", onclick: () => {
          const again = s.wrong.map((q) => q);
          state.session = { qs: shuffle(again), i: 0, done: 0, right: 0, wrong: [], back: s.back };
          render();
        } }, "틀린 것만 다시") : null,
        h("button", { class: "btn", onclick: () => { state.session = null; if (s.back) state.mode = s.back; render(); } }, "처음으로")))));
  }

  // ───────────────────────── 렌더 ─────────────────────────
  function render() {
    renderTabs();
    const app = $("#app");
    app.replaceChildren();
    if (state.session) return renderSession(app);
    renderScore();
    if (state.mode === "notes") renderNotes(app);
    else renderStart(app);
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === "Enter" && e.target.tagName === "BUTTON") return;
    const card = $(".card");
    if (!card) return;
    const next = $(".actions .btn.primary", card);
    if (e.key === "Enter" && next) { e.preventDefault(); next.click(); return; }
    if (card._key) card._key(e);
  });
  $("#onlyWrong").addEventListener("change", (e) => { state.onlyWrong = e.target.checked; });
  $("#resetStats").addEventListener("click", () => {
    if (confirm("이 브라우저에 저장된 풀이 기록을 모두 지울까요?")) { STATS = {}; saveStats(); render(); }
  });

  render();
})();
