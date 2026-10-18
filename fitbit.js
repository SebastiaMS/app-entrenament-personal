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

export async function getToken(clientId) {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
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
  const token = await getToken(clientId);
  const points = await fetchCalories(token);
  return summarize(points);
}
