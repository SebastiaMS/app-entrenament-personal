// Pantallas Hoy (sesión que toca) y Entrenar (registrar series con temporizador).
import { del, getAll, getByIndex, getSetting, put, setSetting } from './db.js';
import { EXERCISES, PROGRAM, nextMonday, sessionFor, videoUrl, weekVariant } from './exercises.js';

const DAYS = ['push', 'pull', 'legs'];
const DEFAULT_REST = 90;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtKg = (n) => String(n).replace('.', ',');
const parseNum = (v) => parseFloat(String(v).replace(',', '.'));
function localDate(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function svg(path, size = 20, sw = 2.5, extra = '') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${path}</svg>`;
}

// ---------- Programa: semana A/B ----------
export async function programVariant() {
  let start = await getSetting('programStart');
  if (!start) {
    start = nextMonday(new Date()).toISOString();
    await setSetting('programStart', start);
  }
  return weekVariant(new Date(), new Date(start));
}

async function nextDay() {
  const last = await getSetting('lastDay');
  const i = DAYS.indexOf(last);
  return DAYS[(i + 1) % DAYS.length]; // sin historial: push
}

// ---------- Estado ----------
let host = null;       // contenedor (#app)
let hooks = {};        // { immersive(bool) }
let session = null;    // sesión activa
let view = 'today';    // today | train | done
let pickedDay = null;  // día elegido en Hoy
let summary = null;
let timerId = null;
let audioCtx = null;
let wakeLock = null;
let resumed = false;

function persist() {
  return setSetting('activeSession', session);
}

async function lastTime(exId) {
  const rows = (await getByIndex('logs', 'exerciseId', exId)).filter((r) => !session || r.sessionId !== session.id);
  if (!rows.length) return null;
  const latest = rows.reduce((m, r) => (r.sessionId > m ? r.sessionId : m), rows[0].sessionId);
  return rows.filter((r) => r.sessionId === latest).sort((a, b) => a.setIndex - b.setIndex);
}

function lastLabel(sets) {
  if (!sets || !sets.length) return null;
  const weights = [...new Set(sets.map((s) => s.weight))];
  const reps = sets.map((s) => s.reps).join(', ');
  return weights.length === 1 ? `${fmtKg(weights[0])} kg × ${reps}` : sets.map((s) => `${fmtKg(s.weight)} × ${s.reps}`).join(', ');
}

// ---------- Entrada desde la app ----------
export async function renderToday(container, h) {
  host = container;
  hooks = h || {};
  session = await getSetting('activeSession');
  if (session && view === 'today' && !resumed) {
    resumed = true;
    // si la app se cerró en mitad del entreno, se retoma donde estaba
    if (Date.now() - session.id < 8 * 3600 * 1000) view = 'train';
  }
  resumed = true;
  if (!session && view === 'train') view = 'today';
  if (view === 'train') return showTrain();
  if (view === 'done') return showDone();
  return showToday();
}

// ---------- HOY ----------
async function showToday() {
  stopTimer();
  hooks.immersive && hooks.immersive(false);
  const variant = await programVariant();
  const suggested = await nextDay();
  const day = session ? session.day : pickedDay || suggested;
  const items = session ? session.ids.map((id) => ({ id, ...EXERCISES[id] })) : sessionFor(day, variant);
  const sessions = await getAll('sessions');
  const lastSession = sessions.sort((a, b) => b.id - a.id)[0];
  const dateTxt = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase();

  const done = session ? Object.values(session.sets).flat().filter((s) => s.done).length : 0;
  host.innerHTML = `
    <div class="head"><span class="eyebrow">${esc(dateTxt)}</span><h1>Hoy</h1></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="eyebrow">${session ? 'Sesión en curso' : 'Te toca'}</span>
        <span class="muted small">Semana ${session ? session.variant : variant}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:28px;font-weight:800;line-height:1.1">${PROGRAM[day].name}</span>
        <span class="muted small">${items.length} ejercicios · unos 75 min${session ? ' · ' + done + ' series hechas' : ''}</span>
      </div>
      <div class="list" style="gap:0">
        ${items.slice(0, 3).map((e) => `<div class="item" style="min-height:44px;font-size:15px"><span>${esc(e.name)}</span><span>${e.sets} × ${e.reps[0]}-${e.reps[1]}</span></div>`).join('')}
        <div class="item" style="min-height:40px"><span class="muted small">+ ${items.length - 3} ejercicios más</span><span></span></div>
      </div>
      ${session
        ? `<button class="btn primary" id="go" style="flex:none">Continuar sesión</button>
           <button class="btn" id="discard" style="flex:none;min-height:44px;color:var(--coral);border-color:#E8B8B2">Descartar sesión</button>`
        : `<button class="btn primary" id="go" style="flex:none">${svg('<path d="M8 5.5v13l11-6.5z"/>', 18, 2, 'fill="#fff" stroke="#fff"')}Empezar sesión</button>`}
    </div>
    ${session ? '' : `
    <div class="card">
      <span class="eyebrow">¿Otro día?</span>
      <div class="chips" role="group" aria-label="Elegir día">
        ${DAYS.map((d) => `<button class="chip" data-day="${d}" aria-pressed="${d === day}">${PROGRAM[d].name}</button>`).join('')}
      </div>
      <p>Por defecto te propone el siguiente día del ciclo Push, Pull, Legs. ${lastSession ? 'Última sesión: ' + PROGRAM[lastSession.day].name + ', ' + relDay(lastSession.finishedAt) + '.' : 'Aún no has registrado ninguna sesión.'}</p>
    </div>`}
    <div class="placeholder" style="min-height:90px"><strong>Movilidad diaria</strong><span>Se añade en el siguiente paso de la Fase 3.</span></div>`;
  host.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { pickedDay = b.dataset.day; showToday(); }));
  document.getElementById('go').addEventListener('click', async () => {
    if (!session) await startSession(day);
    view = 'train';
    showTrain();
  });
  const dis = document.getElementById('discard');
  if (dis) dis.addEventListener('click', async () => {
    if (!confirm('Se perderá lo que has registrado en esta sesión. ¿Descartarla?')) return;
    await discardSession();
    view = 'today';
    showToday();
  });
  host.scrollTop = 0;
}

function relDay(iso) {
  const d = Math.round((Date.now() - new Date(iso)) / 86400000);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días';
}

async function startSession(day) {
  const variant = await programVariant();
  const items = sessionFor(day, variant);
  const sets = {};
  session = { id: Date.now(), day, variant, startedAt: new Date().toISOString(), idx: 0, ids: items.map((e) => e.id), sets, restEnd: null, restTotal: 0 };
  for (const ex of items) {
    const last = await lastTime(ex.id);
    sets[ex.id] = Array.from({ length: ex.sets }, (_, i) => {
      const l = last && (last[i] || last[last.length - 1]);
      return { w: l ? l.weight : '', r: l ? l.reps : '', done: false };
    });
  }
  await persist();
}

async function discardSession() {
  for (const id of session.ids) {
    const rows = await getByIndex('logs', 'exerciseId', id);
    for (const r of rows) if (r.sessionId === session.id) await del('logs', r.id);
  }
  session = null;
  await setSetting('activeSession', null);
}

// ---------- ENTRENAR ----------
function elapsedMin() {
  return Math.max(0, Math.round((Date.now() - new Date(session.startedAt)) / 60000));
}

async function showTrain() {
  hooks.immersive && hooks.immersive(true);
  requestWakeLock();
  const id = session.ids[session.idx];
  const ex = EXERCISES[id];
  const sets = session.sets[id];
  const last = lastLabel(await lastTime(id));
  const isLast = session.idx === session.ids.length - 1;
  const rest = (await getSetting('restSeconds', DEFAULT_REST));

  host.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="eyebrow">${PROGRAM[session.day].name} · ejercicio ${session.idx + 1} de ${session.ids.length}</span>
        <span class="muted small" id="elapsed">${elapsedMin()} min</span>
      </div>
      <div class="seg">${session.ids.map((_, i) => `<i class="${i <= session.idx ? 'on' : ''}"></i>`).join('')}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <h1 style="font-size:28px">${esc(ex.name)}</h1>
      <span class="muted" style="font-size:15px">${esc(ex.equip)} · ${ex.sets} series · ${ex.reps[0]}-${ex.reps[1]} reps · 3-4 en reserva</span>
    </div>
    ${ex.tecnica ? '<span class="tag">Aprende primero la técnica con poco peso</span>' : ''}
    <div class="row">
      <button class="mini" id="how">${svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9"/><path d="M12 17.4v.1"/>', 18, 2)}Cómo se hace</button>
      <a class="mini" href="${videoUrl(id)}" target="_blank" rel="noopener">${svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 9.5l4 2.5-4 2.5z"/>', 18, 2)}Ver vídeo</a>
    </div>
    ${last ? `<div class="lastline">${svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', 16, 2)}<span>La última vez: <strong>${esc(last)}</strong></span></div>` : '<div class="lastline muted">Primera vez con este ejercicio: empieza con un peso que te deje 3-4 repeticiones en reserva.</div>'}
    <div style="display:flex;flex-direction:column;gap:10px" id="sets">
      ${sets.map((s, i) => `
        <div class="setrow ${s.done ? 'done' : ''}">
          <div class="n">${i + 1}</div>
          <label class="inp wk"><input inputmode="decimal" enterkeyhint="done" autocomplete="off" aria-label="Peso de la serie ${i + 1}" data-k="w" data-i="${i}" value="${s.w === '' ? '' : fmtKg(s.w)}" placeholder="0"><span>kg</span></label>
          <label class="inp rp"><input inputmode="numeric" enterkeyhint="done" autocomplete="off" aria-label="Repeticiones de la serie ${i + 1}" data-k="r" data-i="${i}" value="${s.r}" placeholder="0"><span>rep</span></label>
          <button class="hecha" data-toggle="${i}" aria-pressed="${s.done}">${s.done ? svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 3) : ''}Hecha</button>
        </div>`).join('')}
      <button class="mini" id="add-set" style="align-self:flex-start">${svg('<path d="M12 5v14M5 12h14"/>', 16, 2.5)}Añadir serie</button>
    </div>
    <div class="card" style="gap:10px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span class="eyebrow">Descanso</span>
          <span id="rest-time" style="font-size:34px;font-weight:800;line-height:1">${fmtClock(rest)}</span>
        </div>
        <button class="mini" id="skip" style="flex:none">Saltar</button>
      </div>
      <div class="bar"><div id="rest-bar" style="width:0%"></div></div>
    </div>
    <div style="flex-grow:1"></div>
    <div class="actions">
      <button class="back-btn" id="prev">${svg('<path d="M15 5l-7 7 7 7"/>', 20, 2.5)}Atrás</button>
      <button class="next-btn" id="next">${isLast ? 'Terminar sesión' : 'Siguiente ejercicio'}${isLast ? '' : svg('<path d="M9 5l7 7-7 7"/>', 20, 2.5)}</button>
    </div>
    <dialog id="how-dlg">
      <h2>${esc(ex.name)}</h2>
      <ul>${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      <p class="muted small">Sirve sin conexión. Para ver la técnica en vídeo hace falta cobertura.</p>
      <button class="btn primary" id="how-close" style="flex:none">Entendido</button>
    </dialog>`;

  const dlg = document.getElementById('how-dlg');
  document.getElementById('how').addEventListener('click', () => dlg.showModal());
  document.getElementById('how-close').addEventListener('click', () => dlg.close());

  host.querySelectorAll('input[data-k]').forEach((inp) => {
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('input', () => {
      const s = sets[+inp.dataset.i];
      const v = inp.value.trim();
      s[inp.dataset.k] = v === '' ? '' : (Number.isNaN(parseNum(v)) ? '' : parseNum(v));
    });
    inp.addEventListener('change', async () => {
      const i = +inp.dataset.i;
      await persist();
      if (sets[i].done) await writeLog(id, i); // si ya estaba hecha, se corrige el registro
    });
  });
  host.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggleSet(id, +b.dataset.toggle)));
  document.getElementById('add-set').addEventListener('click', async () => {
    const lastSet = sets[sets.length - 1];
    sets.push({ w: lastSet ? lastSet.w : '', r: lastSet ? lastSet.r : '', done: false });
    await persist();
    showTrain();
  });
  document.getElementById('skip').addEventListener('click', () => { endRest(false); });
  document.getElementById('prev').addEventListener('click', async () => {
    if (session.idx === 0) { view = 'today'; showToday(); return; }
    session.idx -= 1;
    await persist();
    showTrain();
  });
  document.getElementById('next').addEventListener('click', async () => {
    if (isLast) return finishSession();
    session.idx += 1;
    await persist();
    showTrain();
  });
  startTimer();
  host.scrollTop = 0;
}

async function writeLog(exId, i) {
  const s = session.sets[exId][i];
  await put('logs', {
    id: `${session.id}-${exId}-${i}`,
    sessionId: session.id,
    date: localDate(),
    exerciseId: exId,
    setIndex: i,
    weight: s.w,
    reps: s.r
  });
}

async function toggleSet(exId, i) {
  const s = session.sets[exId][i];
  if (!s.done) {
    if (s.w === '' && EXERCISES[exId].carga === 'peso-corporal') s.w = 0; // sin lastre: el peso queda en 0
    if (s.w === '' || !(s.w >= 0) || !(s.r > 0)) {
      flash(s.w !== '' && !(s.r > 0) ? 'Escribe las repeticiones.' : 'Escribe el peso y las repeticiones.');
      return;
    }
    s.done = true;
    await writeLog(exId, i);
    const rest = await getSetting('restSeconds', DEFAULT_REST);
    session.restTotal = rest;
    session.restEnd = Date.now() + rest * 1000;
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* sin sonido */ }
  } else {
    s.done = false;
    await del('logs', `${session.id}-${exId}-${i}`);
  }
  await persist();
  showTrain();
}

function flash(text) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(flash.t);
  flash.t = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Temporizador de descanso ----------
function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function startTimer() {
  stopTimer();
  tick();
  timerId = setInterval(tick, 250);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function tick() {
  const t = document.getElementById('rest-time');
  if (!t || !session) { stopTimer(); return; }
  const el = document.getElementById('elapsed');
  if (el) el.textContent = elapsedMin() + ' min';
  const bar = document.getElementById('rest-bar');
  if (!session.restEnd) {
    t.classList.remove('live');
    return;
  }
  const left = Math.max(0, Math.ceil((session.restEnd - Date.now()) / 1000));
  t.textContent = fmtClock(left);
  t.classList.add('live');
  if (bar) bar.style.width = Math.min(100, (1 - left / session.restTotal) * 100) + '%';
  if (left === 0) endRest(true);
}

async function endRest(alert) {
  if (!session) return;
  session.restEnd = null;
  persist();
  const rest = await getSetting('restSeconds', DEFAULT_REST);
  const t = document.getElementById('rest-time');
  const bar = document.getElementById('rest-bar');
  if (t) { t.textContent = fmtClock(rest); t.classList.remove('live'); }
  if (bar) bar.style.width = '0%';
  if (alert) {
    flash('Descanso terminado. A por la siguiente serie.');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    beep();
  }
}

function beep() {
  if (!audioCtx) return;
  try {
    [0, 0.25, 0.5].forEach((delay) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.value = 0.15;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(audioCtx.currentTime + delay);
      o.stop(audioCtx.currentTime + delay + 0.15);
    });
  } catch (e) { /* sin sonido */ }
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) { /* no disponible */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && view === 'train' && session) { requestWakeLock(); tick(); }
});

// ---------- Terminar ----------
async function finishSession() {
  const setsDone = Object.values(session.sets).flat().filter((s) => s.done).length;
  if (setsDone === 0 && !confirm('No has marcado ninguna serie como hecha. ¿Terminar la sesión igualmente?')) return;
  const finishedAt = new Date().toISOString();
  const rec = { id: session.id, day: session.day, variant: session.variant, startedAt: session.startedAt, finishedAt, setsDone, ids: session.ids };
  await put('sessions', rec);
  await setSetting('lastDay', session.day);
  summary = { ...rec, minutes: Math.max(1, Math.round((new Date(finishedAt) - new Date(session.startedAt)) / 60000)) };
  session = null;
  await setSetting('activeSession', null);
  stopTimer();
  try { wakeLock && wakeLock.release(); } catch (e) { /* nada */ }
  view = 'done';
  showDone();
}

function showDone() {
  hooks.immersive && hooks.immersive(false);
  if (!summary) { view = 'today'; return showToday(); }
  host.innerHTML = `
    <div class="head"><span class="eyebrow">${PROGRAM[summary.day].name} · semana ${summary.variant}</span><h1>Sesión terminada</h1></div>
    <div class="status"><div class="dot">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 3, 'stroke="#fff"')}</div>
      <div><strong>Buen trabajo</strong><span>Tus series ya están guardadas en el historial.</span></div></div>
    <div class="card list">
      <div class="item"><span>Duración</span><span>${summary.minutes} min</span></div>
      <div class="item"><span>Series hechas</span><span>${summary.setsDone}</span></div>
      <div class="item"><span>Ejercicios</span><span>${summary.ids.length}</span></div>
    </div>
    <div style="flex-grow:1"></div>
    <button class="btn primary" id="back-today" style="flex:none">Volver a Hoy</button>`;
  document.getElementById('back-today').addEventListener('click', () => { summary = null; view = 'today'; showToday(); });
}
