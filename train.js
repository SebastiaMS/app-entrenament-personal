// Pantallas Hoy (sesión que toca) y Entrenar (registrar series con temporizador).
import { del, getAll, getByIndex, getSetting, put, setSetting } from './db.js';
import { EXERCISES, PROGRAM, nextMonday, sessionFor, videoUrl, weekVariant } from './exercises.js';
import { beep, esc, flashCard, fmtClock, keepAwake, localDate, fmtTotal, releaseAwake, svg, toast, unlockAudio } from './util.js';
import { suggestion } from './progress.js';
import { bodyKg, startingWeight } from './starting.js';
import { LOW_SLEEP_MIN, preloadGis, syncSleep } from './fitbit.js';
import { KINDS, getMark, openDaySheet, weekData, weekStripHtml, weekTip } from './week.js';
import { ROUTINES, doneToday, favorites, routineMinutes, startMobility, suggestedRoutine, toggleFavorite } from './mobility.js';

const DAYS = ['push', 'pull', 'legs'];
const DEFAULT_REST = 90;
// Descanso entre series según el tipo de ejercicio: los compuestos pesados piden más (2:30),
// el aislamiento y el trabajo pequeño se recuperan antes (1:30).
// Calentamiento: no se registra. El primer compuesto del día lleva 2 series (50 % y 70 %); los demás, 1 al 60 %.
function warmupHtml(id, sets) {
  const ex = EXERCISES[id];
  const w = sets[0] && Number(sets[0].w);
  if (!isCompound(ex) || !(w >= 20)) return '';
  const first = session.ids.find((x) => isCompound(EXERCISES[x])) === id;
  const rows = first ? [[0.5, 8], [0.7, 5]] : [[0.6, 5]];
  return `<div class="lastline" id="warmup" style="align-items:flex-start">${svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>', 16, 2)}<span><strong>Calienta antes</strong> (no se cuenta): ${rows.map(([p, r]) => `${fmtKg(Math.max(2.5, round25(w * p)))} kg × ${r}`).join(' · ')}</span></div>`;
}
const SMALL = /aislamiento|tr[ií]ceps|b[ií]ceps|abdomen|antebrazo|lateral|gemelo|trasero/i;
const restFor = (ex) => (SMALL.test(ex.muscle) || ex.reps[0] >= 12 ? 90 : 150);

const isCompound = (ex) => restFor(ex) === 150 && ex.carga !== 'peso-corporal';
const round25 = (n) => Math.round(n / 2.5) * 2.5;
const DAY_MS = 86400000;
const addDays = (iso, n) => localDate(new Date(new Date(iso + 'T12:00:00').getTime() + n * DAY_MS));

// Semana de descarga: tras 6 semanas seguidas, una semana con una serie menos y ~15 % menos de peso.
async function deloadInfo() {
  const today = localDate();
  let d = await getSetting('deload');
  if (d && d.until < today) {
    await setSetting('lastDeload', d.until);
    await setSetting('deload', null);
    d = null;
  }
  if (d) return { active: true, until: d.until, due: false, weeks: 0 };
  const base = (await getSetting('lastDeload')) || localDate(new Date(await getSetting('programStart', new Date().toISOString())));
  const weeks = Math.floor((new Date(today + 'T12:00:00') - new Date(base + 'T12:00:00')) / (7 * DAY_MS));
  const snooze = await getSetting('deloadSnooze');
  return { active: false, until: null, due: weeks >= 6 && !(snooze && snooze > today), weeks };
}

const fmtKg = (n) => String(n).replace('.', ',');
const parseNum = (v) => parseFloat(String(v).replace(',', '.'));

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
let resumed = false;
let pickedRoutine = null;  // rutina de movilidad elegida en Hoy
let routinesOpen = false;  // lista de rutinas desplegada
let showAllEx = false;     // lista completa de ejercicios de hoy

// Decisión de hoy cuando hay marca (pádel, oficina, descanso): { date, choice }
async function todayChoice() {
  const c = await getSetting('todayChoice');
  return c && c.date === localDate() ? c.choice : null;
}
async function chooseToday(choice) {
  await setSetting('todayChoice', { date: localDate(), choice });
}
const lightSets = (e, light) => (light ? Math.max(2, e.sets - 1) : e.sets);

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
  if (session && (session.ids.includes('pec-deck-inverso') || session.ids.includes('curl-muneca-barra'))) {
    const old2 = 'curl-muneca-barra', new2 = 'curl-muneca-espalda';
    session.ids = session.ids.map((x) => (x === old2 ? new2 : x));
    if (session.sets[old2]) { session.sets[new2] = session.sets[old2].map((x) => (x.done || x.w !== '' ? x : { ...x, w: 17.5, r: 15 })); delete session.sets[old2]; }
    if (session.targets && session.targets[old2]) { session.targets[new2] = session.targets[old2]; delete session.targets[old2]; } // ejercicio retirado: lo sustituyen los pájaros con mancuernas
    const o = 'pec-deck-inverso', n = 'pajaros-mancuernas';
    session.ids = session.ids.map((x) => (x === o ? n : x));
    if (session.sets[o]) { session.sets[n] = session.sets[o]; delete session.sets[o]; }
    if (session.targets && session.targets[o]) { session.targets[n] = session.targets[o]; delete session.targets[o]; }
    await setSetting('activeSession', session);
  }
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
  const w = await weekData();
  const tIdx = w.days.findIndex((d) => d.isToday);
  const kind = (w.days[tIdx] || {}).kind || null;
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  const tomorrowKind = await getMark(localDate(tmr));
  const choice = await todayChoice();
  const dl = await deloadInfo();
  const light = !session && (choice === 'light' || dl.active);
  const dateTxt = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase();

  const done = session ? Object.values(session.sets).flat().filter((s) => s.done).length : 0;

  // Tarjeta de movilidad: propone la rutina siguiente de la rotación y deja elegir otra
  const mobDone = await doneToday();
  const favs = await favorites();
  const routineId = pickedRoutine || (await suggestedRoutine());
  const R = ROUTINES[routineId];
  const ordered = Object.keys(ROUTINES).sort((a, b) => (favs.includes(b) ? 1 : 0) - (favs.includes(a) ? 1 : 0));
  const star = (on) => svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>', 22, 2, on ? 'fill="currentColor"' : '');
  const mobCard = `
    <div class="card" id="mob-home">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="eyebrow">Movilidad · ≈ ${routineMinutes(routineId)} min</span>
        ${mobDone.length ? '<span class="tag" style="background:var(--green-tint);color:var(--green)">Hecha hoy</span>' : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:20px;font-weight:800;line-height:1.15">${esc(R.name)}</span>
        <span class="muted small">${R.ids.length} ejercicios · ${esc(R.zone)}</span>
      </div>
      <button class="btn" id="mob-start" style="flex:none;color:var(--green);border-color:var(--green)">${svg('<path d="M8 5.5v13l11-6.5z"/>', 16, 2, 'fill="currentColor"')}${mobDone.length ? 'Hacer otra rutina' : 'Empezar movilidad'}</button>
      <details class="routines" id="routines" ${routinesOpen ? 'open' : ''}>
        <summary>Cambiar de rutina</summary>
        ${ordered.map((id) => `
          <div class="rrow">
            <button class="rpick" data-routine="${id}" aria-pressed="${id === routineId}"><strong>${esc(ROUTINES[id].name)}</strong><span class="muted small">${ROUTINES[id].ids.length} ejercicios · ≈ ${routineMinutes(id)} min</span></button>
            <button class="rfav" data-fav="${id}" aria-pressed="${favs.includes(id)}" aria-label="Favorita: ${esc(ROUTINES[id].name)}">${star(favs.includes(id))}</button>
          </div>`).join('')}
      </details>
    </div>`;

  // Tarjeta de aviso cuando hoy tiene marca y todavía no se ha decidido qué hacer con el gym
  let gate = '';
  if (!session) {
    if (kind === 'padel' && !choice) {
      gate = `<div class="card" id="gate">
        <span class="eyebrow">Hoy: pádel</span>
        <span style="font-size:20px;font-weight:800;line-height:1.2">¿Qué hacemos con ${PROGRAM[day].name}?</span>
        <p>${day === 'legs' ? 'Hoy toca Legs y el pádel castiga mucho las piernas: lo mejor es dejarlo para otro día.' : 'Un partido intenso cansa; puedes dejar la sesión o hacerla más corta.'}</p>
        <button class="btn" data-choice="skip" style="flex:none">Dejarla para otro día</button>
        <button class="btn" data-choice="light" style="flex:none">Versión ligera (una serie menos)</button>
        <button class="btn" data-choice="normal" style="flex:none">Entrenar normal</button>
      </div>`;
    } else if (kind === 'padel' && choice === 'skip') {
      gate = `<div class="card" id="gate"><span class="eyebrow">Hoy: pádel</span>
        <span style="font-size:20px;font-weight:800;line-height:1.2">Hoy solo pádel</span>
        <p>${PROGRAM[day].name} queda para el siguiente día de gimnasio; el ciclo no se descuadra.</p>
        <button class="btn" data-choice="" style="flex:none;min-height:48px">Cambiar de idea</button></div>`;
    } else if ((kind === 'oficina' || kind === 'descanso') && choice !== 'train') {
      gate = `<div class="card" id="gate"><span class="eyebrow">Hoy: ${KINDS[kind].label.toLowerCase()}</span>
        <span style="font-size:20px;font-weight:800;line-height:1.2">${kind === 'oficina' ? 'Hoy no toca levantar pesado' : 'Hoy descansas'}</span>
        <p>${kind === 'oficina' ? 'En oficina vale movilidad y cardio suave (caminar, correr o bici). El ciclo sigue donde estaba.' : 'Día libre. El ciclo sigue donde estaba.'}</p>
        <button class="btn" data-choice="train" style="flex:none;min-height:48px">Entrenar igualmente</button></div>`;
    }
  }
  // Tarjeta de sueño (Fitbit): solo si ya has conectado Google en Nutrición
  let sleepCard = '';
  const clientId = await getSetting('googleClientId');
  if (!session && !gate && clientId) {
    const sl = await getSetting('sleep');
    const fresh = sl && sl.date === localDate();
    const fmt = (m) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
    if (!fresh) {
      sleepCard = `<div class="card" id="sleep-card"><span class="eyebrow">Descanso · Fitbit</span>
        <p>Lee cuánto dormiste y la app te dirá si conviene la versión ligera.</p>
        <button class="btn" id="sleep-sync" style="flex:none;min-height:48px">Leer mi sueño de la Fitbit</button>
        <div class="msg" id="sleep-msg" role="status"></div></div>`;
    } else if (sl.minutes < LOW_SLEEP_MIN) {
      sleepCard = `<div class="card" id="sleep-card"><span class="eyebrow">Descanso · Fitbit</span>
        <span style="font-size:20px;font-weight:800;line-height:1.2">Dormiste ${fmt(sl.minutes)}</span>
        <p>Menos de 6 h: hoy rendirás menos y recuperas peor. Te sugiero la versión ligera (una serie menos por ejercicio).</p>
        ${choice === 'light' ? '<span class="tag" style="background:var(--green-tint);color:var(--green)">Versión ligera activada</span>'
          : '<button class="btn primary" data-choice="light" style="flex:none;min-height:48px">Usar versión ligera</button>'}</div>`;
    } else {
      sleepCard = `<div class="card" id="sleep-card"><span class="eyebrow">Descanso · Fitbit</span>
        <span style="font-size:20px;font-weight:800;line-height:1.2">Dormiste ${fmt(sl.minutes)}</span>
        <p>Buen descanso: sesión normal.</p></div>`;
    }
  }
  let deloadCard = '';
  if (!session && !gate) {
    if (dl.active) {
      deloadCard = `<div class="card" id="deload-card"><span class="eyebrow">Semana de descarga</span>
        <p>Hasta el ${new Date(dl.until + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}: una serie menos y un 15 % menos de peso, sin llegar al fallo. Así se recupera el cuerpo y luego se sube mejor.</p>
        <button class="btn" data-deload="off" style="flex:none;min-height:44px">Cancelar la descarga</button></div>`;
    } else if (dl.due) {
      deloadCard = `<div class="card" id="deload-card"><span class="eyebrow">Toca descarga</span>
        <span style="font-size:20px;font-weight:800;line-height:1.2">Llevas ${dl.weeks} semanas seguidas</span>
        <p>Una semana más suave (una serie menos y un 15 % menos de peso) deja que se disipe la fatiga acumulada y evita estancarte. Después sigues con tu progresión.</p>
        <button class="btn primary" data-deload="on" style="flex:none;min-height:48px">Empezar semana de descarga</button>
        <button class="btn" data-deload="snooze" style="flex:none;min-height:44px">Ahora no (preguntar en una semana)</button></div>`;
    }
  }
  const tomorrowNote = !session && !gate && day === 'legs' && tomorrowKind === 'padel'
    ? '<span class="tag" style="background:var(--tint)">Mañana tienes pádel: mejor deja Legs para otro día</span>' : '';

  host.innerHTML = `
    <div class="head"><span class="eyebrow">${esc(dateTxt)}</span><h1>Hoy</h1></div>
    ${weekStripHtml(w, weekTip(w, sessions, suggested))}
    ${mobCard}
    ${sleepCard}
    ${deloadCard}
    ${gate}
    ${gate ? '' : `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="eyebrow">${session ? 'Sesión en curso' : light ? 'Te toca · versión ligera' : 'Te toca'}</span>
        <span class="muted small">Bloque ${session ? session.variant : variant}</span>
      </div>
      ${tomorrowNote}
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:28px;font-weight:800;line-height:1.1">${PROGRAM[day].name}</span>
        <span class="muted small">${items.length} ejercicios · unos ${Math.round(items.length * 10.5 / 5) * 5} min${session ? ' · ' + done + ' series hechas' : ''}</span>
      </div>
      <div class="list" style="gap:0">
        ${(showAllEx ? items : items.slice(0, 3)).map((e) => `<div class="item" style="min-height:44px;font-size:15px"><span>${esc(e.name)}</span><span>${session ? e.sets : lightSets(e, light)} × ${e.reps[0]}-${e.reps[1]}</span></div>`).join('')}
        ${items.length > 3 ? `<button class="item" id="ex-more" style="min-height:44px;background:none;border:none;font-family:inherit;cursor:pointer;color:var(--ochre-text);font-weight:800;font-size:15px;text-align:left"><span>${showAllEx ? 'Ver menos' : '+ ' + (items.length - 3) + ' ejercicios más'}</span><span></span></button>` : ''}
      </div>
      ${session
        ? `<button class="btn primary" id="go" style="flex:none">Continuar sesión</button>
           ${session.reopened ? '' : '<button class="btn" id="discard" style="flex:none;min-height:44px;color:var(--coral);border-color:#E8B8B2">Descartar sesión</button>'}`
        : `<button class="btn primary" id="go" style="flex:none">${svg('<path d="M8 5.5v13l11-6.5z"/>', 18, 2, 'fill="#fff" stroke="#fff"')}Empezar sesión</button>`}
    </div>`}
    ${session || gate ? '' : `
    <div class="card">
      <span class="eyebrow">¿Otro día?</span>
      <div class="chips" role="group" aria-label="Elegir día">
        ${DAYS.map((d) => `<button class="chip" data-day="${d}" aria-pressed="${d === day}">${PROGRAM[d].name}</button>`).join('')}
      </div>
      <p>Por defecto te propone el siguiente día del ciclo Push, Pull, Legs. ${lastSession ? 'Última sesión: ' + PROGRAM[lastSession.day].name + ', ' + relDay(lastSession.finishedAt) + '.' : 'Aún no has registrado ninguna sesión.'}</p>
    </div>`}
`;
  host.querySelectorAll('[data-deload]').forEach((b) => b.addEventListener('click', async () => {
    const a = b.dataset.deload;
    if (a === 'on') await setSetting('deload', { until: addDays(localDate(), 6) });
    else if (a === 'off') { await setSetting('deload', null); await setSetting('lastDeload', localDate()); }
    else await setSetting('deloadSnooze', addDays(localDate(), 7));
    showToday();
  }));
  const sync = document.getElementById('sleep-sync');
  if (sync) {
    preloadGis();
    sync.addEventListener('click', async () => {
      const msg = document.getElementById('sleep-msg');
      msg.textContent = 'Conectando con Google…';
      const p = syncSleep(clientId); // dentro del toque, para que la ventana de Google no se bloquee
      p.catch(() => {});
      try {
        const r = await p;
        if (!r) { msg.textContent = 'Aún no hay sueño de esta noche en Google Health. Abre la app de Fitbit/Google Health para sincronizar y vuelve a probar.'; return; }
        await setSetting('sleep', r);
        showToday();
      } catch (e) { msg.textContent = 'No se pudo leer: ' + e.message; }
    });
  }
  const more = document.getElementById('ex-more');
  if (more) more.addEventListener('click', () => { showAllEx = !showAllEx; showToday(); });
  host.querySelectorAll('[data-date]').forEach((b) => b.addEventListener('click', () => openDaySheet(b.dataset.date, showToday)));
  host.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', async () => { await chooseToday(b.dataset.choice || null); showToday(); }));
  host.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { pickedDay = b.dataset.day; showToday(); }));
  document.getElementById('routines').addEventListener('toggle', (e) => { routinesOpen = e.target.open; });
  host.querySelectorAll('[data-routine]').forEach((b) => b.addEventListener('click', () => { pickedRoutine = b.dataset.routine; showToday(); }));
  host.querySelectorAll('[data-fav]').forEach((b) => b.addEventListener('click', async () => { await toggleFavorite(b.dataset.fav); showToday(); }));
  document.getElementById('mob-start').addEventListener('click', () => {
    startMobility(host, hooks, routineId, () => { pickedRoutine = null; showToday(); });
  });
  const goBtn = document.getElementById('go');
  if (goBtn) goBtn.addEventListener('click', async () => {
    if (!session) await startSession(day, light);
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

async function startSession(day, light = false) {
  const dl = await deloadInfo();
  if (dl.active) light = true;
  const variant = await programVariant();
  const items = sessionFor(day, variant);
  const sets = {};
  const targets = {};
  session = { id: Date.now(), day, variant, light, deload: dl.active, targets, startedAt: new Date().toISOString(), idx: 0, ids: items.map((e) => e.id), sets, restEnd: null, restTotal: 0 };
  for (const ex of items) {
    const last = await lastTime(ex.id);
    let sug = await suggestion(ex.id, ex);
    if (!sug && !last) sug = await firstTimeTarget(ex);
    if (sug) targets[ex.id] = sug;
    const lower = (w) => (dl.active && ex.carga !== 'peso-corporal' && w !== '' ? Math.max(0, round25(w * 0.85)) : w);
    if (dl.active && sug && ex.carga !== 'peso-corporal') targets[ex.id] = { kind: 'hold', weight: lower(sug.weight), text: `Descarga: ${fmtKg(lower(sug.weight))} kg, sin llegar al fallo` };
    sets[ex.id] = Array.from({ length: lightSets(ex, light) }, (_, i) => {
      const l = last && (last[i] || last[last.length - 1]);
      const st = !sug && !l && ex.start ? ex.start : null; // primera vez: valores de partida del ejercicio
      return { w: st ? st.w : lower(sug && ex.carga !== 'peso-corporal' ? sug.weight : l ? l.weight : ''), r: st ? st.r : l ? l.reps : '', done: false };
    });
  }
  await persist();
}

// Primera vez con un ejercicio: peso orientativo según tu peso corporal.
async function firstTimeTarget(ex) {
  if (ex.start || ex.carga === 'peso-corporal') return null;
  const w = startingWeight(ex.id, await bodyKg());
  if (!w) return null;
  return { kind: 'hold', weight: w, first: true, text: `Primera vez: prueba con unos ${fmtKg(w)} kg${ex.carga === 'mancuerna' ? ' en cada mano' : ''} y ajusta hasta dejar 3-4 reps en reserva` };
}

// Series de partida de un ejercicio: objetivo de progresión, última vez o valores iniciales.
async function initialSets(ex) {
  const last = await lastTime(ex.id);
  let sug = await suggestion(ex.id, ex);
  if (!sug && !last) sug = await firstTimeTarget(ex);
  const n = ex.sets;
  const sets = Array.from({ length: n }, (_, i) => {
    const l = last && (last[i] || last[last.length - 1]);
    const st = !sug && !l && ex.start ? ex.start : null;
    return { w: st ? st.w : sug && ex.carga !== 'peso-corporal' ? sug.weight : l ? l.weight : '', r: st ? st.r : l ? l.reps : '', done: false };
  });
  return { sets, sug };
}

// Añade un ejercicio al final de la sesión en curso y se va a él.
async function addExercise(id) {
  if (!session.ids.includes(id)) {
    const ex = { id, ...EXERCISES[id] };
    const { sets, sug } = await initialSets(ex);
    session.ids.push(id);
    session.sets[id] = sets;
    if (sug) session.targets[id] = sug;
  }
  session.idx = session.ids.indexOf(id);
  await persist();
  showTrain();
}

function pickExerciseDialog(opts = {}) {
  const { title = 'Añadir ejercicio', note = 'Se añade al final de la sesión de hoy.', onPick = addExercise, similarTo = null } = opts;
  const dlg = document.createElement('dialog');
  const muscleKey = (id) => (EXERCISES[id].muscle.split(/[ (]/)[0] || '').toLowerCase();
  const similar = similarTo ? Object.keys(EXERCISES).filter((x) => x !== similarTo && !session.ids.includes(x) && muscleKey(x) === muscleKey(similarTo)) : [];
  const item = (x) => `<button class="item" data-add="${x}" style="min-height:44px;width:100%;background:none;border:none;border-bottom:1px solid var(--line);font-family:inherit;font-size:15px;text-align:left;cursor:pointer"><span>${esc(EXERCISES[x].name)}</span><span class="muted small">${esc(EXERCISES[x].muscle)}</span></button>`;
  const groups = (similar.length ? `<h3 style="margin:10px 0 4px;font-size:15px">Del mismo músculo</h3>${similar.map(item).join('')}` : '') + DAYS.map((d) => {
    const ids = [...new Set(PROGRAM[d].slots.flat())].filter((x) => EXERCISES[x] && !session.ids.includes(x));
    return `<h3 style="margin:10px 0 4px;font-size:15px">${PROGRAM[d].name}</h3>` + ids.filter((x) => !similar.includes(x) && x !== similarTo).map(item).join('');
  }).join('');
  dlg.innerHTML = `<h2>${esc(title)}</h2><p>${esc(note)}</p><div style="max-height:55vh;overflow:auto">${groups}</div>
    <button class="btn" id="add-cancel" style="flex:none;min-height:48px;margin-top:10px">Cancelar</button>`;
  document.body.appendChild(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('cancel', () => dlg.remove());
  dlg.querySelector('#add-cancel').addEventListener('click', close);
  dlg.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', async () => { close(); await onPick(b.dataset.add); }));
  dlg.showModal();
}

// Reabre una sesión terminada (para añadir un ejercicio olvidado o corregir series).
async function dropLogs(exId) {
  const rows = await getByIndex('logs', 'exerciseId', exId);
  for (const r of rows) if (r.sessionId === session.id) await del('logs', r.id);
}
const doneCount = (id) => session.sets[id].filter((s) => s.done).length;

async function swapExercise(newId) {
  const old = session.ids[session.idx];
  await dropLogs(old);
  const ex = { id: newId, ...EXERCISES[newId] };
  const { sets, sug } = await initialSets(ex);
  delete session.sets[old];
  if (session.targets) delete session.targets[old];
  session.ids[session.idx] = newId;
  session.sets[newId] = sets;
  if (sug) session.targets[newId] = sug;
  await persist();
  showTrain();
}

function askSwap() {
  const old = session.ids[session.idx];
  if (doneCount(old) && !confirm('Este ejercicio ya tiene series hechas: se borrarán al cambiarlo. ¿Seguir?')) return;
  pickExerciseDialog({ title: 'Cambiar ejercicio', note: 'Sustituye a ' + EXERCISES[old].name + ' en esta sesión.', onPick: swapExercise, similarTo: old });
}

async function removeExercise() {
  if (session.ids.length <= 1) { alert('La sesión necesita al menos un ejercicio. Si quieres borrarla entera, quita antes el resto o usa otro ejercicio con "Cambiar ejercicio".'); return; }
  const id = session.ids[session.idx];
  if (!confirm(`¿Quitar "${EXERCISES[id].name}" de la sesión?${doneCount(id) ? ' Se borrarán sus series hechas.' : ''}`)) return;
  await dropLogs(id);
  session.ids.splice(session.idx, 1);
  delete session.sets[id];
  if (session.targets) delete session.targets[id];
  session.idx = Math.min(session.idx, session.ids.length - 1);
  await persist();
  showTrain();
}

let returnTo = null; // al terminar una edición desde el Historial, vuelve allí
export async function editSession(container, h, rec, back) {
  host = container;
  hooks = h || {};
  const active = await getSetting('activeSession');
  if (active) { toast('Primero termina o descarta la sesión en curso (pestaña Hoy).'); return false; }
  returnTo = back || null;
  await reopenSession(rec);
  return true;
}

// Ejercicios que cambié de nombre: los entrenos antiguos con estos ids se pasan a los nuevos.
const LEGACY = { 'pec-deck-inverso': 'pajaros-mancuernas', 'curl-muneca-barra': 'curl-muneca-espalda' };

async function reopenSession(rec) {
  const ids = [];
  for (const old of rec.ids) {
    const id = LEGACY[old] || old;
    if (id !== old) {
      for (const r of await getByIndex('logs', 'exerciseId', old)) if (r.sessionId === rec.id) { await del('logs', r.id); await put('logs', { ...r, id: `${r.sessionId}-${id}-${r.setIndex}`, exerciseId: id }); }
    }
    if (EXERCISES[id] && !ids.includes(id)) ids.push(id); // ids que ya no existen se ignoran
  }
  rec = { ...rec, ids };
  const sets = {};
  const targets = {};
  for (const id of rec.ids) {
    const rows = (await getByIndex('logs', 'exerciseId', id)).filter((r) => r.sessionId === rec.id).sort((a, b) => a.setIndex - b.setIndex);
    const ex = { id, ...EXERCISES[id] };
    sets[id] = rows.length ? rows.map((r) => ({ w: r.weight, r: r.reps, done: true })) : (await initialSets(ex)).sets;
  }
  session = { id: rec.id, day: rec.day, variant: rec.variant, light: false, reopened: true, finishedAt: rec.finishedAt, targets, startedAt: rec.startedAt, idx: rec.ids.length - 1, ids: [...rec.ids], sets, restEnd: null, restTotal: 0 };
  await persist();
  summary = null;
  view = 'train';
  showTrain();
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
  keepAwake();
  const id = session.ids[session.idx];
  const ex = EXERCISES[id];
  const sets = session.sets[id];
  const last = lastLabel(await lastTime(id));
  const isLast = session.idx === session.ids.length - 1;
  const rest = restFor(ex);

  host.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="eyebrow">${PROGRAM[session.day].name} · ejercicio ${session.idx + 1} de ${session.ids.length}</span>
        ${session.reopened ? '' : `<span class="muted small" id="elapsed">${elapsedMin()} min</span>`}
      </div>
      <div class="seg">${session.ids.map((_, i) => `<i class="${i <= session.idx ? 'on' : ''}"></i>`).join('')}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <h1 style="font-size:28px">${esc(ex.name)}</h1>
      <span class="muted" style="font-size:15px">${esc(ex.equip)} · ${sets.length} series · ${ex.reps[0]}-${ex.reps[1]} reps · 3-4 en reserva</span>
    </div>
    ${ex.tecnica ? '<span class="tag">Aprende primero la técnica con poco peso</span>' : ''}
    <div class="row">
      <button class="mini" id="how">${svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9"/><path d="M12 17.4v.1"/>', 18, 2)}Cómo se hace</button>
      <a class="mini" href="${videoUrl(id)}" target="_blank" rel="noopener">${svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 9.5l4 2.5-4 2.5z"/>', 18, 2)}Ver vídeo</a>
    </div>
    ${(session.targets || {})[id] ? `<div class="lastline target ${session.targets[id].kind}">${svg('<path d="M12 19V6M6 11l6-6 6 6"/>', 16, 2.4)}<span><strong>${esc(session.targets[id].text)}</strong></span></div>` : ''}
    ${last ? `<div class="lastline">${svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', 16, 2)}<span>La última vez: <strong>${esc(last)}</strong></span></div>` : ((session.targets || {})[id] ? '' : '<div class="lastline muted">Primera vez con este ejercicio: empieza con un peso que te deje 3-4 repeticiones en reserva.</div>')}
    ${warmupHtml(id, sets)}
    <div style="display:flex;flex-direction:column;gap:10px" id="sets">
      ${sets.map((s, i) => `
        <div class="setrow ${s.done ? 'done' : ''}">
          <div class="n">${i + 1}</div>
          <label class="inp wk"><input inputmode="decimal" enterkeyhint="done" autocomplete="off" aria-label="Peso de la serie ${i + 1}" data-k="w" data-i="${i}" value="${s.w === '' ? '' : fmtKg(s.w)}" placeholder="0"><span>kg</span></label>
          <label class="inp rp"><input inputmode="numeric" enterkeyhint="done" autocomplete="off" aria-label="Repeticiones de la serie ${i + 1}" data-k="r" data-i="${i}" value="${s.r}" placeholder="0"><span>rep</span></label>
          <button class="hecha" data-toggle="${i}" aria-pressed="${s.done}">${s.done ? svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 3) : ''}Hecha</button>
        </div>`).join('')}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="mini" id="add-set" style="flex:none">${svg('<path d="M12 5v14M5 12h14"/>', 16, 2.5)}Añadir serie</button>
        <button class="mini" id="add-ex" style="flex:none">${svg('<path d="M12 5v14M5 12h14"/>', 16, 2.5)}Añadir ejercicio</button>
        <button class="mini" id="swap-ex" style="flex:none">${svg('<path d="M7 7h11l-3-3M17 17H6l3 3"/>', 16, 2.2)}Cambiar ejercicio</button>
        <button class="mini" id="del-ex" style="flex:none;color:var(--coral);border-color:#E8B8B2">${svg('<path d="M6 6l12 12M18 6L6 18"/>', 16, 2.5)}Quitar ejercicio</button>
      </div>
    </div>
    <div class="card" style="gap:10px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span class="eyebrow">Descanso · ${rest === 150 ? 'ejercicio pesado' : 'ejercicio ligero'}</span>
          <span id="rest-time" style="font-size:34px;font-weight:800;line-height:1">${fmtClock(rest)}</span>
        </div>
        <button class="mini" id="skip" style="flex:none">Saltar</button>
      </div>
      <div class="bar"><div id="rest-bar" style="width:0%"></div></div>
      ${session.reopened ? '' : `<div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--line, #E7DFD0);padding-top:8px">
        <span class="eyebrow">Tiempo total</span>
        <span id="total-time" style="font-size:20px;font-weight:800;font-variant-numeric:tabular-nums">${fmtTotal(Date.now() - new Date(session.startedAt))}</span>
      </div>`}
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
  document.getElementById('add-ex').addEventListener('click', () => pickExerciseDialog());
  document.getElementById('swap-ex').addEventListener('click', askSwap);
  document.getElementById('del-ex').addEventListener('click', removeExercise);
  document.getElementById('skip').addEventListener('click', () => { endRest(false); });
  document.getElementById('prev').addEventListener('click', async () => {
    if (session.idx === 0) {
      view = 'today';
      if (session.reopened) { await persist(); const r = returnTo; returnTo = null; if (r) return r(); }
      showToday();
      return;
    }
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
      toast(s.w !== '' && !(s.r > 0) ? 'Escribe las repeticiones.' : 'Escribe el peso y las repeticiones.');
      return;
    }
    s.done = true;
    await writeLog(exId, i);
    const rest = restFor(EXERCISES[exId]);
    session.restTotal = rest;
    session.restEnd = Date.now() + rest * 1000;
    if (await getSetting('restSound', true)) unlockAudio();
  } else {
    s.done = false;
    await del('logs', `${session.id}-${exId}-${i}`);
  }
  await persist();
  showTrain();
}

// ---------- Temporizador de descanso ----------
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
  const tt = document.getElementById('total-time');
  if (tt) tt.textContent = fmtTotal(Date.now() - new Date(session.startedAt));
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
  const rest = session.restTotal || DEFAULT_REST;
  const t = document.getElementById('rest-time');
  const bar = document.getElementById('rest-bar');
  if (t) { t.textContent = fmtClock(rest); t.classList.remove('live'); }
  if (bar) bar.style.width = '0%';
  if (alert) {
    toast('Descanso terminado. A por la siguiente serie.');
    flashCard(t && t.closest('.card'));
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    if (await getSetting('restSound', true)) beep();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && view === 'train' && session) { keepAwake(); tick(); }
});

// ---------- Terminar ----------
async function finishSession() {
  const setsDone = Object.values(session.sets).flat().filter((s) => s.done).length;
  if (setsDone === 0 && !confirm('No has marcado ninguna serie como hecha. ¿Terminar la sesión igualmente?')) return;
  const finishedAt = session.finishedAt || new Date().toISOString();
  const rec = { id: session.id, day: session.day, variant: session.variant, startedAt: session.startedAt, finishedAt, setsDone, ids: session.ids };
  await put('sessions', rec);
  if (!session.reopened) await setSetting('lastDay', session.day);
  const ups = [];
  for (const id of rec.ids) {
    const sg = await suggestion(id, EXERCISES[id]);
    if (sg && sg.kind === 'up') ups.push({ name: EXERCISES[id].name, text: sg.text });
  }
  summary = { ...rec, ups, minutes: Math.max(1, Math.round((new Date(finishedAt) - new Date(session.startedAt)) / 60000)) };
  session = null;
  await setSetting('activeSession', null);
  stopTimer();
  releaseAwake();
  view = 'done';
  showDone();
}

function showDone() {
  hooks.immersive && hooks.immersive(false);
  if (!summary) { view = 'today'; return showToday(); }
  host.innerHTML = `
    <div class="head"><span class="eyebrow">${PROGRAM[summary.day].name} · bloque ${summary.variant}</span><h1>Sesión terminada</h1></div>
    <div class="status"><div class="dot">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 3, 'stroke="#fff"')}</div>
      <div><strong>Buen trabajo</strong><span>Tus series ya están guardadas en el historial.</span></div></div>
    <div class="card list">
      <div class="item"><span>Duración</span><span>${summary.minutes} min</span></div>
      <div class="item"><span>Series hechas</span><span>${summary.setsDone}</span></div>
      <div class="item"><span>Ejercicios</span><span>${summary.ids.length}</span></div>
    </div>
    ${summary.ups && summary.ups.length ? `<div class="card"><span class="eyebrow">Próxima vez subes</span><div class="list" style="gap:0">${summary.ups.map((u) => `<div class="item" style="min-height:44px;font-size:15px"><span>${esc(u.name)}</span></div><div class="muted small" style="padding:0 0 8px">${esc(u.text)}</div>`).join('')}</div></div>` : ''}
    <div style="flex-grow:1"></div>
    <button class="btn primary" id="back-today" style="flex:none">Volver a Hoy</button>`;
  document.getElementById('back-today').addEventListener('click', () => { summary = null; view = 'today'; if (returnTo) { const r = returnTo; returnTo = null; r(); } else showToday(); });
}
