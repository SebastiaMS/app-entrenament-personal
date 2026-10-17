import { count, exportBackup, getSetting, importBackup, requestPersistence, setSetting } from './db.js';

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

function go(id) {
  current = id;
  history.replaceState(null, '', '#' + id);
  render();
}

nav.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) go(b.dataset.tab);
});

function render() {
  renderNav();
  const tab = TABS.find((t) => t.id === current);
  if (tab.id === 'ajustes') return renderSettings(tab);
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
    <div class="card list">
      <div class="item"><span>Series guardadas</span><span>${logs}</span></div>
      <div class="item"><span>Pesos corporales</span><span>${weights}</span></div>
      <div class="item"><span>Almacenamiento protegido</span><span>${persisted === null ? 'No disponible' : persisted ? 'Sí' : 'No'}</span></div>
      <div class="item"><span>Versión</span><span>0.1 · base técnica</span></div>
    </div>`;
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
