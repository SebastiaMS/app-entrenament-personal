// Pesos de partida orientativos para la primera vez con un ejercicio.
// Son proporciones del peso corporal pensadas para dejar 3-4 repeticiones en reserva a una persona
// que vuelve al gimnasio: prudentes a propósito (mejor subir pronto que empezar pasado).
// En mancuernas es el peso de cada mancuerna.
import { getAll } from './db.js';

export const RATIO = {
  'press-inclinado-mancuernas': 0.14, 'press-plano-smith': 0.35, 'press-pecho-maquina': 0.35, 'press-plano-mancuernas': 0.16,
  'pec-deck': 0.30, 'cruces-polea': 0.08,
  'press-hombro-mancuernas': 0.11, 'press-hombro-smith': 0.22, 'elevaciones-laterales-mancuernas': 0.04, 'elevaciones-laterales-polea': 0.03,
  'extension-triceps-polea': 0.20, 'press-frances-barra-z': 0.17, 'encogimiento-polea': 0.25,
  'jalon-pecho': 0.50, 'jalon-convergente': 0.45, 'remo-sentado-polea': 0.45, 'remo-maquina': 0.40,
  'remo-mancuerna-banco': 0.17, 'remo-t-apoyo-pecho': 0.25, 'pajaros-mancuernas': 0.05, 'face-pull': 0.15,
  'curl-barra-z-scott': 0.20, 'curl-alterno-mancuernas': 0.09, 'curl-martillo': 0.10, 'curl-polea': 0.22,
  'curl-muneca-espalda': 0.21, 'curl-inverso': 0.15, 'curl-martillo-cuerda': 0.18,
  'prensa-45': 0.80, 'sentadilla-articulada': 0.45, 'curl-femoral-tumbado': 0.30, 'extension-cuadriceps': 0.35,
  'hip-thrust-maquina': 0.60, 'peso-muerto-rumano-mancuernas': 0.20, 'zancadas-mancuernas': 0.14, 'gemelos-sentado': 0.60
};

export async function bodyKg() {
  try {
    const rows = (await getAll('bodyweight')).sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length) return rows[rows.length - 1].kg;
  } catch (e) { /* sin datos */ }
  return 80;
}

// Peso de partida en kg (múltiplo de 2,5, mínimo 2,5) o null si el ejercicio no lleva carga.
export function startingWeight(exId, kg) {
  const r = RATIO[exId];
  if (!r) return null;
  return Math.max(2.5, Math.round((kg * r) / 2.5) * 2.5);
}
