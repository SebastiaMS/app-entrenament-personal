// Cómo se carga cada tipo de máquina en tu gimnasio y qué pesos son realmente posibles.
//  - 'pin6': pila con saltos de 6 kg (pec deck, remo, jalón). Se afina con mancuernas de 2,5 kg encima (0, 2,5 o 5 kg extra).
//  - 'discs': máquinas de discos sueltos de 2,5 a 20 kg.
//  - 'cable5': poleas con saltos de 5 kg.
//  - el resto: el escalón de cada tipo de carga (mancuernas 2,5 kg).
const PIN6 = new Set(['pec-deck', 'jalon-pecho', 'jalon-convergente', 'remo-sentado-polea']);
// Remo en máquina y remo en T: se cargan con discos (los hay de 2,5 a 20 kg), así que el escalón es de 2,5 kg.
const DISCS = new Set(['remo-maquina', 'remo-t-apoyo-pecho']);
const CABLE5 = new Set(['cruces-polea', 'elevaciones-laterales-polea', 'extension-triceps-polea', 'encogimiento-polea', 'face-pull', 'curl-polea', 'curl-martillo-cuerda', 'pullover-polea']);
const STEP = { mancuerna: 2.5, polea: 5, smith: 2.5, barra: 2.5, maquina: 5, discos: 5 };
const DUMBBELL_EXTRA = [0, 2.5, 5];

export const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

export function kindOf(ex) {
  if (PIN6.has(ex.id)) return 'pin6';
  if (CABLE5.has(ex.id)) return 'cable5';
  if (DISCS.has(ex.id)) return 'discs';
  return 'normal';
}

export function stepOf(ex) {
  const k = kindOf(ex);
  if (k === 'pin6') return 2.5; // el mínimo realista con mancuernas encima
  if (k === 'cable5') return 5;
  if (k === 'discs') return 2.5;
  return STEP[ex.carga] || 2.5;
}

// Pesos posibles cerca de w (ordenados).
function options(ex, w) {
  const k = kindOf(ex);
  const out = [];
  if (k === 'pin6') {
    for (let pin = 0; pin <= Math.max(6, w + 12); pin += 6) for (const e of DUMBBELL_EXTRA) if (pin + e > 0) out.push(pin + e);
  } else {
    const st = k === 'cable5' ? 5 : k === 'discs' ? 2.5 : (STEP[ex.carga] || 2.5);
    for (let x = st; x <= Math.max(st, w + 3 * st); x += st) out.push(x);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export const nearest = (ex, w) => options(ex, w).reduce((b, x) => (Math.abs(x - w) < Math.abs(b - w) ? x : b), options(ex, w)[0]);
export const nextAbove = (ex, w) => options(ex, w + 20).find((x) => x >= w + stepOf(ex) - 1e-9) ?? w + stepOf(ex);
export const prevBelow = (ex, w) => [...options(ex, w)].reverse().find((x) => x <= w - stepOf(ex) + 1e-9) ?? Math.max(0, w - stepOf(ex));

// Cómo montar el peso w en esa máquina (texto corto) o '' si no hace falta.
export function rig(ex, w) {
  const k = kindOf(ex);
  if (k === 'pin6') {
    const pin = Math.floor(w / 6) * 6;
    const extra = Math.round((w - pin) * 10) / 10;
    return extra > 0 ? `Pila en ${fmt(pin)} kg + mancuerna de ${fmt(extra)} kg encima` : `Pila en ${fmt(pin)} kg`;
  }
  if (k === 'cable5') return `Clavija en ${fmt(w)} kg (saltos de 5)`;
  if (k === 'discs') return `Discos hasta sumar ${fmt(w)} kg (los hay de 2,5 a 20 kg)`;
  if (ex.carga === 'mancuerna') return `Mancuernas de ${fmt(w)} kg cada una`;
  return '';
}
