// Copia de seguridad: exportar todos los datos y avisar cuando hace tiempo que no se hace.
import { exportBackup, getAll, getSetting, setSetting } from './db.js';
import { localDate } from './util.js';

export const BACKUP_DAYS = 14;

// Crea la copia y abre la hoja de compartir (iPhone) o la descarga. Devuelve el nombre, o null si se canceló.
export async function exportNow() {
  const backup = await exportBackup();
  const name = 'copia-entrenador-' + new Date().toISOString().slice(0, 10) + '.json';
  const file = new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e.name === 'AbortError') return null; throw e; }
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  await setSetting('lastBackup', new Date().toISOString());
  await setSetting('backupSnooze', null);
  return name;
}

// ¿Toca avisar? Solo si ya hay entrenos guardados y hace ≥14 días de la última copia (o nunca).
export async function backupDue() {
  const today = localDate();
  const snooze = await getSetting('backupSnooze');
  if (snooze && snooze > today) return null;
  const sessions = (await getAll('sessions')).filter((s) => s.finishedAt);
  if (!sessions.length) return null;
  const last = await getSetting('lastBackup');
  if (!last) {
    const first = sessions.map((s) => s.finishedAt).sort()[0];
    const daysUse = Math.floor((Date.now() - new Date(first)) / 86400000);
    return daysUse >= 3 ? { never: true, days: daysUse } : null; // con unos días de uso, ya conviene la primera
  }
  const days = Math.floor((Date.now() - new Date(last)) / 86400000);
  return days >= BACKUP_DAYS ? { never: false, days } : null;
}

export async function snoozeBackup(days = 3) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  await setSetting('backupSnooze', localDate(d));
}
