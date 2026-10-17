// Historial: evolución, mejor marca y sesiones de cada ejercicio, con tus series reales.
import { getAll, getByIndex } from './db.js';
import { EXERCISES, PROGRAM } from './exercises.js';
import { esc, localDate, svg } from './util.js';

const DAYS = Object.keys(PROGRAM); // push, pull, legs
const MAX_POINTS = 12;
const RANGES = [
  { label: '1 mes', days: 30 },
  { label: '3 meses', days: 90 },
  { label: 'Todo', days: Infinity }
];
const TABS = ['Evolución', 'Mejor marca', 'Sesiones'];

const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const dateLabel = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
};

const state = { day: null, exId: null, tab: 0, range: 2, sel: null, open: false };
let host = null;

function exercisesOf(day) {
  const ids = [];
  for (const pair of PROGRAM[day].slots) for (const id of pair) if (!ids.includes(id)) ids.push(id);
  return ids;
}

// Sesiones de un ejercicio: una entrada por sesión, de la más antigua a la más reciente.
function sessionsOf(rows, ex) {
  const bw = ex.carga === 'peso-corporal';
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.sessionId)) by.set(r.sessionId, { sessionId: r.sessionId, date: r.date, sets: [] });
    by.get(r.sessionId).sets.push({ w: r.weight, r: r.reps, i: r.setIndex });
  }
  const list = [...by.values()].sort((a, b) => a.sessionId - b.sessionId);
  let best = -Infinity;
  for (const s of list) {
    s.sets.sort((a, b) => a.i - b.i);
    s.value = bw ? Math.max(...s.sets.map((x) => x.r)) : Math.max(...s.sets.map((x) => x.w));
    s.isPR = s.value > best;
    if (s.isPR) best = s.value;
    s.detail = bw ? s.sets.map((x) => x.r).join(' · ') + ' reps' : fmt(s.value) + ' kg · ' + s.sets.map((x) => x.r).join(' · ');
  }
  return list;
}

export async function renderHistory(container) {
  host = container;
  const allLogs = await getAll('logs');
  const allSessions = await getAll('sessions');
  const counts = new Map();
  for (const l of allLogs) {
    if (!counts.has(l.exerciseId)) counts.set(l.exerciseId, new Set());
    counts.get(l.exerciseId).add(l.sessionId);
  }
  // Primera vez: abrir el grupo de la última sesión registrada
  if (!state.day) {
    const last = allSessions.sort((a, b) => b.id - a.id)[0];
    state.day = last ? last.day : 'push';
  }
  const ids = exercisesOf(state.day);
  if (!state.exId || !ids.includes(state.exId)) {
    state.exId = ids.find((id) => counts.has(id)) || ids[0];
    state.sel = null;
  }
  const ex = EXERCISES[state.exId];
  const bw = ex.carga === 'peso-corporal';
  const unit = bw ? 'reps' : 'kg';
  const rows = await getByIndex('logs', 'exerciseId', state.exId);
  const sessions = sessionsOf(rows, ex);

  host.innerHTML = `
    <div class="head"><span class="eyebrow">Tu progreso</span><h1>Historial</h1></div>
    <div class="chips" role="group" aria-label="Día">
      ${DAYS.map((d) => `<button class="chip" data-day="${d}" aria-pressed="${d === state.day}">${PROGRAM[d].name}</button>`).join('')}
    </div>
    <div style="position:relative">
      <button class="selbtn" id="ex-btn" aria-expanded="${state.open}">
        <span style="display:flex;flex-direction:column;gap:0"><span class="eyebrow" style="font-size:12px">Ejercicio</span><span style="font-size:17px;font-weight:800">${esc(ex.name)}</span></span>
        ${svg('<path d="M6 9l6 6 6-6"/>', 20, 2.5, state.open ? 'style="transform:rotate(180deg)"' : '')}
      </button>
      ${state.open ? `<div class="sellist">
        ${ids.map((id) => `<button data-ex="${id}" class="${id === state.exId ? 'on' : ''}"><span>${esc(EXERCISES[id].name)}</span><span class="muted small">${counts.has(id) ? counts.get(id).size + (counts.get(id).size === 1 ? ' sesión' : ' sesiones') : 'sin datos'}</span></button>`).join('')}
      </div>` : ''}
    </div>
    <div class="segtabs" role="tablist">
      ${TABS.map((t, i) => `<button role="tab" data-tab="${i}" aria-selected="${i === state.tab}">${t}</button>`).join('')}
    </div>
    <div id="hist-body"></div>`;

  host.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { state.day = b.dataset.day; state.exId = null; state.open = false; renderHistory(host); }));
  document.getElementById('ex-btn').addEventListener('click', () => { state.open = !state.open; renderHistory(host); });
  host.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { state.exId = b.dataset.ex; state.sel = null; state.open = false; renderHistory(host); }));
  host.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = +b.dataset.tab; renderHistory(host); }));

  const body = document.getElementById('hist-body');
  if (!sessions.length) {
    body.innerHTML = `<div class="placeholder"><strong>Aún no hay registros</strong><span>Cuando termines una sesión con este ejercicio, verás aquí su evolución.</span></div>`;
  } else if (state.tab === 0) {
    drawEvolution(body, sessions, unit, bw);
  } else if (state.tab === 1) {
    drawBest(body, sessions, unit, bw);
  } else {
    drawSessions(body, sessions);
  }
  host.scrollTop = 0;
}

// ---------- Evolución ----------
function drawEvolution(body, all, unit, bw) {
  const cutoff = RANGES[state.range].days === Infinity ? null : localDate(new Date(Date.now() - RANGES[state.range].days * 86400000));
  let data = cutoff ? all.filter((s) => s.date >= cutoff) : all;
  const capped = data.length > MAX_POINTS;
  data = data.slice(-MAX_POINTS);

  const rangeBtns = RANGES.map((r, i) => `<button class="chip" data-range="${i}" aria-pressed="${i === state.range}">${r.label}</button>`).join('');
  if (!data.length) {
    body.innerHTML = `<div class="card"><span style="font-size:15px;font-weight:800">${bw ? 'Repeticiones' : 'Peso'} por sesión (${unit})</span><div class="chips">${rangeBtns}</div><p>No hay sesiones en este periodo.</p></div>`;
    bindRange(body);
    return;
  }

  const W = Math.max(260, Math.min(360, host.clientWidth - 71));
  const H = 204, L = 34, R = 14, T = 16, B = 32;
  const plotH = H - T - B;
  const vals = data.map((s) => s.value);
  const vmin = Math.min(...vals), vmax = Math.max(...vals);
  const pad = Math.max(bw ? 1 : 2.5, (vmax - vmin) * 0.15);
  const lo = Math.max(0, Math.floor((vmin - pad) / (bw ? 1 : 2.5)) * (bw ? 1 : 2.5));
  const hi = Math.ceil((vmax + pad) / (bw ? 1 : 2.5)) * (bw ? 1 : 2.5);
  const n = data.length;
  const step = n > 1 ? (W - L - R - 20) / (n - 1) : 0;
  const px = (i) => (n > 1 ? L + 10 + i * step : L + (W - L - R) / 2);
  const py = (v) => T + ((hi - v) / (hi - lo)) * plotH;
  if (state.sel === null || state.sel >= n) state.sel = n - 1;

  const ticks = [lo, (lo + hi) / 2, hi];
  let html = `<div style="position:relative;width:${W}px;height:${H}px">
    <div style="position:absolute;left:${L}px;top:${T + plotH}px;width:${W - L - R}px;height:1px;background:#D9CDB5"></div>`;
  for (const v of ticks) {
    html += `<div style="position:absolute;left:${L}px;top:${py(v).toFixed(1)}px;width:${W - L - R}px;height:1px;background:#EFE7D6"></div>
      <span style="position:absolute;left:0;top:${(py(v) - 8).toFixed(1)}px;width:28px;text-align:right;font-size:12px;font-weight:600;color:var(--muted)">${fmt(v)}</span>`;
  }
  const every = Math.ceil(n / 5);
  data.forEach((s, i) => {
    if (i % every === 0 || i === n - 1) {
      html += `<span style="position:absolute;left:${(px(i) - 24).toFixed(1)}px;top:${T + plotH + 8}px;width:48px;text-align:center;font-size:12px;font-weight:600;color:var(--muted)">${esc(dateLabel(s.date))}</span>`;
    }
  });
  for (let i = 0; i < n - 1; i++) {
    const x1 = px(i), y1 = py(data[i].value), x2 = px(i + 1), y2 = py(data[i + 1].value);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    html += `<div style="position:absolute;left:${x1.toFixed(1)}px;top:${(y1 - 1).toFixed(1)}px;width:${len.toFixed(1)}px;height:2px;background:var(--ochre);transform-origin:0 50%;transform:rotate(${ang.toFixed(2)}deg)"></div>`;
  }
  const hit = Math.min(44, Math.max(24, n > 1 ? step : 44));
  data.forEach((s, i) => {
    const on = i === state.sel;
    const size = on ? 16 : 12;
    html += `<button data-pt="${i}" aria-label="${esc(dateLabel(s.date))}: ${esc(s.detail)}" style="position:absolute;left:${(px(i) - hit / 2).toFixed(1)}px;top:${(py(s.value) - 22).toFixed(1)}px;width:${hit}px;height:44px;display:flex;align-items:center;justify-content:center;background:none;border:none;padding:0;cursor:pointer">
      <div style="box-sizing:border-box;width:${size}px;height:${size}px;border-radius:${size / 2}px;background:var(--ochre);border:2px solid #FFFFFF;${on ? 'box-shadow:0 0 0 2px var(--ochre)' : ''}"></div></button>`;
  });
  const prIdx = data.map((s, i) => (s.isPR ? i : -1)).filter((i) => i >= 0).pop();
  if (prIdx !== undefined && prIdx >= 0 && n > 1) {
    html += `<span style="position:absolute;left:${Math.min(W - 60, Math.max(0, px(prIdx) - 30)).toFixed(1)}px;top:${Math.max(0, py(data[prIdx].value) - 38).toFixed(1)}px;padding:2px 8px;background:var(--tint);color:var(--ochre-dark);border-radius:999px;font-size:12px;font-weight:800">Récord</span>`;
  }
  html += '</div>';

  const s = data[state.sel];
  body.innerHTML = `<div class="card">
    <div style="display:flex;flex-direction:column"><span style="font-size:15px;font-weight:800">${bw ? 'Repeticiones' : 'Peso'} por sesión (${unit})</span></div>
    <div class="chips">${rangeBtns}</div>
    ${html}
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg);border-radius:12px;padding:10px 12px">
      <div style="display:flex;flex-direction:column"><span style="font-size:13px;font-weight:700;color:var(--muted)">${esc(dateLabel(s.date))}</span><span style="font-size:17px;font-weight:800">${esc(s.detail)}</span></div>
      ${s.isPR ? '<span class="tag">Récord personal</span>' : ''}
    </div>
    <span class="muted small">Toca un punto para ver la sesión.${capped ? ' Se muestran las últimas ' + MAX_POINTS + ' sesiones.' : ''}</span>
  </div>`;
  bindRange(body);
  body.querySelectorAll('[data-pt]').forEach((b) => b.addEventListener('click', () => { state.sel = +b.dataset.pt; renderHistory(host); }));
}

function bindRange(body) {
  body.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => { state.range = +b.dataset.range; state.sel = null; renderHistory(host); }));
}

// ---------- Mejor marca ----------
function drawBest(body, sessions, unit, bw) {
  // La mejor marca es el mayor peso (o las más repeticiones); a igualdad, gana lo más reciente.
  let top = null;
  for (const s of sessions) {
    for (const set of s.sets) {
      const score = bw ? set.r : set.w * 1000 + set.r;
      if (!top || score >= top.score) top = { score, w: set.w, r: set.r, date: s.date };
    }
  }
  const byWeight = new Map();
  if (!bw) {
    for (const s of sessions) for (const set of s.sets) {
      const cur = byWeight.get(set.w);
      if (!cur || set.r > cur.r || (set.r === cur.r && s.date >= cur.date)) byWeight.set(set.w, { r: set.r, date: s.date });
    }
  }
  const list = [...byWeight.entries()].sort((a, b) => b[0] - a[0]).slice(0, 5);
  body.innerHTML = `
    <div class="card" style="gap:4px;padding:18px 16px">
      <span class="eyebrow">Mejor marca</span>
      <span style="font-size:44px;line-height:1.05;font-weight:800">${bw ? top.r + ' reps' : fmt(top.w) + ' kg × ' + top.r}</span>
      <span style="font-size:15px;color:var(--muted)">${esc(dateLabel(top.date))}</span>
    </div>
    ${bw ? '' : `<div class="card" style="gap:8px">
      <span style="font-size:15px;font-weight:800">Tu mejor resultado con cada peso</span>
      ${list.map(([w, v]) => `<div style="display:flex;justify-content:space-between;align-items:center;border-top:1.5px solid #F1E9D8;padding-top:8px">
        <span style="font-size:16px;font-weight:700">${fmt(w)} kg</span><span style="font-size:16px;font-weight:800">${v.r} reps</span><span style="font-size:14px;color:var(--muted)">${esc(dateLabel(v.date))}</span></div>`).join('')}
    </div>`}`;
}

// ---------- Sesiones ----------
function drawSessions(body, sessions) {
  const list = sessions.slice().reverse().slice(0, 12);
  body.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
    ${list.map((s) => `<div class="card" style="flex-direction:row;align-items:center;justify-content:space-between;padding:12px 16px;gap:8px;border-radius:16px">
      <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;font-weight:700;color:var(--muted)">${esc(dateLabel(s.date))}</span><span style="font-size:17px;font-weight:800">${esc(s.detail)}</span></div>
      ${s.isPR ? '<span class="tag">Récord</span>' : ''}
    </div>`).join('')}
    ${sessions.length > 12 ? '<span class="muted small">Se muestran las últimas 12 sesiones.</span>' : ''}
  </div>`;
}
