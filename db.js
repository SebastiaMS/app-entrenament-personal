// Base de datos local (IndexedDB). Todo se guarda en el móvil, sin servidor.
const DB_NAME = 'entrenador';
const DB_VERSION = 3;
const APP_ID = 'entrenador-personal';

// Almacenes (tablas):
//  settings   clave -> valor (ajustes, fecha de última copia...)
//  logs       series registradas: { id, date, exerciseId, setIndex, weight, reps, rir }
//  bodyweight peso corporal: { date, kg }
//  schedule   calendario: { date, kind, note }  (entreno, movilidad, oficina, pádel...)
//  sessions   sesiones terminadas: { id, day, variant, startedAt, finishedAt, setsDone, ids }
//  mobility   rutinas de movilidad hechas: { id, date, routineId, minutes, finishedAt }
//  (logs de entrenamiento: { id, sessionId, date, exerciseId, setIndex, weight, reps })
const STORES = {
  settings: { keyPath: 'key' },
  logs: { keyPath: 'id', autoIncrement: true, indexes: [['date', 'date'], ['exerciseId', 'exerciseId']] },
  bodyweight: { keyPath: 'date' },
  schedule: { keyPath: 'date' },
  sessions: { keyPath: 'id' },
  mobility: { keyPath: 'id' }
};

let dbPromise;

export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, cfg] of Object.entries(STORES)) {
          if (db.objectStoreNames.contains(name)) continue;
          const store = db.createObjectStore(name, { keyPath: cfg.keyPath, autoIncrement: !!cfg.autoIncrement });
          for (const [idx, path] of cfg.indexes || []) store.createIndex(idx, path);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put(store, value) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const r = wrap(tx.objectStore(store).put(value));
  await txDone(tx);
  return r;
}

export async function getAll(store) {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).getAll());
}

export async function del(store, key) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await txDone(tx);
}

export async function getByIndex(store, index, value) {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).index(index).getAll(value));
}

export async function count(store) {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).count());
}

export async function getSetting(key, fallback = null) {
  const db = await openDb();
  const row = await wrap(db.transaction('settings').objectStore('settings').get(key));
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  return put('settings', { key, value });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transacción cancelada'));
  });
}

// ---- Copia de seguridad ----

export async function exportBackup() {
  const data = {};
  for (const name of Object.keys(STORES)) data[name] = await getAll(name);
  return { app: APP_ID, schema: DB_VERSION, exportedAt: new Date().toISOString(), data };
}

export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('El archivo no es una copia válida.');
  if (obj.app !== APP_ID) throw new Error('Este archivo no es una copia de esta app.');
  if (typeof obj.schema !== 'number' || obj.schema > DB_VERSION) {
    throw new Error('La copia es de una versión más nueva de la app.');
  }
  if (!obj.data || typeof obj.data !== 'object') throw new Error('La copia está vacía o dañada.');
  for (const name of Object.keys(STORES)) {
    if (obj.data[name] !== undefined && !Array.isArray(obj.data[name])) {
      throw new Error('La copia está dañada (' + name + ').');
    }
  }
}

// Sustituye todos los datos actuales por los de la copia (en una sola transacción).
export async function importBackup(obj) {
  validateBackup(obj);
  const db = await openDb();
  const names = Object.keys(STORES);
  const tx = db.transaction(names, 'readwrite');
  for (const name of names) {
    const store = tx.objectStore(name);
    store.clear();
    for (const row of obj.data[name] || []) store.put(row);
  }
  await txDone(tx);
}

// Pide al navegador que no borre los datos si falta espacio (importante en iPhone).
export async function requestPersistence() {
  if (!navigator.storage || !navigator.storage.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (e) {
    return null;
  }
}
