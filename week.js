// Calendario: tira de la semana (lunes a domingo) con lo hecho y las marcas de oficina / pádel / descanso.
import { del, getAll, put } from './db.js';
import { esc, localDate } from './util.js';

export const KINDS = {
  oficina: { label: 'Oficina', short: 'OF', hint: 'Sin pesas; movilidad y cardio suave' },
  padel: { label: 'Pádel', short: 'PÁ', hint: 'Partido: la app te preguntará qué hacer con el gym' },
  descanso: { label: 'Descanso', short: 'DE', hint: 'Día libre, sin entrenar' }
};

const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function mondayOf(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

export async function getMark(date) {
  const rows = await getAll('schedule');
  const r = rows.find((x) => x.date === date);
  return r ? r.kind : null;
}

export async function setMark(date, kind) {
  if (!kind) return del('schedule', date);
  return put('schedule', { date, kind });
}

// Semanas (lunes a domingo) con 3 o más sesiones terminadas, seguidas. La semana en curso suma si ya llegó a 3.
export const WEEK_GOAL = 3;
export function streakOf(sessions, now = new Date()) {
  const per = new Map();
  for (const s of sessions) {
    if (!s.finishedAt) continue;
    const k = localDate(mondayOf(new Date(s.finishedAt)));
    per.set(k, (per.get(k) || 0) + 1);
  }
  const cur = mondayOf(now);
  let streak = 0;
  const d = new Date(cur);
  if ((per.get(localDate(d)) || 0) < WEEK_GOAL) d.setDate(d.getDate() - 7);
  while ((per.get(localDate(d)) || 0) >= WEEK_GOAL) { streak++; d.setDate(d.getDate() - 7); }
  return streak;
}

// Resumen de una semana: sesiones, series, volumen (kg) y días de movilidad.
export async function weekSummary(ref = new Date()) {
  const start = mondayOf(ref);
  const dates = new Set(Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return localDate(d); }));
  const [sessions, logs, mob] = await Promise.all([getAll('sessions'), getAll('logs'), getAll('mobility')]);
  const l = logs.filter((x) => dates.has(x.date));
  return {
    sessions: sessions.filter((s) => s.finishedAt && dates.has(localDate(new Date(s.finishedAt)))).length,
    sets: l.length,
    volume: Math.round(l.reduce((a, x) => a + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0)),
    mobDays: new Set(mob.filter((m) => dates.has(m.date)).map((m) => m.date)).size
  };
}

// Datos de la semana que contiene `ref`.
export async function weekData(ref = new Date()) {
  const start = mondayOf(ref);
  const [marks, sessions, mob] = await Promise.all([getAll('schedule'), getAll('sessions'), getAll('mobility')]);
  const today = localDate();
  const gymDates = new Set(sessions.filter((s) => s.finishedAt).map((s) => localDate(new Date(s.finishedAt))));
  const mobDates = new Set(mob.map((m) => m.date));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = localDate(d);
    const kind = (marks.find((x) => x.date === date) || {}).kind || null;
    const weekday = i < 5;
    days.push({
      date, i, num: d.getDate(), letter: LETTERS[i], kind, weekday,
      isToday: date === today, past: date < today,
      gym: gymDates.has(date), mob: mobDates.has(date),
      // día laborable en el que toca movilidad: no cuenta en oficina
      mobDue: weekday && kind !== 'oficina'
    });
  }
  const mobDue = days.filter((d) => d.mobDue && (d.past || d.isToday));
  return {
    days,
    streak: streakOf(sessions),
    gymCount: days.filter((d) => d.gym).length,
    mobDone: mobDue.filter((d) => d.mob).length,
    mobTotal: mobDue.length
  };
}

// Consejo del día (solo orientativo): cardio suave y pádel según lo que llevas.
// sessions: sesiones terminadas; nextDay: día del ciclo que toca (push|pull|legs)
export function weekTip(w, sessions, nextDay) {
  const today = w.days.find((d) => d.isToday);
  if (!today) return null;
  if (today.kind === 'oficina') return 'Hoy es oficina: buen día para movilidad y cardio suave (caminar, bici o correr), sin pesas.';
  if (today.kind === 'padel' || today.kind === 'descanso') return null;
  const done = sessions.filter((s) => s.finishedAt);
  const lastLegs = done.filter((s) => s.day === 'legs').sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))[0];
  const hoursSinceLegs = lastLegs ? (Date.now() - new Date(lastLegs.finishedAt)) / 3600000 : Infinity;
  const tIdx = w.days.indexOf(today);
  const tomorrow = tIdx < 6 ? w.days[tIdx + 1] : null;
  const padelThisWeek = w.days.some((d) => d.kind === 'padel');
  if (!today.gym && hoursSinceLegs < 48) return 'Las piernas aún están cargadas de Legs: mejor no jugar pádel hoy; cardio suave sí.';
  if (!today.gym && !padelThisWeek && w.gymCount >= 2 && nextDay !== 'legs' && hoursSinceLegs >= 48) return 'Hoy encaja un pádel si te apetece: llevas ' + w.gymCount + ' sesiones esta semana y las piernas ya descansaron. Márcalo arriba para que la app lo tenga en cuenta.';
  if (!today.gym && w.gymCount >= 3) return 'Semana de gimnasio completa. Hoy: movilidad y cardio suave si quieres moverte.';
  if (today.gym && tomorrow && tomorrow.kind === 'padel') return 'Mañana tienes pádel: hoy descansa bien y evita machacar las piernas.';
  return null;
}

export function weekStripHtml(w, tip) {
  const cells = w.days.map((d) => {
    const dots = [
      d.gym ? '<i class="wd gym" title="Gimnasio"></i>' : '',
      d.mob ? '<i class="wd mob" title="Movilidad"></i>' : (d.mobDue && d.past ? '<i class="wd miss" title="Sin movilidad"></i>' : '')
    ].join('');
    return `<button class="wcell ${d.isToday ? 'today' : ''} ${d.kind ? 'k-' + d.kind : ''}" data-date="${d.date}" aria-label="${esc(d.letter + ' ' + d.num + (d.kind ? ', ' + KINDS[d.kind].label : ''))}">
      <span class="wl">${d.letter}</span>
      <span class="wn">${d.num}</span>
      <span class="wdots">${dots}</span>
      <span class="wk">${d.kind ? KINDS[d.kind].short : ''}</span>
    </button>`;
  }).join('');
  const mobTxt = w.mobTotal ? `Movilidad ${w.mobDone} de ${w.mobTotal} días` : 'Movilidad: aún sin días';
  return `
    <div class="card" id="week">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="eyebrow">Esta semana</span>
        <span class="muted small">Toca un día para marcarlo</span>
      </div>
      <div class="wstrip">${cells}</div>
      <div class="wleg"><span><i class="wd gym"></i>Gimnasio ${w.gymCount}</span><span><i class="wd mob"></i>${esc(mobTxt)}</span></div>
      ${w.streak ? `<div class="muted small" style="font-weight:700">Racha: ${w.streak} semana${w.streak === 1 ? '' : 's'} seguida${w.streak === 1 ? '' : 's'} con ${WEEK_GOAL} sesiones</div>` : ''}
      ${tip ? `<div class="lastline" id="week-tip" style="align-items:flex-start"><span>${esc(tip)}</span></div>` : ''}
    </div>`;
}

// Hoja para marcar un día. `onChange` se llama al guardar.
export async function openDaySheet(date, onChange) {
  const w = await weekData(new Date(date + 'T12:00:00'));
  const d = w.days.find((x) => x.date === date);
  const title = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `
    <h2 style="text-transform:capitalize">${esc(title)}</h2>
    <p>${[d.gym ? 'Entrenaste' : '', d.mob ? 'Hiciste movilidad' : ''].filter(Boolean).join(' · ') || 'Sin registros este día.'}</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${Object.entries(KINDS).map(([k, v]) => `
        <button class="btn daykind" data-kind="${k}" aria-pressed="${d.kind === k}" style="flex:none;min-height:52px;justify-content:flex-start;text-align:left;gap:12px">
          <strong style="min-width:76px">${v.label}</strong><span class="muted small">${esc(v.hint)}</span>
        </button>`).join('')}
      ${d.kind ? '<button class="btn" data-kind="" style="flex:none;min-height:48px;color:var(--coral);border-color:#E8B8B2">Quitar marca</button>' : ''}
      <button class="btn" id="day-close" style="flex:none;min-height:48px">Cerrar</button>
    </div>`;
  document.body.appendChild(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('cancel', () => dlg.remove());
  dlg.querySelector('#day-close').addEventListener('click', close);
  dlg.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', async () => {
    const kind = b.dataset.kind;
    await setMark(date, kind === d.kind ? null : kind || null);
    close();
    onChange && onChange();
  }));
  dlg.showModal();
}

// Pestaña Semana: esta semana y la siguiente, para marcar oficina o pádel con antelación.
export async function renderWeek(container) {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  const prev = new Date();
  prev.setDate(prev.getDate() - 7);
  const [a, b, sumNow, sumPrev] = await Promise.all([weekData(), weekData(next), weekSummary(), weekSummary(prev)]);
  const fmtN = (n) => n.toLocaleString('es-ES');
  const row = (label, k, unit = '') => `<div class="item" style="min-height:40px;font-size:15px"><span>${label}</span><span><strong>${fmtN(sumNow[k])}${unit}</strong> <span class="muted small">${sumPrev[k] ? 'antes ' + fmtN(sumPrev[k]) + unit : ''}</span></span></div>`;
  const summaryCard = `
    <div class="card" id="week-summary">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="eyebrow">Resumen de esta semana</span>
        <span class="muted small">frente a la anterior</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:28px;font-weight:800;line-height:1.1">${a.streak} ${a.streak === 1 ? 'semana' : 'semanas'}</span>
        <span class="muted small">de racha con ${WEEK_GOAL} sesiones${a.streak ? '' : ': empieza esta semana'}</span>
      </div>
      <div class="list" style="gap:0">
        ${row('Sesiones', 'sessions')}${row('Series hechas', 'sets')}${row('Volumen total', 'volume', ' kg')}${row('Días de movilidad', 'mobDays')}
      </div>
    </div>`;
  const strip = (w, title) => weekStripHtml(w).replace('Esta semana', title).replace('id="week"', '');
  container.innerHTML = `
    <div class="head"><span class="eyebrow">Calendario</span><h1>Semana</h1></div>
    ${summaryCard}
    ${strip(a, 'Esta semana')}
    ${strip(b, 'La semana que viene')}
    <p class="muted small" style="margin:0">Marca con antelación tus días de oficina o pádel. Los días de oficina no cuentan para la movilidad y no se proponen pesas. El ciclo Push, Pull, Legs sigue donde estaba.</p>`;
  container.querySelectorAll('[data-date]').forEach((el) => el.addEventListener('click', () => openDaySheet(el.dataset.date, () => renderWeek(container))));
}
