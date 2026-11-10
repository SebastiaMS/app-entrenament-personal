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

// iOS en una web instalada: soltar la pantalla encendida al salir y pedirla un momento después al volver
// evita que la app se quede en negro.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { try { wakeLock && wakeLock.release(); } catch (e) { /* nada */ } wakeLock = null; }
});

export function releaseAwake() {
  try { wakeLock && wakeLock.release(); } catch (e) { /* nada */ }
  wakeLock = null;
}

// ---- Vídeo de YouTube dentro de la app ----
export function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('youtube.com') && u.pathname === '/watch') return u.searchParams.get('v');
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
  } catch (e) { /* url no válida */ }
  return null;
}

export function openVideo(url) {
  const id = youtubeId(url);
  if (!id) { window.open(url, '_blank', 'noopener'); return; }
  if (navigator.onLine === false) { toast('Sin conexión: los vídeos necesitan internet'); return; }
  const dlg = document.createElement('dialog');
  dlg.className = 'videodlg';
  dlg.innerHTML = `
    <div class="vframe"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0" title="Vídeo de la técnica" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    <div class="row" style="margin-top:12px">
      <a class="btn" href="${url}" target="_blank" rel="noopener" data-external style="min-height:48px">Abrir en YouTube</a>
      <button class="btn primary" id="vid-close" style="min-height:48px">Cerrar</button>
    </div>`;
  document.body.appendChild(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.querySelector('#vid-close').addEventListener('click', close);
  dlg.addEventListener('cancel', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.showModal();
}

// Cronómetro total: m:ss, o h:mm:ss a partir de la hora.
export function fmtTotal(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`;
}

// ---- Aviso con la app en segundo plano ----
// iOS congela los temporizadores de una web en segundo plano, pero deja sonar un audio. Por eso se genera
// un audio con tantos segundos de silencio como dure el descanso y tres pitidos al final: suena solo, aunque la app esté detrás.
// Mientras suena usa el modo 'playback' de iOS (ignora el interruptor de silencio); al terminar vuelve a 'ambient'.
let restAudio = null;
let restUrl = null;

function restWav(seconds) {
  const rate = 8000;
  const n = Math.round((seconds + 0.9) * rate);
  const data = new Uint8Array(n).fill(128);
  [0, 0.25, 0.5].forEach((d) => {
    const from = Math.round((seconds + d) * rate);
    for (let i = 0; i < Math.round(0.15 * rate) && from + i < n; i++) data[from + i] = 128 + Math.round(48 * Math.sin((2 * Math.PI * 880 * i) / rate));
  });
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).set(data);
  return new Blob([buf], { type: 'audio/wav' });
}

// Llamar dentro de un toque del usuario (iOS no deja reproducir audio si no).
export function primeRestAudio() {
  try {
    restAudio = restAudio || new Audio();
    restAudio.muted = false;
    restAudio.playsInline = true;
  } catch (e) { /* sin audio */ }
}

export function startRestAudio(seconds) {
  try {
    primeRestAudio();
    stopRestAudio(true);
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    restUrl = URL.createObjectURL(restWav(seconds));
    restAudio.src = restUrl;
    restAudio.onended = () => stopRestAudio();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'Descanso', artist: 'Entrenador' });
      navigator.mediaSession.setActionHandler('pause', null);
    }
    const p = restAudio.play();
    if (p && p.catch) p.catch(() => { /* iOS no lo permitió: queda el pitido normal */ });
  } catch (e) { /* sin audio */ }
}

export function stopRestAudio(keepSession = false) {
  try {
    if (restAudio) { restAudio.onended = null; restAudio.pause(); restAudio.removeAttribute('src'); restAudio.load(); }
    if (restUrl) { URL.revokeObjectURL(restUrl); restUrl = null; }
    if (!keepSession && navigator.audioSession) navigator.audioSession.type = 'ambient';
  } catch (e) { /* nada */ }
}

export const restAudioPlaying = () => !!(restAudio && restAudio.src && !restAudio.paused);
