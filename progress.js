// Progresión de cargas: doble progresión por repeticiones.
// Si completas todas las series en el tope del rango, la próxima vez sube peso.
// Si no llegas al mínimo del rango dos sesiones seguidas, baja un escalón.
// Si no, mantienes el peso e intentas una repetición más.
import { getByIndex } from './db.js';

import { fmt, nextAbove, prevBelow, rig } from './loads.js';
export { fmt };

// Últimas sesiones de un ejercicio, de más reciente a más antigua: [[filas de la sesión]]
async function recentSessions(exId, excludeId, n = 2) {
  const rows = (await getByIndex('logs', 'exerciseId', exId)).filter((r) => r.sessionId !== excludeId);
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.sessionId)) by.set(r.sessionId, []);
    by.get(r.sessionId).push(r);
  }
  return [...by.entries()].sort((a, b) => b[0] - a[0]).slice(0, n).map(([, v]) => v.sort((a, b) => a.setIndex - b.setIndex));
}

// Qué hacer hoy con este ejercicio. Devuelve null si es la primera vez.
// { kind: 'up'|'down'|'hold', weight, text (titular), lines (detalle) }
export async function suggestion(exId, ex, excludeId = null) {
  const sessions = await recentSessions(exId, excludeId);
  if (!sessions.length) return null;
  ex = { id: exId, ...ex };
  const [lo, hi] = ex.reps;
  const last = sessions[0];
  const top = Math.max(...last.map((r) => r.weight));
  const at = last.filter((r) => r.weight === top);
  const need = Math.max(2, Math.min(ex.sets, 3));
  const bodyweight = ex.carga === 'peso-corporal';
  const lastTxt = last.map((r) => `${fmt(r.weight)}×${r.reps}`).join(', ');
  const goal = `${ex.sets} series de ${lo}-${hi} reps, 3-4 en reserva`;

  const allTop = at.length >= Math.min(need, ex.sets) && at.every((r) => r.reps >= hi);
  if (allTop) {
    if (bodyweight) return { kind: 'up', weight: top, text: 'Hoy: más difícil', lines: [`Por qué: llegaste a ${hi} reps en todas las series.`, 'Qué hacer: añade lastre o una variante más difícil y vuelve al rango bajo.', `Objetivo: ${goal}.`] };
    const w = nextAbove(ex, top);
    const how = rig(ex, w);
    return { kind: 'up', weight: w, text: `Hoy: sube a ${fmt(w)} kg`, lines: [
      `Por qué: la última vez hiciste ${hi} reps en todas las series con ${fmt(top)} kg (${lastTxt}).`,
      `Objetivo: ${goal}. Con más peso es normal bajar a ${lo}-${lo + 2} reps.`,
      ...(how ? [`Cómo montarlo: ${how}.`] : []),
      `Si no llegas a ${lo} reps en la primera serie, baja a ${fmt(top)} kg.`
    ] };
  }
  const low = (s) => s.some((r) => r.reps < lo);
  if (sessions[1] && low(last) && low(sessions[1]) && !bodyweight) {
    const prevTop = Math.max(...sessions[1].map((r) => r.weight));
    if (top <= prevTop) {
      const w = prevBelow(ex, top);
      const how = rig(ex, w);
      return { kind: 'down', weight: w, text: `Hoy: baja a ${fmt(w)} kg`, lines: [
        `Por qué: dos sesiones seguidas sin llegar a ${lo} reps con ${fmt(top)} kg.`,
        `Objetivo: ${goal}, sin ir al fallo, para recuperar y volver a subir.`,
        ...(how ? [`Cómo montarlo: ${how}.`] : [])
      ] };
    }
  }
  const best = Math.max(...at.map((r) => r.reps));
  const next = Math.min(hi, best + 1);
  const how = bodyweight ? '' : rig(ex, top);
  return { kind: 'hold', weight: top, text: bodyweight ? `Hoy: ${next} reps en cada serie` : `Hoy: mantén ${fmt(top)} kg`, lines: [
    `Última vez: ${lastTxt}.`,
    `Objetivo: ${next} reps en cada serie${bodyweight ? '' : ` (tu techo es ${hi}: al llegar en todas, subes)`}.`,
    ...(how ? [`Cómo montarlo: ${how}.`] : []),
    'Si te sobra, añade una repetición; si no llegas, quédate donde estás.'
  ] };
}
