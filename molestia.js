// Modo "tengo una molestia": quita del plan los ejercicios que cargan una zona hasta que lo desactives.
import { EXERCISES } from './exercises.js';
import { getSetting, setSetting } from './db.js';

export const ZONES = {
  'isquio-gluteo': 'Isquio o glúteo',
  rodilla: 'Rodilla',
  hombro: 'Hombro',
  muneca: 'Muñeca o antebrazo',
  'espalda-baja': 'Espalda baja'
};

// Zonas que carga un ejercicio (por músculo trabajado y por tipo de movimiento).
export function zonesOf(id) {
  const ex = EXERCISES[id];
  if (!ex) return [];
  const z = [];
  const m = ex.muscle || '';
  if (/isquio|glúteo/i.test(m)) z.push('isquio-gluteo');
  if (/cuádriceps/i.test(m)) z.push('rodilla');
  if (/hombro|pecho/i.test(m)) z.push('hombro');
  if (/antebrazo|bíceps|tríceps/i.test(m)) z.push('muneca');
  if (/remo|peso-muerto|hip-thrust|zancadas/.test(id)) z.push('espalda-baja');
  return z;
}

export const affected = (id, zones) => zonesOf(id).some((z) => (zones || []).includes(z));

export async function getMolestia() {
  const m = await getSetting('molestia');
  return m && m.zones && m.zones.length ? m : null;
}
export const setMolestia = (zones) => setSetting('molestia', zones && zones.length ? { zones, since: new Date().toISOString() } : null);
