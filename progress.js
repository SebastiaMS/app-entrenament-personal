// Progresión de cargas: doble progresión por repeticiones.
// Si completas todas las series en el tope del rango, la próxima vez sube peso.
// Si no llegas al mínimo del rango dos sesiones seguidas, baja un escalón.
// Si no, mantienes el peso e intentas una repetición más.
import { getByIndex } from './db.js';

// Escalón de subida (kg) según el tipo de carga. Si tu máquina no tiene un paso tan pequeño, usa el siguiente disponible.
const STEP = { mancuerna: 2.5, polea: 2.5, smith: 2.5, barra: 2.5, maquina: 5, discos: 5 };

export const fmt = (n) => String(n).replace('.', ',');

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
// { kind: 'up'|'down'|'hold'|'reps', weight, text }
export async function suggestion(exId, ex, excludeId = null) {
  const sessions = await recentSessions(exId, excludeId);
  if (!sessions.length) return null;
  const [lo, hi] = ex.reps;
  const last = sessions[0];
  const top = Math.max(...last.map((r) => r.weight));
  const at = last.filter((r) => r.weight === top);
  const need = Math.max(2, Math.min(ex.sets, 3) - 0);
  const bodyweight = ex.carga === 'peso-corporal';

  const allTop = at.length >= Math.min(need, ex.sets) && at.every((r) => r.reps >= hi);
  if (allTop) {
    if (bodyweight) return { kind: 'up', weight: top, text: `Llegaste a ${hi} reps en todas: añade lastre o una variante más difícil` };
    const step = STEP[ex.carga] || 2.5;
    return { kind: 'up', weight: top + step, text: `Subes a ${fmt(top + step)} kg: completaste ${hi} reps en todas las series` };
  }
  const low = (s) => s.some((r) => r.reps < lo);
  if (sessions[1] && low(last) && low(sessions[1]) && !bodyweight) {
    const prevTop = Math.max(...sessions[1].map((r) => r.weight));
    if (top <= prevTop) {
      const step = STEP[ex.carga] || 2.5;
      const w = Math.max(0, top - step);
      return { kind: 'down', weight: w, text: `Dos sesiones sin llegar a ${lo} reps: baja a ${fmt(w)} kg y recupera` };
    }
  }
  const best = Math.max(...at.map((r) => r.reps));
  const goal = Math.min(hi, best + 1);
  return { kind: 'hold', weight: top, text: bodyweight ? `Intenta ${goal} reps en cada serie` : `Mantén ${fmt(top)} kg e intenta ${goal} reps en cada serie` };
}
