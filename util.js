// Utilidades compartidas por las pantallas.

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function svg(path, size = 20, sw = 2.5, extra = '') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${path}</svg>`;
}

export function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// Fecha local (no UTC) en formato AAAA-MM-DD.
export function localDate(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ---- Aviso breve en pantalla ----
export function toast(text) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---- Sonido (se puede desactivar en Ajustes) ----
let audioCtx = null;

// Hay que llamarlo desde un toque del usuario para que iOS permita el sonido después.
export function unlockAudio() {
  try {
    // 'ambient' hace que el sonido respete el interruptor de silencio del iPhone.
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch (e) { /* sin sonido */ }
}

export function beep() {
  if (!audioCtx) return;
  try {
    [0, 0.25, 0.5].forEach((delay) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.value = 0.15;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(audioCtx.currentTime + delay);
      o.stop(audioCtx.currentTime + delay + 0.15);
    });
  } catch (e) { /* sin sonido */ }
}

// Destello en una tarjeta para avisar sin sonido.
export function flashCard(el) {
  if (!el) return;
  el.classList.remove('alert');
  void el.offsetWidth; // reinicia la animación
  el.classList.add('alert');
  setTimeout(() => el.classList.remove('alert'), 2000);
}

// ---- Mantener la pantalla encendida durante el entreno ----
let wakeLock = null;

export async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) { /* no disponible */ }
}

export function releaseAwake() {
  try { wakeLock && wakeLock.release(); } catch (e) { /* nada */ }
  wakeLock = null;
}
