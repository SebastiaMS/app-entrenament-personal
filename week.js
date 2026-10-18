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
    gymCount: days.filter((d) => d.gym).length,
    mobDone: mobDue.filter((d) => d.mob).length,
    mobTotal: mobDue.length
  };
}

export function weekStripHtml(w) {
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
  const [a, b] = await Promise.all([weekData(), weekData(next)]);
  const strip = (w, title) => weekStripHtml(w).replace('Esta semana', title).replace('id="week"', '');
  container.innerHTML = `
    <div class="head"><span class="eyebrow">Calendario</span><h1>Semana</h1></div>
    ${strip(a, 'Esta semana')}
    ${strip(b, 'La semana que viene')}
    <p class="muted small" style="margin:0">Marca con antelación tus días de oficina o pádel. Los días de oficina no cuentan para la movilidad y no se proponen pesas. El ciclo Push, Pull, Legs sigue donde estaba.</p>`;
  container.querySelectorAll('[data-date]').forEach((el) => el.addEventListener('click', () => openDaySheet(el.dataset.date, () => renderWeek(container))));
}
