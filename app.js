import { count, exportBackup, getSetting, importBackup, requestPersistence, setSetting } from './db.js';
import { EXERCISES, PROGRAM, otherOption, sessionFor, videoUrl } from './exercises.js';
import { programVariant, renderToday } from './train.js';
import { renderHistory } from './history.js';
import { renderWeek } from './week.js';
import { renderNutrition } from './nutrition.js';
import { openVideo } from './util.js';

const ICONS = {
  hoy: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
  historial: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  semana: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  nutricion: '<path d="M12 21c-4 0-7-3-7-7 0-3 2-5 4-6 1 2 2 2 3 2 0-3 1-5 3-6 1 3 4 5 4 9 0 4-3 8-7 8z"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
};

const TABS = [
  { id: 'hoy', label: 'Hoy', eyebrow: 'Hoy', title: 'Hoy', soon: 'Aquí verás tu sesión y la movilidad del día.', phase: 'Fase 3' },
  { id: 'historial', label: 'Historial', eyebrow: 'Tu progreso', title: 'Historial', soon: 'Aquí verás la evolución de cada ejercicio.', phase: 'Fase 3' },
  { id: 'semana', label: 'Semana', eyebrow: 'Calendario', title: 'Semana', soon: 'Aquí podrás reprogramar sesiones y marcar oficina o pádel.', phase: 'Fase 4' },
  { id: 'nutricion', label: 'Nutrición', eyebrow: 'Guía orientativa', title: 'Nutrición', soon: 'Aquí tendrás tu guía de calorías y proteína.', phase: 'Fase 6' },
  { id: 'ajustes', label: 'Ajustes', eyebrow: 'Tu app', title: 'Ajustes' }
];

const app = document.getElementById('app');
const nav = document.getElementById('nav');
let current = (location.hash || '#hoy').slice(1);
if (!TABS.some((t) => t.id === current)) current = 'hoy';

function svg(path, size = 24, sw = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function renderNav() {
  nav.innerHTML = TABS.map((t) => {
    const on = t.id === current;
    return `<button data-tab="${t.id}" ${on ? 'aria-current="page"' : ''}>${svg(ICONS[t.id], 24, on ? 2.2 : 2)}${t.label}</button>`;
  }).join('');
}

let libraryOpen = false;
const lib = { day: 'push', variant: null };

function go(id) {
  current = id;
  libraryOpen = false;
  history.replaceState(null, '', '#' + id);
  render();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function renderLibrary() {
  const thisWeek = await programVariant();
  if (!lib.variant) lib.variant = thisWeek;
  const items = sessionFor(lib.day, lib.variant);
  const chip = (on, attrs, label) => `<button class="chip" ${attrs} aria-pressed="${on}">${label}</button>`;
  app.innerHTML = `
    <button class="back" id="lib-back">${svg('<path d="M15 5l-7 7 7 7"/>', 18, 2.5)}Ajustes</button>
    <div class="head"><span class="eyebrow">Tus 3 días</span><h1>Ejercicios</h1></div>
    <div class="chips" role="group" aria-label="Día">
      ${Object.entries(PROGRAM).map(([id, d]) => chip(id === lib.day, `data-day="${id}"`, d.name)).join('')}
    </div>
    <div class="chips" role="group" aria-label="Semana">
      ${['A', 'B'].map((v) => chip(v === lib.variant, `data-variant="${v}"`, 'Semana ' + v)).join('')}
    </div>
    <span class="muted small">Esta semana te toca la semana ${thisWeek}.</span>
    <div class="exlist">
      ${items.map((ex, i) => {
        const alt = otherOption(lib.day, ex.id);
        return `<details>
          <summary><span class="num">${i + 1}</span><span class="exname"><strong>${esc(ex.name)}</strong><span class="muted small">${esc(ex.muscle)} · ${ex.sets} × ${ex.reps[0]}-${ex.reps[1]}</span></span>${svg('<path d="M6 9l6 6 6-6"/>', 20, 2.5)}</summary>
          <div class="detail">
            ${ex.tecnica ? '<span class="tag">Aprende primero la técnica con poco peso</span>' : ''}
            <ul>${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
            <div class="muted small">${esc(ex.equip)}${ex.carga === 'mancuerna' ? ' · saltos de 2,5 kg' : ''}</div>
            ${alt ? `<div class="muted small">La otra semana: ${esc(EXERCISES[alt].name)}</div>` : ''}
            <a class="btn link" href="${videoUrl(ex.id)}" target="_blank" rel="noopener">${svg('<path d="M8 5.5v13l11-6.5z"/>', 16, 2)}Ver vídeo de la técnica</a>
          </div>
        </details>`;
      }).join('')}
    </div>
    <span class="muted small">Los rangos de repeticiones son convenciones habituales para hipertrofia. La app los ajustará según tu rendimiento.</span>`;
  document.getElementById('lib-back').addEventListener('click', () => { libraryOpen = false; render(); });
  app.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { lib.day = b.dataset.day; renderLibrary(); }));
  app.querySelectorAll('[data-variant]').forEach((b) => b.addEventListener('click', () => { lib.variant = b.dataset.variant; renderLibrary(); }));
  app.scrollTop = 0;
}

nav.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) go(b.dataset.tab);
});

function render() {
  renderNav();
  const tab = TABS.find((t) => t.id === current);
  if (tab.id === 'ajustes') return libraryOpen ? renderLibrary() : renderSettings(tab);
  if (tab.id === 'historial') return renderHistory(app);
  if (tab.id === 'semana') return renderWeek(app);
  if (tab.id === 'nutricion') return renderNutrition(app);
  if (tab.id === 'hoy') return renderToday(app, { immersive: (on) => { nav.style.display = on ? 'none' : ''; } });
  app.innerHTML = `
    <div class="head"><span class="eyebrow">${tab.eyebrow}</span><h1>${tab.title}</h1></div>
    <div class="placeholder"><strong>Próximamente</strong><span>${tab.soon}</span><span>Se construye en la ${tab.phase}.</span></div>`;
  app.scrollTop = 0;
}

function fmtDate(iso) {
  if (!iso) return 'nunca';
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function renderSettings(tab) {
  const restSound = await getSetting('restSound', true);
  const [lastBackup, persisted, logs, weights] = await Promise.all([
    getSetting('lastBackup'),
    navigator.storage && navigator.storage.persisted ? navigator.storage.persisted() : null,
    count('logs'),
    count('bodyweight')
  ]);
  const online = navigator.onLine;
  app.innerHTML = `
    <div class="head"><span class="eyebrow">${tab.eyebrow}</span><h1>${tab.title}</h1></div>
    <div class="status">
      <div class="dot">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 3).replace('<svg', '<svg stroke="#fff"')}</div>
      <div><strong>Funciona sin conexión</strong><span>Tus datos están guardados en este móvil · ${online ? 'ahora con conexión' : 'ahora sin conexión'}</span></div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <span class="eyebrow">Copia de seguridad</span><span class="muted small">Última copia: ${fmtDate(lastBackup)}</span>
      </div>
      <p>En iPhone, una web instalada puede perder sus datos si el móvil se queda sin espacio. Haz una copia de vez en cuando y guárdala en Archivos o iCloud.</p>
      <div class="row">
        <button class="btn primary" id="export">${svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 18, 2.5)}Exportar copia</button>
        <label class="btn" for="import">${svg('<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>', 18, 2.5)}Importar copia</label>
        <input type="file" id="import" accept="application/json,.json">
      </div>
      <div class="msg" id="msg" role="status"></div>
    </div>
    <button class="btn" id="toggle-sound" role="switch" aria-checked="${restSound}" style="flex:none;justify-content:space-between;padding:0 16px">
      <span style="display:flex;align-items:center;gap:8px">${svg('<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>', 18, 2.5)}Sonido al acabar el descanso</span>
      <span style="color:${restSound ? 'var(--green)' : 'var(--muted)'};font-weight:800">${restSound ? 'Sí' : 'No'}</span>
    </button>
    <button class="btn" id="open-lib" style="flex:none;justify-content:space-between;padding:0 16px">
      <span style="display:flex;align-items:center;gap:8px">${svg('<path d="M4 6h16M4 12h16M4 18h10"/>', 18, 2.5)}Ejercicios de Push, Pull y Legs</span>${svg('<path d="M9 5l7 7-7 7"/>', 18, 2.5)}
    </button>
    <div class="card list">
      <div class="item"><span>Series guardadas</span><span>${logs}</span></div>
      <div class="item"><span>Pesos corporales</span><span>${weights}</span></div>
      <div class="item"><span>Almacenamiento protegido</span><span>${persisted === null ? 'No disponible' : persisted ? 'Sí' : 'No'}</span></div>
      <div class="item"><span>Versión</span><span id="app-ver">1.0</span></div>
    </div>`;
  if (window.caches) caches.keys().then((ks) => { const k = ks.find((x) => x.startsWith('entrenador-')); const el = document.getElementById('app-ver'); if (el && k) el.textContent = '1.0 · ' + k.replace('entrenador-', ''); }).catch(() => {});
  document.getElementById('toggle-sound').addEventListener('click', async () => {
    await setSetting('restSound', !restSound);
    renderSettings(tab);
  });
  document.getElementById('open-lib').addEventListener('click', () => { libraryOpen = true; renderLibrary(); });
  document.getElementById('export').addEventListener('click', doExport);
  document.getElementById('import').addEventListener('change', doImport);
}

function say(text, kind) {
  const el = document.getElementById('msg');
  if (el) { el.textContent = text; el.className = 'msg ' + kind; }
}

async function doExport() {
  try {
    const backup = await exportBackup();
    const name = 'copia-entrenador-' + new Date().toISOString().slice(0, 10) + '.json';
    const file = new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // En iPhone abre la hoja de compartir: "Guardar en Archivos", AirDrop, etc.
      try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e.name === 'AbortError') return; throw e; }
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    await setSetting('lastBackup', new Date().toISOString());
    say('Copia creada: ' + name, 'ok');
    renderSettings(TABS[4]).then(() => say('Copia creada: ' + name, 'ok'));
  } catch (e) {
    say('No se pudo crear la copia: ' + e.message, 'err');
  }
}

async function doImport(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  try {
    const obj = JSON.parse(await file.text());
    const when = obj && obj.exportedAt ? fmtDate(obj.exportedAt) : 'fecha desconocida';
    if (!confirm('Se sustituirán los datos actuales por los de la copia del ' + when + '. ¿Continuar?')) {
      ev.target.value = '';
      return;
    }
    await importBackup(obj);
    renderSettings(TABS[4]).then(() => say('Copia importada correctamente.', 'ok'));
  } catch (e) {
    say(e instanceof SyntaxError ? 'El archivo no es una copia válida.' : e.message, 'err');
  }
  ev.target.value = '';
}

window.addEventListener('online', () => current === 'ajustes' && render());
window.addEventListener('offline', () => current === 'ajustes' && render());

render();
requestPersistence();

// Sin zoom por doble toque (iOS): un segundo toque rápido se convierte en clic en todo el botón
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  const quick = now - lastTouch < 450;
  lastTouch = now;
  if (!quick || e.touches.length || e.target.closest('input, textarea, select')) return;
  const hit = e.target.closest('button, a[href], summary, label, [role="button"]');
  e.preventDefault();
  if (hit && !hit.disabled) hit.click();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Los enlaces a vídeos de YouTube se abren dentro de la app
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href*="youtube.com/watch"]');
  if (!a || a.hasAttribute('data-external')) return;
  e.preventDefault();
  openVideo(a.href);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
  // Cuando se instala una versión nueva, recarga sola para usarla (salvo en mitad de un entreno o una rutina).
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    if (document.querySelector('.setrow, #mob-card')) return;
    reloaded = true;
    location.reload();
  });
}
