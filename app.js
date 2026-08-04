/* Тренажёр «Гипербола» (вход к уроку 3 темы «графики», компаньон печатной карточки g3).
   Формат: ОДНА КАРТОЧКА НА ЭКРАН, движение только вперёд.
   Данные: data.js (Методист, window.HW_DATA). Математику не менять — только интерфейс.

   Шасси (финал с цифрами, отчёт #38, прогресс, «Заново», время, пианино) — из эталона
   dz_graf_urok1/dz_graf_urok2. Механика темы — своя: живая гипербола (две ветви,
   разрыв, асимптоты-пунктир едут за центром) + жизненный график v = S/t. */

'use strict';

// ── УТИЛИТЫ ──────────────────────────────────────────────────────────────────

function makeFrac(n, d) {
  return `<span class="frac lk-mono"><span class="fn">${n}</span><span class="fd">${d}</span></span>`;
}
function fmtInline(text) {
  if (text == null) return '';
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, (_, s) => `<span class="lk-hl">${s}</span>`)
    .replace(/`([^`]+)`/g,     (_, s) => `<span class="lk-mono">${s}</span>`)
    // дробь: 120/t, k/x, 2/x, 3/(x − 2) → двухэтажная; кириллицу (км/ч) не трогаем
    .replace(/([−-]?(?:\d+|[a-zA-Z]))\/(\([^)]{1,16}\)|\d+|[a-zA-Z])/g,
      (_, n, d) => makeFrac(n, d.replace(/^\((.*)\)$/, '$1')));
}
function renderFeedback(fb) {
  const parts = Array.isArray(fb) ? fb : String(fb).split('\n');
  return parts.map(p => p.trim()).filter(Boolean)
    .map(p => `<p class="fb-p">${fmtInline(p)}</p>`).join('');
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function parseNum(s) {
  s = String(s).trim().replace(/\s/g, '').replace(/−/g, '-').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return parseFloat(s);
}
function fmtNum(v) { return String(v).replace('-', '−'); }
function fmtSliderVal(v) {
  const s = Math.round(v * 10) / 10;
  let str = Number.isInteger(s) ? String(s) : s.toFixed(1);
  return str.replace('.', ',').replace('-', '−');
}

// ── ПИАНИНО: приятный звук на каждый тап + резкий на ошибку ───────────────────
const Piano = (() => {
  let ctx = null, noteIdx = 0;
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51];
  function ensure() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function pluck(freq, dur, gain) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime;
    const master = c.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    master.connect(c.destination);
    [[freq, 'triangle', 1], [freq * 2, 'sine', 0.32]].forEach(([f, ty, g]) => {
      const o = c.createOscillator(), og = c.createGain();
      o.type = ty; o.frequency.setValueAtTime(f, t);
      og.gain.setValueAtTime(g, t);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    });
  }
  return {
    wake() { ensure(); },
    tap() {
      const f = SCALE[noteIdx % SCALE.length];
      noteIdx = (noteIdx + 1) % SCALE.length;
      pluck(f, 0.4, 0.12);
    },
    final() { SCALE.forEach((f, i) => setTimeout(() => pluck(f, 0.55, 0.13), i * 95)); }
  };
})();

function playSound(id) {
  const a = document.getElementById(id);
  if (!a) return;
  try { a.currentTime = 0; a.play().catch(() => {}); } catch (e) {}
}
// Разблокировка звука — в общем движке (hw-core.js): будит НА ЗАГЛУШЁННОМ звуке.
// Раньше будили обычным play() → на первом тапе играли все три мелодии разом.
function unlockAudio() { HwCore.unlockAudio(['snd-win', 'snd-lose', 'snd-final']); }
const TAP_SEL = 'button, .lk-opt, .sign-btn, .slbtn, [data-tap]';
document.addEventListener('pointerdown', e => {
  unlockAudio();
  const el = e.target.closest(TAP_SEL);
  if (!el || el.disabled || el.classList.contains('is-locked')) return;
  if (el.classList.contains('check-btn')) return;
  Piano.wake();
  Piano.tap();
}, true);

// ── БУМ-ЭФФЕКТ ────────────────────────────────────────────────────────────────
function lkFlash(el) { if (!el) return; el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on'); }
function boom(correct) {
  if (correct) { lkFlash(document.getElementById('lk-fx-ok')); playSound('snd-win'); }
  else         { lkFlash(document.getElementById('lk-fx-bad')); playSound('snd-lose'); }
}
function cardReact(card, correct) {
  card.classList.remove('lk-card-win', 'lk-card-shake'); void card.offsetWidth;
  card.classList.add(correct ? 'lk-card-win' : 'lk-card-shake');
}
function shake(btn) {
  btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
  btn.addEventListener('animationend', () => btn.classList.remove('shake'), { once: true });
}

// ═══════════ КООРДИНАТНАЯ ПЛОСКОСТЬ (SVG) ═══════════

const C_INK = '#eef0ff', C_MUTED = '#9aa0c8', C_STAR = '#D946EF', C_OK = '#34D399';
const C_LINE = '#6366F1', C_GHOST = '#cfc7ee', C_VERT = '#A855F7', MONO = "'JetBrains Mono',monospace";
const C_ASYM = 'rgba(255,255,255,.30)';
const DEF_WIN = { xmin: -8, xmax: 8, ymin: -8, ymax: 8 };
let SVGN = 0;

function mkView(win, padLeft) {
  const w = win || DEF_WIN;
  const xspan = w.xmax - w.xmin, yspan = w.ymax - w.ymin;
  const cell = Math.min(28, 300 / xspan);
  const pad = 18;
  const padL = padLeft || pad;                 // слева шире, если подписи оси длинные (120 км/ч)
  const plotW = xspan * cell, plotH = yspan * cell;
  const X = x => padL + (x - w.xmin) * cell;
  const Y = y => pad + (w.ymax - y) * cell;
  return { w, cell, pad, padL, xspan, yspan, plotW, plotH, W: plotW + padL + pad, H: plotH + 2 * pad, X, Y };
}

function svgDefs(id, v) {
  return `<defs>` +
    `<clipPath id="clip-${id}"><rect x="${v.padL}" y="${v.pad}" width="${v.plotW}" height="${v.plotH}" rx="10"/></clipPath>` +
    `<filter id="glow-${id}" x="-40%" y="-40%" width="180%" height="180%">` +
      `<feGaussianBlur stdDeviation="2.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>` +
    `</filter></defs>`;
}

function gridMarkup(v) {
  const { w, X, Y, pad, plotW, plotH } = v;
  let s = `<rect x="${pad}" y="${pad}" width="${plotW}" height="${plotH}" rx="10" fill="rgba(255,255,255,.028)" stroke="#2a2a4d" stroke-width="1"/>`;
  const grid = 'rgba(255,255,255,.075)';
  for (let i = Math.ceil(w.xmin); i <= Math.floor(w.xmax); i++) {
    if (i === 0) continue;
    const gx = X(i).toFixed(1);
    s += `<line x1="${gx}" y1="${pad}" x2="${gx}" y2="${pad + plotH}" stroke="${grid}" stroke-width="1"/>`;
  }
  for (let j = Math.ceil(w.ymin); j <= Math.floor(w.ymax); j++) {
    if (j === 0) continue;
    const gy = Y(j).toFixed(1);
    s += `<line x1="${pad}" y1="${gy}" x2="${pad + plotW}" y2="${gy}" stroke="${grid}" stroke-width="1"/>`;
  }
  const ax = X(0).toFixed(1), ay = Y(0).toFixed(1), axCol = 'rgba(255,255,255,.42)';
  s += `<line x1="${pad}" y1="${ay}" x2="${pad + plotW}" y2="${ay}" stroke="${axCol}" stroke-width="1.6"/>`;
  s += `<line x1="${ax}" y1="${pad}" x2="${ax}" y2="${pad + plotH}" stroke="${axCol}" stroke-width="1.6"/>`;
  s += `<path d="M${pad + plotW},${ay} l-7,-4 l0,8 z" fill="${axCol}"/>`;
  s += `<path d="M${ax},${pad} l-4,7 l8,0 z" fill="${axCol}"/>`;
  s += `<text x="${pad + plotW - 3}" y="${(+ay - 7).toFixed(1)}" fill="${C_MUTED}" font-size="12" font-family="${MONO}" text-anchor="end">x</text>`;
  s += `<text x="${(+ax + 8).toFixed(1)}" y="${pad + 12}" fill="${C_MUTED}" font-size="12" font-family="${MONO}">y</text>`;
  s += `<text x="${(+ax - 6).toFixed(1)}" y="${(+ay + 14).toFixed(1)}" fill="${C_MUTED}" font-size="11" font-family="${MONO}" text-anchor="end">O</text>`;
  const xStep = v.xspan > 13 ? 2 : 1, yStep = v.yspan > 13 ? 2 : 1;
  for (let i = Math.ceil(w.xmin); i <= Math.floor(w.xmax); i++) {
    if (i === 0 || i % xStep !== 0) continue;
    s += `<text x="${X(i).toFixed(1)}" y="${(+ay + 15).toFixed(1)}" fill="${C_MUTED}" font-size="9.5" font-family="${MONO}" text-anchor="middle" opacity=".65">${fmtNum(i)}</text>`;
  }
  for (let j = Math.ceil(w.ymin); j <= Math.floor(w.ymax); j++) {
    if (j === 0 || j % yStep !== 0) continue;
    s += `<text x="${(+ax - 7).toFixed(1)}" y="${(Y(j) + 3.5).toFixed(1)}" fill="${C_MUTED}" font-size="9.5" font-family="${MONO}" text-anchor="end" opacity=".65">${fmtNum(j)}</text>`;
  }
  return s;
}

function starPath(cx, cy, r) {
  let p = ''; const spikes = 5, inner = r * 0.44;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = (i % 2 === 0) ? r : inner;
    const ang = (Math.PI / spikes) * i - Math.PI / 2;
    p += (i === 0 ? 'M' : 'L') + (cx + Math.cos(ang) * rad).toFixed(1) + ',' + (cy + Math.sin(ang) * rad).toFixed(1);
  }
  return p + 'Z';
}

// ── ГИПЕРБОЛА: ДВЕ ГЛАДКИЕ ВЕТВИ, НИКОГДА не соединённые ──────────────────────
// y = k/(x−a) + b. Каждая ветвь — своя кривая на своей стороне от асимптоты x=a;
// через x=a перо не проводим (разрыв, ключевая ошибка темы). Выборка сгущается
// к асимптоте (шаг ~q²), у самой асимптоты кривая уходит за рамку — режет clipPath.
function hypPath(v, k, a, b) {
  const { w, X, Y } = v;
  const eps = 0.02, N = 150;
  const parts = [];
  function branch(near, far) {
    let d = '';
    for (let i = 0; i <= N; i++) {
      const q = i / N;
      const x = near + (far - near) * q * q;
      const y = clamp(k / (x - a) + b, w.ymin - 4, w.ymax + 4);
      d += (d ? 'L' : 'M') + X(x).toFixed(1) + ',' + Y(y).toFixed(1) + ' ';
    }
    parts.push(d.trim());
  }
  if (a - eps > w.xmin) branch(a - eps, w.xmin);
  if (a + eps < w.xmax) branch(a + eps, w.xmax);
  return parts.join(' ');
}

// Статичный график гипербол (+ отмеченные точки с пунктиром к осям).
function buildHypGraph(opts) {
  const v = mkView(opts.win);
  const id = ++SVGN;
  let inner = svgDefs(id, v) + gridMarkup(v);
  inner += `<g clip-path="url(#clip-${id})">`;
  (opts.hyps || []).forEach(h => {
    inner += `<path d="${hypPath(v, h.k, h.a || 0, h.b || 0)}" fill="none" stroke="${h.color || C_LINE}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow-${id})"/>`;
  });
  inner += `</g>`;
  (opts.points || []).forEach(p => {
    const cx = v.X(p.x), cy = v.Y(p.y);
    inner += `<path d="M${cx},${v.Y(0)} L${cx},${cy}" stroke="rgba(168,85,247,.4)" stroke-width="1.2" stroke-dasharray="3 3"/>`;
    inner += `<path d="M${v.X(0)},${cy} L${cx},${cy}" stroke="rgba(168,85,247,.4)" stroke-width="1.2" stroke-dasharray="3 3"/>`;
    inner += `<circle cx="${cx}" cy="${cy}" r="6" fill="#A855F7" stroke="#fff" stroke-width="1.5" filter="url(#glow-${id})"/>`;
    if (p.label) {
      const tx = p.x >= 0 ? cx + 9 : cx - 9, anchor = p.x >= 0 ? 'start' : 'end';
      const ty = p.y >= 0 ? cy - 10 : cy + 18;
      inner += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" fill="${C_INK}" font-size="12" font-family="${MONO}" text-anchor="${anchor}">${p.label}</text>`;
    }
  });
  return `<div class="graph-wrap"><svg class="graph-svg" viewBox="0 0 ${v.W.toFixed(0)} ${v.H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="координатная плоскость с гиперболой">${inner}</svg></div>`;
}

// ═══════════ ДВИЖОК ЖИВОЙ ГИПЕРБОЛЫ (ползунки, профили k / kab) ═══════════
// profile 'hyp_k': одна ручка k, y = k/x. profile 'hyp_kab': k, a, b — переезд центра.
// Многораундовый: ловим призрак (и паркуем центр на звезду). onWin() — на последнем.

function createHypEngine(host, cfg, onWin) {
  const id = ++SVGN;
  const v = mkView(cfg.win || DEF_WIN);
  const prof = cfg.profile;                       // 'hyp_k' | 'hyp_kab'
  const targets = cfg.rounds;
  let roundIdx = 0, won = false, advancing = false, lastMoved = 'k';

  const st = prof === 'hyp_k' ? { k: 1, a: 0, b: 0 } : { k: 1, a: 0, b: 0 };

  const svg =
    `<svg class="graph-svg" viewBox="0 0 ${v.W.toFixed(0)} ${v.H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="живая гипербола">` +
      svgDefs(id, v) + gridMarkup(v) +
      `<g clip-path="url(#clip-${id})">` +
        `<g id="ge-asym-${id}"></g>` +
        `<path id="ge-ghost-${id}" d="M0,0" fill="none" stroke="${C_GHOST}" stroke-width="2.4" stroke-dasharray="6 6" stroke-linecap="round" stroke-linejoin="round" opacity=".4"/>` +
        `<path id="ge-hyp-${id}" d="M0,0" fill="none" stroke="${C_LINE}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow-${id})"/>` +
      `</g>` +
      `<g id="ge-mark-${id}"></g>` +
    `</svg>`;

  host.innerHTML =
    `<div class="ge">` +
      `<div class="ge-formula" id="ge-formula-${id}"></div>` +
      `<div class="graph-wrap">${svg}</div>` +
      `<div class="ge-hint" id="ge-hint-${id}"></div>` +
      `<div class="ge-sliders" id="ge-sliders-${id}"></div>` +
    `</div>`;

  const hypEl    = host.querySelector(`#ge-hyp-${id}`);
  const ghostEl  = host.querySelector(`#ge-ghost-${id}`);
  const asymG    = host.querySelector(`#ge-asym-${id}`);
  const markG    = host.querySelector(`#ge-mark-${id}`);
  const formulaEl= host.querySelector(`#ge-formula-${id}`);
  const roundEl  = document.getElementById('task-round');
  const hintEl   = host.querySelector(`#ge-hint-${id}`);
  const sliders  = host.querySelector(`#ge-sliders-${id}`);

  // ── живая формула (двухэтажная дробь, движимая ручка подсвечена) ──
  function hl(key, txt) { return `<span class="${lastMoved === key ? 'lk-hl' : ''}">${txt}</span>`; }
  function formula() {
    if (prof === 'hyp_k') return `y = ${makeFrac(hl('k', fmtNum(st.k)), 'x')}`;
    const den = st.a === 0 ? 'x'
              : st.a > 0   ? `x − ${hl('a', st.a)}`
              :              `x + ${hl('a', Math.abs(st.a))}`;
    let bPart = '';
    if (st.b > 0) bPart = ` + ${hl('b', st.b)}`;
    else if (st.b < 0) bPart = ` − ${hl('b', Math.abs(st.b))}`;
    return `y = ${makeFrac(hl('k', fmtNum(st.k)), den)}${bPart}`;
  }

  function setGhost() {
    const t = targets[roundIdx];
    ghostEl.setAttribute('d', hypPath(v, t.k, t.a || 0, t.b || 0));
  }
  function drawAsym() {
    if (prof !== 'hyp_kab') { asymG.innerHTML = ''; return; }
    const xa = v.X(st.a).toFixed(1), yb = v.Y(st.b).toFixed(1);
    asymG.innerHTML =
      `<line x1="${xa}" y1="${v.pad}" x2="${xa}" y2="${v.pad + v.plotH}" stroke="${C_ASYM}" stroke-width="1.4" stroke-dasharray="5 5"/>` +
      `<line x1="${v.pad}" y1="${yb}" x2="${v.pad + v.plotW}" y2="${yb}" stroke="${C_ASYM}" stroke-width="1.4" stroke-dasharray="5 5"/>`;
  }
  function drawMarks() {
    let m = '';
    if (prof === 'hyp_kab') {
      const t = targets[roundIdx];
      const parked = st.a === (t.a || 0) && st.b === (t.b || 0);
      m += `<path d="${starPath(v.X(t.a || 0), v.Y(t.b || 0), 10)}" fill="${parked ? C_OK : C_STAR}" stroke="#0A0610" stroke-width="1" filter="url(#glow-${id})"/>`;
      m += `<circle cx="${v.X(st.a).toFixed(1)}" cy="${v.Y(st.b).toFixed(1)}" r="5" fill="${C_VERT}" stroke="#fff" stroke-width="1.5" filter="url(#glow-${id})"/>`;
    }
    markG.innerHTML = m;
  }

  function hit() {
    const t = targets[roundIdx];
    if (prof === 'hyp_k') return st.k === t.k;
    return st.k === t.k && st.a === (t.a || 0) && st.b === (t.b || 0);
  }

  function redraw() {
    hypEl.setAttribute('d', st.k === 0 && prof === 'hyp_k' ? '' : hypPath(v, st.k, st.a, st.b));
    formulaEl.innerHTML = '<span class="ge-fx">' + formula() + '</span>';
    drawAsym();
    drawMarks();
    if (prof === 'hyp_k' && cfg.easter && st.k === 0 && !won) {
      hintEl.className = 'ge-hint'; hintEl.innerHTML = fmtInline(cfg.easter);
    }
    maybeWin();
  }

  function maybeWin() {
    if (won || advancing || !hit()) return;
    boom(true);
    if (roundIdx < targets.length - 1) {
      advancing = true;
      hintEl.className = 'ge-hint win'; hintEl.textContent = 'Есть! ✨ Следующий призрак…';
      setTimeout(() => { advancing = false; roundIdx++; loadRound(); redraw(); }, 850);
    } else {
      won = true;
      hintEl.className = 'ge-hint win'; hintEl.textContent = 'Есть! Гипербола поймана ✨';
      onWin();
    }
  }

  function loadRound() {
    setGhost();
    if (roundEl) roundEl.textContent = `раунд ${roundIdx + 1}/${targets.length}`;
    hintEl.className = 'ge-hint';
    hintEl.innerHTML = fmtInline(targets[roundIdx].note || 'Наведи свою гиперболу на призрак.');
  }

  function sliderRow(key, name, min, max) {
    return `<div class="slrow" data-key="${key}">` +
      `<span class="sl-name">${name}</span>` +
      `<button class="slbtn" data-act="dec" aria-label="меньше">−</button>` +
      `<input type="range" class="sl" min="${min}" max="${max}" step="1" value="${st[key]}">` +
      `<button class="slbtn" data-act="inc" aria-label="больше">+</button>` +
      `<span class="slval">${fmtSliderVal(st[key])}</span>` +
    `</div>`;
  }
  const mono = t => `<span class="lk-mono">${t}</span>`;
  let slHTML = sliderRow('k', `Размах ${mono('k')}`, prof === 'hyp_k' ? -6 : -4, prof === 'hyp_k' ? 6 : 4);
  if (prof === 'hyp_kab') {
    slHTML += sliderRow('a', `↔️ Вбок ${mono('a')}`, -5, 5);
    slHTML += sliderRow('b', `🛗 Вверх ${mono('b')}`, -5, 5);
  }
  sliders.innerHTML = slHTML;

  sliders.querySelectorAll('.slrow').forEach(row => {
    const key = row.dataset.key;
    const range = row.querySelector('input[type=range]');
    const valEl = row.querySelector('.slval');
    function sync() { st[key] = +range.value; lastMoved = key; valEl.textContent = fmtSliderVal(+range.value); redraw(); }
    range.addEventListener('input', sync);
    row.querySelectorAll('.slbtn').forEach(btn => btn.addEventListener('click', () => {
      const dir = btn.dataset.act === 'inc' ? 1 : -1;
      range.value = clamp(+range.value + dir, +range.min, +range.max);
      sync();
    }));
  });

  loadRound();
  redraw();
}

// ═══════════ ДВИЖОК «ИЗ ЖИЗНИ»: v = S/t (точка едет по ветви) ═══════════
// Оси t (ч) × v (км/ч), только первая четверть — живая гипербола из жизни.
// Ползунок t двигает точку по кривой; цель — пунктирная линия нужной скорости.

function createLifeEngine(host, cfg, onWin) {
  const id = ++SVGN;
  const S = cfg.dist;                                  // путь, км
  const ySc = 20;                                      // 1 клетка по v = 20 км/ч
  const v = mkView({ xmin: 0, xmax: 9, ymin: 0, ymax: 7 }, 36);  // слева место под «120»
  const targets = cfg.rounds;
  let roundIdx = 0, won = false, advancing = false;
  const st = { t: 1 };

  // сетка своя: по y подписи в км/ч (клетка = 20), по x — часы
  function lifeGrid() {
    const { w, X, Y, pad, padL, plotW, plotH } = v;
    let s = `<rect x="${padL}" y="${pad}" width="${plotW}" height="${plotH}" rx="10" fill="rgba(255,255,255,.028)" stroke="#2a2a4d" stroke-width="1"/>`;
    const grid = 'rgba(255,255,255,.075)';
    for (let i = 1; i <= w.xmax; i++) {
      const gx = X(i).toFixed(1);
      s += `<line x1="${gx}" y1="${pad}" x2="${gx}" y2="${pad + plotH}" stroke="${grid}" stroke-width="1"/>`;
    }
    for (let j = 1; j <= w.ymax; j++) {
      const gy = Y(j).toFixed(1);
      s += `<line x1="${padL}" y1="${gy}" x2="${padL + plotW}" y2="${gy}" stroke="${grid}" stroke-width="1"/>`;
    }
    const ax = X(0).toFixed(1), ay = Y(0).toFixed(1), axCol = 'rgba(255,255,255,.42)';
    s += `<line x1="${padL}" y1="${ay}" x2="${padL + plotW}" y2="${ay}" stroke="${axCol}" stroke-width="1.6"/>`;
    s += `<line x1="${ax}" y1="${pad}" x2="${ax}" y2="${pad + plotH}" stroke="${axCol}" stroke-width="1.6"/>`;
    s += `<path d="M${padL + plotW},${ay} l-7,-4 l0,8 z" fill="${axCol}"/>`;
    s += `<path d="M${ax},${pad} l-4,7 l8,0 z" fill="${axCol}"/>`;
    s += `<text x="${padL + plotW - 2}" y="${(+ay + 15).toFixed(1)}" fill="${C_MUTED}" font-size="11" font-family="${MONO}" text-anchor="end">t, ч</text>`;
    s += `<text x="${(+ax + 8).toFixed(1)}" y="${pad + 12}" fill="${C_MUTED}" font-size="11" font-family="${MONO}">v, км/ч</text>`;
    for (let i = 1; i <= w.xmax - 2; i++) {   // последний тик не печатаем — там подпись оси «t, ч»
      s += `<text x="${X(i).toFixed(1)}" y="${(+ay + 15).toFixed(1)}" fill="${C_MUTED}" font-size="9.5" font-family="${MONO}" text-anchor="middle" opacity=".65">${i}</text>`;
    }
    for (let j = 1; j <= w.ymax - 1; j++) {
      s += `<text x="${(+ax - 5).toFixed(1)}" y="${(Y(j) + 3.5).toFixed(1)}" fill="${C_MUTED}" font-size="9.5" font-family="${MONO}" text-anchor="end" opacity=".65">${j * ySc}</text>`;
    }
    return s;
  }

  // кривая v = S/t в масштабе клеток (y = S/(t·ySc)), от края окна до t=9
  function curveD() {
    const t0 = S / ((v.w.ymax + 1) * ySc), N = 140;
    let d = '';
    for (let i = 0; i <= N; i++) {
      const q = i / N;
      const t = t0 + (v.w.xmax - t0) * q * q;
      const y = clamp(S / t / ySc, 0, v.w.ymax + 2);
      d += (d ? 'L' : 'M') + v.X(t).toFixed(1) + ',' + v.Y(y).toFixed(1) + ' ';
    }
    return d.trim();
  }

  const svg =
    `<svg class="graph-svg" viewBox="0 0 ${v.W.toFixed(0)} ${v.H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="график скорости против времени">` +
      svgDefs(id, v) + lifeGrid() +
      `<g clip-path="url(#clip-${id})">` +
        `<line id="lf-target-${id}" x1="${v.padL}" y1="0" x2="${v.padL + v.plotW}" y2="0" stroke="${C_STAR}" stroke-width="1.6" stroke-dasharray="6 5"/>` +
        `<path d="${curveD()}" fill="none" stroke="${C_LINE}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow-${id})"/>` +
        `<g id="lf-guides-${id}"></g>` +
      `</g>` +
      `<g id="lf-pt-${id}"></g>` +
    `</svg>`;

  host.innerHTML =
    `<div class="ge">` +
      `<div class="ge-formula" id="ge-formula-${id}"></div>` +
      `<div class="graph-wrap">${svg}</div>` +
      `<div class="ge-hint" id="ge-hint-${id}"></div>` +
      `<div class="ge-sliders">` +
        `<div class="slrow" data-key="t">` +
          `<span class="sl-name">⏱ Время <span class="lk-mono">t</span></span>` +
          `<button class="slbtn" data-act="dec" aria-label="меньше">−</button>` +
          `<input type="range" class="sl" min="0" max="8" step="1" value="${st.t}">` +
          `<button class="slbtn" data-act="inc" aria-label="больше">+</button>` +
          `<span class="slval">${st.t} ч</span>` +
        `</div>` +
      `</div>` +
    `</div>`;

  const formulaEl = host.querySelector(`#ge-formula-${id}`);
  const hintEl    = host.querySelector(`#ge-hint-${id}`);
  const guidesG   = host.querySelector(`#lf-guides-${id}`);
  const ptG       = host.querySelector(`#lf-pt-${id}`);
  const targetLn  = host.querySelector(`#lf-target-${id}`);
  const roundEl   = document.getElementById('task-round');
  const range     = host.querySelector('input[type=range]');
  const valEl     = host.querySelector('.slval');

  function fmtV(val) {
    const r = Math.round(val * 10) / 10;
    return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ',');
  }

  function redraw() {
    const t = st.t;
    if (t === 0) {
      formulaEl.innerHTML = `<span class="ge-fx">v = ${makeFrac(S, '<span class="lk-hl">0</span>')} = 🚫</span>`;
      guidesG.innerHTML = ''; ptG.innerHTML = '';
      if (!won) { hintEl.className = 'ge-hint'; hintEl.innerHTML = fmtInline(cfg.easter); }
      return;
    }
    const vv = S / t, yy = vv / ySc;
    formulaEl.innerHTML = `<span class="ge-fx">v = ${makeFrac(S, `<span class="lk-hl">${t}</span>`)} = ${fmtV(vv)} км/ч</span>`;
    if (yy <= v.w.ymax + 0.5) {
      const cx = v.X(t), cy = v.Y(yy);
      guidesG.innerHTML =
        `<path d="M${cx},${v.Y(0)} L${cx},${cy}" stroke="rgba(168,85,247,.45)" stroke-width="1.2" stroke-dasharray="3 3"/>` +
        `<path d="M${v.X(0)},${cy} L${cx},${cy}" stroke="rgba(168,85,247,.45)" stroke-width="1.2" stroke-dasharray="3 3"/>`;
      ptG.innerHTML = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="#A855F7" stroke="#fff" stroke-width="1.8" filter="url(#glow-${id})"/>`;
    } else { guidesG.innerHTML = ''; ptG.innerHTML = ''; }
    maybeWin();
  }

  function hit() { return st.t === targets[roundIdx].t; }
  function maybeWin() {
    if (won || advancing || !hit()) return;
    boom(true);
    targetLn.setAttribute('stroke', C_OK);
    if (roundIdx < targets.length - 1) {
      advancing = true;
      hintEl.className = 'ge-hint win'; hintEl.textContent = 'Точно! ✨ Следующая цель…';
      setTimeout(() => { advancing = false; roundIdx++; loadRound(); redraw(); }, 850);
    } else {
      won = true;
      hintEl.className = 'ge-hint win'; hintEl.textContent = 'Приехали! ✨';
      onWin();
    }
  }
  function loadRound() {
    const t = targets[roundIdx];
    targetLn.setAttribute('stroke', C_STAR);
    const yl = v.Y(t.v / ySc).toFixed(1);
    targetLn.setAttribute('y1', yl); targetLn.setAttribute('y2', yl);
    if (roundEl) roundEl.textContent = `раунд ${roundIdx + 1}/${targets.length}`;
    hintEl.className = 'ge-hint';
    hintEl.innerHTML = fmtInline(t.note || '');
  }

  function sync() { st.t = +range.value; valEl.textContent = `${st.t} ч`; redraw(); }
  range.addEventListener('input', sync);
  host.querySelectorAll('.slbtn').forEach(btn => btn.addEventListener('click', () => {
    const dir = btn.dataset.act === 'inc' ? 1 : -1;
    range.value = clamp(+range.value + dir, +range.min, +range.max);
    sync();
  }));

  loadRound();
  redraw();
}

// ═══════════ МЕХАНИКА — ПРОЧИТАЙ ГИПЕРБОЛУ (знак + k) ═══════════

function buildReadHyp(task) {
  return task.items.map((it, i) => `
    <div class="rl-item" id="rh-${task.id}-${i}">
      ${buildHypGraph({ win: it.win, hyps: [{ k: it.k }], points: [{ x: it.px, y: it.py, label: `(${fmtNum(it.px)}; ${fmtNum(it.py)})` }] })}
      <div class="rl-controls">
        <div class="rl-grp">
          <span class="rl-grp-lbl">знак:</span>
          <button class="sign-btn" data-i="${i}" data-s="pos"><span class="lk-mono">k &gt; 0</span></button>
          <button class="sign-btn" data-i="${i}" data-s="neg"><span class="lk-mono">k &lt; 0</span></button>
        </div>
        <div class="rl-grp">
          <span class="rl-grp-lbl"><span class="lk-mono">k</span> =</span>
          <input class="num-field" type="text" inputmode="text" autocomplete="off" id="rh-k-${task.id}-${i}" placeholder="?">
        </div>
      </div>
    </div>`).join('');
}
function initReadHyp(task, card) {
  const sign = {};
  card.querySelectorAll('.sign-btn').forEach(btn => btn.addEventListener('click', () => {
    if (btn.disabled) return;
    const i = btn.dataset.i; sign[i] = btn.dataset.s;
    card.querySelectorAll(`.sign-btn[data-i="${i}"]`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }));
  return { check() {
    for (let i = 0; i < task.items.length; i++) {
      if (sign[i] === undefined) return { ok: false };
      if (parseNum(card.querySelector(`#rh-k-${task.id}-${i}`).value) === null) return { ok: false };
    }
    let allC = true; const wrong = [];
    task.items.forEach((it, i) => {
      const kVal = parseNum(card.querySelector(`#rh-k-${task.id}-${i}`).value);
      const ansSign = it.k > 0 ? 'pos' : 'neg';
      const ok = sign[i] === ansSign && kVal === it.k;
      if (!ok) { allC = false; wrong.push(`график ${i + 1}: \`k = ${fmtNum(it.px)}·${it.py < 0 ? '(' + fmtNum(it.py) + ')' : fmtNum(it.py)} = ${fmtNum(it.k)}\``); }
      card.querySelector(`#rh-${task.id}-${i}`).classList.add(ok ? 'is-correct' : 'is-wrong');
      card.querySelectorAll(`.sign-btn[data-i="${i}"]`).forEach(b => {
        b.classList.remove('selected');
        if (b.dataset.s === ansSign) b.classList.add('is-correct');
        else if (b.dataset.s === sign[i]) b.classList.add('is-wrong');
        b.disabled = true;
      });
      card.querySelector(`#rh-k-${task.id}-${i}`).disabled = true;
    });
    return { ok: true, correct: allC, wrong };
  }};
}

// ═══════════ МЕХАНИКА — ЦЕНТР И АСИМПТОТЫ СДВИНУТОЙ ═══════════

function buildHypCenter(task) {
  const f = task.fn;
  return buildHypGraph({ win: task.win, hyps: [{ k: f.k, a: f.a, b: f.b }] }) + `
    <div class="coord-row" id="hc-c-${task.id}" style="gap:10px">
      <span class="rl-grp-lbl" style="font-size:14px">центр:</span>
      <span class="paren">(</span>
      <input class="num-field" type="text" inputmode="text" autocomplete="off" id="hc-x-${task.id}" placeholder="x">
      <span class="semi">;</span>
      <input class="num-field" type="text" inputmode="text" autocomplete="off" id="hc-y-${task.id}" placeholder="y">
      <span class="paren">)</span>
    </div>
    <div class="coord-row" id="hc-a-${task.id}" style="gap:10px 16px;font-size:20px">
      <span class="rl-grp-lbl" style="font-size:14px">асимптоты:</span>
      <span style="display:inline-flex;align-items:center;gap:8px;white-space:nowrap"><span class="lk-mono">x =</span><input class="num-field" type="text" inputmode="text" autocomplete="off" id="hc-ax-${task.id}" placeholder="?"></span>
      <span style="display:inline-flex;align-items:center;gap:8px;white-space:nowrap"><span class="lk-mono">y =</span><input class="num-field" type="text" inputmode="text" autocomplete="off" id="hc-ay-${task.id}" placeholder="?"></span>
    </div>`;
}
function checkHypCenter(task, card) {
  const g = id => parseNum(card.querySelector(`#${id}-${task.id}`).value);
  const cx = g('hc-x'), cy = g('hc-y'), ax = g('hc-ax'), ay = g('hc-ay');
  if (cx === null || cy === null || ax === null || ay === null) return { ok: false };
  const f = task.fn;
  const cOk = cx === f.a && cy === f.b, aOk = ax === f.a && ay === f.b;
  const wrong = [];
  if (!cOk) wrong.push(`центр: **(${fmtNum(f.a)}; ${fmtNum(f.b)})**`);
  if (!aOk) wrong.push(`асимптоты: **x = ${fmtNum(f.a)}**, **y = ${fmtNum(f.b)}**`);
  card.querySelector(`#hc-c-${task.id}`).classList.add(cOk ? 'is-correct' : 'is-wrong');
  card.querySelector(`#hc-a-${task.id}`).classList.add(aOk ? 'is-correct' : 'is-wrong');
  ['hc-x', 'hc-y', 'hc-ax', 'hc-ay'].forEach(id => { card.querySelector(`#${id}-${task.id}`).disabled = true; });
  return { ok: true, correct: cOk && aOk, wrong };
}

// ── РОУТЕРЫ ──────────────────────────────────────────────────────────────────

function buildBody(task) {
  switch (task.mechanic) {
    case 'read_hyp':   return buildReadHyp(task);
    case 'hyp_center': return buildHypCenter(task);
    default: return '';
  }
}
function initMechanic(task, card) {
  switch (task.mechanic) {
    case 'read_hyp':   return initReadHyp(task, card);
    case 'hyp_center': return { check: () => checkHypCenter(task, card) };
    default: return { check: () => ({ ok: true, correct: true, wrong: [] }) };
  }
}

// ── СОСТОЯНИЕ + СОХРАНЕНИЕ ────────────────────────────────────────────────────

let DATA = null;
let idx = 0, combo = 0, firstTryCount = 0, finished = false, reported = false;
let devMode = false, allowSend = false;
let startTs = null, startPerf = null;
const results = [];

function localIso(d) {
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function fmtDur(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m} мин ${s} с` : `${s} с`;
}

const HW_ID = 'trenazher_giperbola';
function progKey() {
  const u = (new URLSearchParams(location.search).get('u') || '').slice(0, 40);
  return `hwprog:${HW_ID}:${u}`;
}
function saveProgress() {
  if (devMode) return;
  try { localStorage.setItem(progKey(), JSON.stringify({ v: 1, results, firstTryCount, combo, finished, reported })); }
  catch (e) {}
}
function loadProgress() { try { return JSON.parse(localStorage.getItem(progKey()) || 'null'); } catch (e) { return null; } }
function clearProgress() { try { localStorage.removeItem(progKey()); } catch (e) {} }

function recordResult(task, correct, wrong, res) {
  // Снимок задания для разбора (стандарт: условие → ответ ученика → правильный → разбор).
  // pick/answer отдают сами механики; если механика их не отдала — в разборе покажутся
  // строки wrong[] («ты: 5 · верно: 7»), пусто не будет.
  results[idx] = {
    label: task.label, diff: task.difficulty, correct, wrong: wrong || [], feedback: task.feedback,
    cond: task.intro || task.cond || '',
    image: task.image || '',
    snap: HwCore.snap(document.getElementById(`body-${task.id}`)),
    pick: res && res.pick !== undefined ? res.pick : undefined,
    answer: res && res.answer !== undefined ? res.answer : undefined,
  };
  if (correct) { firstTryCount++; combo++; } else combo = 0;
  updateCombo();
  document.getElementById('prog-fill').style.width = `${((idx + 1) / DATA.tasks.length) * 100}%`;
  saveProgress();
}
function updateCombo() {
  const el = document.getElementById('combo');
  if (combo >= 2) { el.textContent = `🔥 ${combo} подряд!`; el.classList.add('show'); }
  else el.classList.remove('show');
}

// ── «ЗАНОВО» ──────────────────────────────────────────────────────────────────

function doReset() {
  clearProgress();
  const p = new URLSearchParams(location.search);
  p.set('reset', '1');
  location.href = location.pathname + '?' + p.toString();
}
function resetStripHtml() {
  return `<div class="reset-strip"><button class="reset-btn" type="button" data-reset>Заново</button></div>`;
}
function wireReset(root) {
  const b = root.querySelector('[data-reset]');
  if (b) b.addEventListener('click', showResetConfirm);
}
function showResetConfirm() {
  const ov = document.getElementById('reset-overlay');
  if (ov) ov.classList.add('show');
}
function hideResetConfirm() {
  const ov = document.getElementById('reset-overlay');
  if (ov) ov.classList.remove('show');
}

// ── РЕНДЕР КАРТОЧКИ ───────────────────────────────────────────────────────────

function render() {
  if (idx >= DATA.tasks.length) return showFinal();
  if (!startTs) { startTs = new Date(); startPerf = performance.now(); }
  const task = DATA.tasks[idx];
  const screen = document.getElementById('screen');
  document.getElementById('prog-label').textContent = `${idx + 1} из ${DATA.tasks.length}`;
  document.getElementById('prog-fill').style.width = `${(idx / DATA.tasks.length) * 100}%`;

  const isLast = idx === DATA.tasks.length - 1;
  const isSlider = task.mechanic.indexOf('slider_') === 0;
  const hasHint = !!(task.hint && String(task.hint).trim());
  const num = idx + 1;
  const subtitle = String(task.label || '');

  screen.innerHTML = `
    <div class="task-card lk-card lk-screen" id="card-${task.id}">
      <div class="task-head">
        <div class="task-label-wrap">
          <span class="lk-tasknum">${num}</span>
          ${subtitle ? `<span class="task-label">${subtitle}</span>` : ''}
          <span class="task-diff">${task.difficulty || ''}</span>
          ${isSlider ? `<span class="task-round" id="task-round"></span>` : ''}
        </div>
        ${hasHint ? `<button class="lk-hint-btn lk-hint-btn--alive" id="hint-btn-${task.id}" type="button" aria-expanded="false" aria-controls="hint-${task.id}" aria-label="Подсказка от Леммы">Λ</button>` : ''}
      </div>
      ${hasHint ? `<div class="lk-hint-panel" id="hint-${task.id}"><div class="lk-hint-inner"><div class="lk-hint-body"><span class="lk-hint-tag">Λ Подсказка</span>${fmtInline(task.hint)}</div></div></div>` : ''}
      <p class="task-intro">${fmtInline(task.intro).replace(/\n/g, '<br>')}</p>
      <div class="task-body" id="body-${task.id}"></div>
      <div class="task-feedback" id="fb-${task.id}"><div class="fb-label">Разбор</div>${renderFeedback(task.feedback)}</div>
      ${isSlider ? '' : `<button class="lk-btn check-btn" id="btn-${task.id}">Проверить</button>`}
      <button class="lk-btn next-btn" id="next-${task.id}" hidden>${isLast ? 'К итогам ✨' : 'Дальше →'}</button>
    </div>
    ${resetStripHtml()}`;
  window.scrollTo(0, 0);
  wireReset(screen);

  const card = document.getElementById(`card-${task.id}`);
  const body = document.getElementById(`body-${task.id}`);
  const nextBtn = document.getElementById(`next-${task.id}`);

  const hintBtn = document.getElementById(`hint-btn-${task.id}`);
  if (hintBtn) {
    const panel = document.getElementById(`hint-${task.id}`);
    hintBtn.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      hintBtn.classList.toggle('is-open', open);
      hintBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  nextBtn.addEventListener('click', () => { idx++; render(); });

  if (isSlider) { renderSlider(task, body, card, nextBtn); return; }

  body.innerHTML = buildBody(task);
  const checker = initMechanic(task, card);
  const checkBtn = document.getElementById(`btn-${task.id}`);
  checkBtn.addEventListener('click', () => {
    const res = checker.check();
    if (!res || !res.ok) { shake(checkBtn); return; }
    boom(res.correct);
    cardReact(card, res.correct);
    document.getElementById(`fb-${task.id}`).classList.add('show');
    checkBtn.disabled = true; checkBtn.hidden = true; nextBtn.hidden = false;
    recordResult(task, res.correct, res.wrong, res);
  });
}

function renderSlider(task, body, card, nextBtn) {
  const profile = task.mechanic.replace('slider_', '');
  const done = { v: false };
  const onWin = () => {
    if (done.v) return; done.v = true;
    cardReact(card, true);
    document.getElementById(`fb-${task.id}`).classList.add('show');
    nextBtn.hidden = false;
    recordResult(task, true, []);
  };
  if (profile === 'life') {
    createLifeEngine(body, { dist: task.dist, rounds: task.rounds, easter: task.easter }, onWin);
  } else {
    createHypEngine(body, { profile, rounds: task.rounds, easter: task.easter, win: task.win }, onWin);
  }
}

// ── ОТЧЁТ И РАЗБОР (#38) ──────────────────────────────────────────────────────
// Механика общая для всех домашек — движок по URL (di-brand-kit/hw-core.js).
// Здесь остаётся только то, что у этой домашки своё: как рисовать её математику.

const REV_HELPERS = { fmtInline, renderFeedback };

function reportResults(score, total) {
  if (reported) return;
  const hw = `${DATA.meta.kicker} — ${DATA.meta.title}`;
  const durationSec = startPerf != null ? Math.round((performance.now() - startPerf) / 1000) : null;
  const sent = HwCore.report({
    hw, hw_id: HW_ID, score, total, results,
    startedAt: startTs ? localIso(startTs) : null,
    durationSec, devMode, allowSend,
  });
  if (sent) { reported = true; saveProgress(); }
}

function revItemsHtml(items) { return HwCore.revItemsHtml(items, REV_HELPERS); }
function bindRevToggles(root) { HwCore.bindToggles(root); }

// ── ЭКРАН ИТОГОВ ──────────────────────────────────────────────────────────────

function showFinal() {
  document.getElementById('screen').hidden = true;
  document.getElementById('hw-header').hidden = true;
  playSound('snd-final');

  const total = DATA.tasks.length;
  finished = true;
  reportResults(firstTryCount, total);
  saveProgress();
  const tier = firstTryCount === total ? '🏆 Идеально — ни одной осечки!'
             : firstTryCount >= total - 1 ? '💪 Крепко держишь гиперболу!'
             : '🔁 Загляни в разборы — и прокрути ещё разок.';

  const revHtml = revItemsHtml(results);

  const f = DATA.final;
  const pct = total ? Math.round(firstTryCount / total * 100) : 0;
  const durSec = startPerf != null ? Math.round((performance.now() - startPerf) / 1000) : null;
  const durTxt = fmtDur(durSec);
  const statsHtml = `
    <div class="fin-stats" style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 4px">
      <div class="fin-stat" style="flex:1;min-width:88px;text-align:center;padding:12px 8px;border-radius:14px;background:rgba(124,108,240,.12);border:1px solid rgba(124,108,240,.28)">
        <div style="font-size:26px;font-weight:700;line-height:1">${firstTryCount}<span style="font-size:15px;opacity:.6">/${total}</span></div>
        <div style="font-size:11px;opacity:.7;margin-top:3px">с первого раза</div>
      </div>
      <div class="fin-stat" style="flex:1;min-width:88px;text-align:center;padding:12px 8px;border-radius:14px;background:rgba(79,169,255,.12);border:1px solid rgba(79,169,255,.28)">
        <div style="font-size:26px;font-weight:700;line-height:1">${pct}<span style="font-size:15px;opacity:.6">%</span></div>
        <div style="font-size:11px;opacity:.7;margin-top:3px">точность</div>
      </div>
      ${durTxt ? `<div class="fin-stat" style="flex:1;min-width:88px;text-align:center;padding:12px 8px;border-radius:14px;background:rgba(91,191,138,.12);border:1px solid rgba(91,191,138,.28)">
        <div style="font-size:20px;font-weight:700;line-height:1.2">${durTxt}</div>
        <div style="font-size:11px;opacity:.7;margin-top:3px">время</div>
      </div>` : ''}
    </div>`;
  const el = document.getElementById('final-screen');
  el.innerHTML = `
    <div class="lk-card" style="padding:22px 18px">
      <div class="fin-theme">${f.theme}</div>
      <div class="fin-tier">${tier}</div>
      ${statsHtml}
      ${revHtml}
    </div>
    <div class="lk-card fin-card">
      <div class="fin-unlock">${f.unlock}</div>
      <p class="fin-tease">${fmtInline(f.tease)}</p>
      <p class="fin-counter"><b>${firstTryCount}</b> ${f.counter_label} из ${total}</p>
    </div>
    ${reported
      ? `<p class="send-note" style="text-align:center">✅ Результат уже отправлен репетитору — он увидит, что освоено, а что подтянуть.</p>`
      : ''}
    <button id="btn-retry" class="lk-btn" style="width:100%;margin-top:16px;padding:14px;border-radius:14px;font-size:15px;font-weight:600;background:rgba(124,108,240,.14);border:1px solid rgba(124,108,240,.35);color:inherit;cursor:pointer">🔁 Пройти заново</button>
    <div class="lk-sign" style="margin-top:22px">
      <span class="lk-badge lk-badge-l">Λ</span>
      <span class="lk-badge lk-badge-d">D.</span>
    </div>
    <div style="height:32px"></div>`;
  el.classList.add('show');
  window.scrollTo(0, 0);

  const retry = document.getElementById('btn-retry');
  if (retry) retry.addEventListener('click', showResetConfirm);

  bindRevToggles(el);
}

// ── ИНИЦИАЛИЗАЦИЯ ─────────────────────────────────────────────────────────────

function showAppScreens() {
  document.getElementById('hw-header').hidden = false;
  document.getElementById('screen').hidden = false;
}
function startHw() {
  showAppScreens();
  Piano.wake();
  render();
}
function restoreProgress() {
  const saved = loadProgress();
  if (!saved || !Array.isArray(saved.results) || !saved.results.length) return false;
  saved.results.forEach(r => results.push(r));
  firstTryCount = (typeof saved.firstTryCount === 'number') ? saved.firstTryCount : results.filter(r => r && r.correct).length;
  combo = saved.combo || 0; reported = !!saved.reported; finished = !!saved.finished;
  idx = results.length;
  showAppScreens();
  if (finished || idx >= DATA.tasks.length) showFinal(); else render();
  return true;
}
function devGoto(n) {
  devMode = true;
  const total = DATA.tasks.length;
  const target = clamp(n, 1, total) - 1;
  for (let i = 0; i < target; i++) {
    const t = DATA.tasks[i];
    results[i] = { label: t.label, diff: t.difficulty, correct: true, wrong: [], feedback: t.feedback };
  }
  firstTryCount = target; idx = target;
  showAppScreens();
  render();
}
function init(data) {
  DATA = data;
  const yes = document.getElementById('reset-yes');
  const no  = document.getElementById('reset-no');
  if (yes) yes.addEventListener('click', doReset);
  if (no)  no.addEventListener('click', hideResetConfirm);

  const qs = new URLSearchParams(location.search);
  // `?r=ник.id` — режим разбора (Ди смотрит попытку ученика). Тренажёр не запускаем.
  const rev = HwCore.reviewCode();
  if (rev) {
    HwCore.showReview(rev, {
      mount: document.getElementById('final-screen'),
      helpers: REV_HELPERS,
      hide: [document.getElementById('screen'), document.getElementById('hw-header')],
    });
    return;
  }
  if (qs.get('reset') === '1') clearProgress();
  allowSend = qs.get('send') === '1';
  const g = parseInt(qs.get('g') || qs.get('goto'), 10);
  if (!isNaN(g)) { devGoto(g); return; }
  if (!restoreProgress()) startHw();
}

// данные в data.js (window.HW_DATA) — тренажёр работает и с file://, без сервера
if (window.HW_DATA) init(window.HW_DATA);
else {
  document.getElementById('screen').hidden = false;
  document.getElementById('screen').innerHTML =
    '<p style="color:var(--lk-bad);padding:20px;font-size:15px">Ошибка загрузки данных. Обновите страницу.</p>';
}
