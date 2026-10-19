// Lectura del gasto calórico de la Fitbit Air desde la Google Health API.
// Inicio de sesión de Google solo en el navegador (sin secretos): da un token de 1 hora cada vez que lo pides.
const SCOPE = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';
const URL_CAL = 'https://health.googleapis.com/v4/users/me/dataTypes/total-calories/dataPoints:dailyRollUp';
const MIN_FULL_DAY = 1500; // por debajo, el día se considera incompleto (pulsera puesta a medias)

let gisPromise = null;
function loadGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new Error('No se pudo cargar el inicio de sesión de Google (¿sin conexión?)')); };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

// Carga el script de Google con antelación: la ventana de inicio de sesión solo se puede abrir
// directamente en el toque del botón, sin esperas antes (si no, iOS la bloquea).
export function preloadGis() {
  return loadGis().catch(() => {});
}

export function getToken(clientId, scope = SCOPE) {
  return new Promise((resolve, reject) => {
    if (!(window.google && window.google.accounts && window.google.accounts.oauth2)) {
      return reject(new Error('El inicio de sesión de Google aún no ha cargado. Espera un segundo y vuelve a pulsar (necesita conexión).'));
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: (r) => (r.error ? reject(new Error('Google respondió: ' + r.error + (r.error_description ? ' · ' + r.error_description : ''))) : resolve(r.access_token)),
      error_callback: (e) => reject(new Error('No se completó el inicio de sesión (' + (e && e.type ? e.type : 'cancelado') + ')'))
    });
    client.requestAccessToken();
  });
}

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;
const dateOf = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

// Pide las calorías totales diarias de los 13 días anteriores a hoy.
export async function fetchCalories(token, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const civil = (d, t) => ({ date: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }, time: t });
  const body = {
    range: { start: civil(start, { hours: 0, minutes: 0, seconds: 0, nanos: 0 }), end: civil(end, { hours: 23, minutes: 59, seconds: 59, nanos: 0 }) },
    windowSizeDays: 1
  };
  const res = await fetch(URL_CAL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json.error && json.error.message ? json.error.message : 'Error ' + res.status).split('\n')[0]);
  return json.rollupDataPoints || [];
}

// Media de los días completos (sin hoy). Devuelve { avg, days, list } o null si no hay ninguno.
export function summarize(points, now = new Date()) {
  const today = dateOf(now);
  const list = points
    .map((p) => ({ date: p.civilStartTime && p.civilStartTime.date ? key(p.civilStartTime.date) : null, kcal: p.totalCalories ? p.totalCalories.kcalSum : null }))
    .filter((x) => x.date && x.date < today && typeof x.kcal === 'number' && x.kcal >= MIN_FULL_DAY)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return null;
  const avg = list.reduce((s, x) => s + x.kcal, 0) / list.length;
  return { avg: Math.round(avg), days: list.length, list };
}

export async function syncFromFitbit(clientId) {
  const tokenPromise = getToken(clientId); // sin ningún await antes: debe abrirse en el toque del botón
  const token = await tokenPromise;
  const points = await fetchCalories(token);
  return summarize(points);
}

// ---- Sueño ----
export const SLEEP_SCOPE = 'https://www.googleapis.com/auth/googlehealth.sleep.readonly';
export const LOW_SLEEP_MIN = 360; // menos de 6 h dormido: se propone la versión ligera
const URL_SLEEP = 'https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints:reconcile';

const msOf = (t) => (t ? Date.parse(t) : NaN);

// Minutos dormidos de una sesión: resumen si viene, si no etapas sin "despierto", si no el intervalo.
export function sessionMinutes(p) {
  const s = p && p.sleep ? p.sleep : p || {};
  if (s.summary && typeof s.summary.minutesAsleep !== 'undefined') return Number(s.summary.minutesAsleep);
  const stages = s.stages || s.sleepStages;
  if (Array.isArray(stages) && stages.length) {
    return Math.round(stages.filter((x) => x.type !== 'AWAKE').reduce((a, x) => a + (msOf(x.endTime) - msOf(x.startTime)), 0) / 60000);
  }
  const i = s.interval || s;
  const d = (msOf(i.endTime) - msOf(i.startTime)) / 60000;
  return Number.isFinite(d) ? Math.round(d) : 0;
}

// Fecha local (en la zona de la propia sesión) en la que terminó.
export function endDateOf(p) {
  const s = p && p.sleep ? p.sleep : p || {};
  const i = s.interval || s;
  const civil = i.civilEndTime && i.civilEndTime.date;
  if (civil) return key(civil);
  const off = parseInt(String(i.endUtcOffset || '0').replace('s', ''), 10) || 0;
  const t = msOf(i.endTime);
  if (!Number.isFinite(t)) return null;
  return new Date(t + off * 1000).toISOString().slice(0, 10);
}

// Suma lo dormido en las sesiones que terminan hoy. Devuelve { date, minutes } o null si no hay.
export function summarizeSleep(points, now = new Date()) {
  const today = dateOf(now);
  const mine = (points || []).filter((p) => endDateOf(p) === today);
  if (!mine.length) return null;
  const minutes = mine.reduce((a, p) => a + sessionMinutes(p), 0);
  return minutes > 0 ? { date: today, minutes } : null;
}

export async function fetchSleep(token, now = new Date()) {
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const q = new URLSearchParams({
    dataSourceFamily: 'users/me/dataSourceFamilies/google-wearables',
    filter: `sleep.interval.civil_end_time >= "${dateOf(y)}"`
  });
  const res = await fetch(URL_SLEEP + '?' + q, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json.error && json.error.message ? json.error.message : 'Error ' + res.status).split('\n')[0]);
  return json.dataPoints || [];
}

export async function syncSleep(clientId) {
  const tokenPromise = getToken(clientId, SLEEP_SCOPE); // sin await antes: se abre en el toque
  const token = await tokenPromise;
  return summarizeSleep(await fetchSleep(token));
}
