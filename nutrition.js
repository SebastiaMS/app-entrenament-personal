// Nutrición: guía orientativa de calorías y proteína para ganar masa muscular.
import { del, getAll, getSetting, put, setSetting } from './db.js';
import { esc, localDate, toast } from './util.js';
import { preloadGis, syncFromFitbit } from './fitbit.js';

const DEFAULTS = { height: 183, age: 25, factor: 1.4, surplus: 0.10, adj: 0, adjDate: null, sex: 'm', measured: null };
const FACTORS = [[1.3, 'Muy sedentario'], [1.4, 'Sentado + 3 gym'], [1.5, 'Bastante activo']];
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
const FEEL = {
  energy: [['baja', 'Baja'], ['normal', 'Normal'], ['buena', 'Buena']],
  hunger: [['poca', 'Poca'], ['normal', 'Normal'], ['mucha', 'Mucha']]
};
// Consejo según cómo te sientes y tu tendencia de peso.
function feelAdvice(f, tr) {
  if (!f || !f.energy || !f.hunger) return null;
  const rate = tr && tr.rate !== null ? tr.rate : null;
  if (f.hunger === 'poca' && (rate === null || rate < 0.1)) return 'Si te cuesta comer y el peso no sube, añade calorías fáciles de beber o picar: leche entera, batidos, frutos secos, aceite de oliva en las comidas. Unas 150 kcal más al día suelen bastar.';
  if (f.energy === 'baja') return 'Con poca energía en los entrenos, revisa primero el sueño y que comas algo con carbohidratos 2-3 horas antes (arroz, pan, fruta, avena). Antes de tocar calorías, mira 1-2 semanas de datos.';
  if (f.hunger === 'mucha' && rate !== null && rate > 0.5) return 'Mucha hambre y el peso sube rápido: prioriza proteína, verdura y comidas saciantes en lugar de subir calorías.';
  if (f.hunger === 'mucha') return 'Tener hambre es normal si entrenas más. Reparte la proteína en 3-4 comidas y añade fruta o verdura para saciarte.';
  return 'Todo en orden: sigue con tus cifras y revisa cómo vas en una semana.';
}
const parseNum = (v) => parseFloat(String(v).replace(',', '.'));

export async function loadProfile() {
  return { ...DEFAULTS, ...((await getSetting('nutrition')) || {}) };
}

// Metabolismo basal (Mifflin-St Jeor) y objetivo diario.
export function targets(p, kg) {
  const bmr = 10 * kg + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  const tdee = p.measured > 0 ? p.measured : bmr * p.factor;
  const kcal = Math.round((tdee * (1 + p.surplus) + p.adj) / 10) * 10;
  const protein = Math.round((1.8 * kg) / 5) * 5;
  const fat = Math.round((1 * kg) / 5) * 5;
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4 / 5) * 5);
  return { kcal, protein, proteinMin: Math.round((1.6 * kg) / 5) * 5, proteinMax: Math.round((2.2 * kg) / 5) * 5, fat, carbs, tdee: Math.round(tdee / 10) * 10 };
}

const dayNum = (s) => Math.round(new Date(s + 'T12:00:00') / 86400000);
const mean = (a) => a.reduce((x, y) => x + y.kg, 0) / a.length;

// Tendencia de peso: media de los últimos 7 días frente a los 7 anteriores.
export function trend(rows) {
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  const end = dayNum(last.date);
  const w1 = rows.filter((r) => dayNum(r.date) > end - 7);
  const w0 = rows.filter((r) => dayNum(r.date) <= end - 7 && dayNum(r.date) > end - 14);
  const out = { avg: mean(w1), n: w1.length, rate: null };
  if (w1.length >= 2 && w0.length >= 2) out.rate = out.avg - mean(w0);
  return out;
}

// Ajuste sugerido de calorías (como mucho cada 14 días).
export function suggestAdjust(p, tr) {
  if (!tr || tr.rate === null) return null;
  if (p.adjDate && dayNum(localDate()) - dayNum(p.adjDate) < 14) return null;
  if (tr.rate < 0.1) return { delta: 150, text: `Tu peso sube ${fmt(Math.max(tr.rate, 0), 2)} kg por semana, poco para ganar masa. Prueba con 150 kcal más al día.` };
  if (tr.rate > 0.5) return { delta: -150, text: `Tu peso sube ${fmt(tr.rate, 2)} kg por semana, algo rápido (se acumula más grasa). Prueba con 150 kcal menos al día.` };
  return { delta: 0, text: `Vas a buen ritmo (${fmt(tr.rate, 2)} kg por semana). No cambies nada.` };
}

export async function renderNutrition(container) {
  const p = await loadProfile();
  const rows = (await getAll('bodyweight')).sort((a, b) => a.date.localeCompare(b.date));
  const tr = trend(rows);
  const kg = rows.length ? rows[rows.length - 1].kg : 83;
  const t = targets(p, kg);
  const sug = suggestAdjust(p, tr);
  const today = localDate();
  const todayRow = rows.find((r) => r.date === today);
  const fb = await getSetting('fitbit');
  const clientId = await getSetting('googleClientId', '');
  const feel = await getSetting('nutFeel');
  const feelRecent = feel && dayNum(today) - dayNum(feel.date) <= 7 ? feel : null;
  const advice = feelAdvice(feelRecent, tr);
  const perMeal = Math.round(t.protein / 4 / 5) * 5;

  container.innerHTML = `
    <div class="head"><span class="eyebrow">Guía orientativa</span><h1>Nutrición</h1></div>
    <div class="card">
      <span class="eyebrow">Tu objetivo diario · ganar masa</span>
      <div style="display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap">
        <div style="display:flex;flex-direction:column"><span style="font-size:38px;font-weight:800;line-height:1">${t.kcal}</span><span class="muted small">kcal</span></div>
        <div style="display:flex;flex-direction:column"><span style="font-size:38px;font-weight:800;line-height:1">${t.protein}</span><span class="muted small">g de proteína</span></div>
      </div>
      <div class="list" style="gap:0">
        <div class="item" style="min-height:44px;font-size:15px"><span>Proteína (rango)</span><span>${t.proteinMin}-${t.proteinMax} g</span></div>
        <div class="item" style="min-height:44px;font-size:15px"><span>Grasas (aprox.)</span><span>${t.fat} g</span></div>
        <div class="item" style="min-height:44px;font-size:15px"><span>Carbohidratos (el resto)</span><span>${t.carbs} g</span></div>
        <div class="item" style="min-height:44px;font-size:15px"><span>${p.measured > 0 ? 'Tu gasto (media Fitbit)' : 'Tu gasto estimado'}</span><span>${t.tdee} kcal</span></div>
      </div>
      <p>Cifras orientativas, no un plan médico. Se calculan con tu peso (${fmt(kg)} kg${rows.length ? '' : ', aún sin pesarte'}), altura y actividad, y se ajustan con tu tendencia de peso.</p>
    </div>
    <div class="card" id="nut-weight">
      <span class="eyebrow">Tu peso</span>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="inp" style="flex:1"><input id="bw" inputmode="decimal" placeholder="${fmt(kg)}" value="${todayRow ? fmt(todayRow.kg) : ''}" aria-label="Peso de hoy en kg"><span>kg</span></div>
        <button class="btn primary" id="bw-save" style="flex:none;min-height:48px;padding:0 18px">${todayRow ? 'Actualizar' : 'Guardar hoy'}</button>
      </div>
      ${tr ? `<p><strong>Media 7 días: ${fmt(tr.avg)} kg</strong>${tr.rate !== null ? ` · ${tr.rate >= 0 ? '+' : '−'}${fmt(Math.abs(tr.rate), 2)} kg frente a la semana anterior` : ' · necesito 2 semanas de datos para ver la tendencia'}</p>` : '<p>Pésate varias veces por semana (mejor en ayunas) y la app calculará tu media semanal.</p>'}
      ${rows.length ? `<div class="list" style="gap:0">${rows.slice(-6).reverse().map((r) => `<div class="item" style="min-height:40px;font-size:15px"><span>${new Date(r.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span>${fmt(r.kg)} kg</span></div>`).join('')}</div>` : ''}
    </div>
    <div class="card" id="nut-fitbit">
      <span class="eyebrow">Fitbit Air · gasto real</span>
      ${fb ? `<p style="color:var(--text);font-size:15px"><strong>${fb.avg} kcal/día</strong> de media en ${fb.days} día${fb.days === 1 ? '' : 's'} completo${fb.days === 1 ? '' : 's'}, leído el ${new Date(fb.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}.${fb.days < 7 ? ' Aún es provisional: se afina con más días.' : ''}</p>` : '<p>Lee tu gasto medio directamente de la Fitbit, sin escribirlo a mano. Hace falta conexión.</p>'}
      <label class="inp"><input id="g-client" placeholder="ID de cliente de Google" value="${esc(clientId)}" aria-label="ID de cliente de Google" style="text-align:left;font-size:13px"></label>
      <button class="btn primary" id="fb-sync" style="flex:none;min-height:48px">Leer gasto de la Fitbit</button>
      <div class="msg" id="fb-msg" role="status"></div>
    </div>
    ${sug ? `<div class="card" id="nut-sug"><span class="eyebrow">Ajuste sugerido</span><p style="color:var(--text);font-size:15px">${esc(sug.text)}</p>
      ${sug.delta ? '<button class="btn" id="adj-apply" style="flex:none;min-height:48px">Aplicar ' + (sug.delta > 0 ? '+' : '') + sug.delta + ' kcal</button>' : '<button class="btn" id="adj-ok" style="flex:none;min-height:48px">Entendido</button>'}</div>` : ''}
    <div class="card" id="nut-feel">
      <span class="eyebrow">Cómo te sientes esta semana</span>
      <span class="small muted">Energía en los entrenos</span>
      <div class="chips">${FEEL.energy.map(([k, l]) => `<button class="chip" data-feel="energy:${k}" aria-pressed="${feelRecent && feelRecent.energy === k}">${l}</button>`).join('')}</div>
      <span class="small muted">Hambre</span>
      <div class="chips">${FEEL.hunger.map(([k, l]) => `<button class="chip" data-feel="hunger:${k}" aria-pressed="${feelRecent && feelRecent.hunger === k}">${l}</button>`).join('')}</div>
      ${advice ? `<p style="color:var(--text);font-size:15px" id="feel-advice">${esc(advice)}</p>` : '<p>Marca las dos y te doy un consejo.</p>'}
    </div>
    <div class="card">
      <span class="eyebrow">Cómo llegar a tu proteína</span>
      <p>Reparte unos ${t.protein} g en 3-4 comidas, ≈ ${perMeal} g cada una. Valores aproximados:</p>
      <div class="list" style="gap:0">
        <div class="item" style="min-height:40px;font-size:15px"><span>100 g de pechuga de pollo cocinada</span><span style="white-space:nowrap;padding-left:8px">≈ 30 g</span></div>
        <div class="item" style="min-height:40px;font-size:15px"><span>1 lata de atún al natural</span><span style="white-space:nowrap;padding-left:8px">≈ 20 g</span></div>
        <div class="item" style="min-height:40px;font-size:15px"><span>3 huevos</span><span style="white-space:nowrap;padding-left:8px">≈ 19 g</span></div>
        <div class="item" style="min-height:40px;font-size:15px"><span>150 g de yogur griego</span><span style="white-space:nowrap;padding-left:8px">≈ 14 g</span></div>
        <div class="item" style="min-height:40px;font-size:15px"><span>100 g de lentejas cocidas</span><span style="white-space:nowrap;padding-left:8px">≈ 9 g</span></div>
        <div class="item" style="min-height:40px;font-size:15px"><span>1 cacito de proteína en polvo (30 g)</span><span style="white-space:nowrap;padding-left:8px">≈ 24 g</span></div>
      </div>
    </div>
    <details class="routines" id="nut-edit">
      <summary>Ajustar mis datos</summary>
      <div style="display:flex;flex-direction:column;gap:10px;padding-top:10px">
        <div style="display:flex;gap:10px">
          <label class="inp" style="flex:1"><input id="p-h" inputmode="numeric" value="${p.height}" aria-label="Altura"><span>cm</span></label>
          <label class="inp" style="flex:1"><input id="p-a" inputmode="numeric" value="${p.age}" aria-label="Edad"><span>años</span></label>
        </div>
        <label class="inp"><input id="p-m" inputmode="numeric" placeholder="Opcional, ej. 2600" value="${p.measured || ''}" aria-label="Gasto medio diario de la Fitbit"><span>kcal/día</span></label>
        <span class="muted small">Gasto medio diario de tu Fitbit (mira el promedio de la semana, no un solo día). Si lo rellenas, la app lo usa en lugar de la fórmula; déjalo vacío para volver a la fórmula. Las pulseras se equivocan un 10-20 %, por eso el ajuste final sigue saliendo de tu peso.</span>
        <div class="chips" style="flex-wrap:wrap">${FACTORS.map(([f, l]) => `<button class="chip" data-f="${f}" aria-pressed="${p.factor === f}">${l}</button>`).join('')}</div>
        <span class="muted small">Calorías extra añadidas por ajustes: ${p.adj > 0 ? '+' : ''}${p.adj} kcal. Excedente base: 10 % sobre tu gasto.</span>
        <button class="btn" id="p-save" style="flex:none;min-height:48px">Guardar datos</button>
      </div>
    </details>`;

  const save = async (patch) => { await setSetting('nutrition', { ...p, ...patch }); renderNutrition(container); };
  container.querySelector('#bw-save').addEventListener('click', async () => {
    const v = parseNum(container.querySelector('#bw').value);
    if (!(v >= 30 && v <= 250)) return toast('Escribe tu peso en kg, por ejemplo 83,4');
    await put('bodyweight', { date: today, kg: Math.round(v * 10) / 10 });
    renderNutrition(container);
  });
  container.querySelectorAll('[data-feel]').forEach((b) => b.addEventListener('click', async () => {
    const [k, v] = b.dataset.feel.split(':');
    const cur = feelRecent || {};
    await setSetting('nutFeel', { energy: cur.energy, hunger: cur.hunger, [k]: v, date: today });
    renderNutrition(container);
  }));
  preloadGis();
  container.querySelector('#fb-sync').addEventListener('click', async () => {
    const msg = container.querySelector('#fb-msg');
    const id = container.querySelector('#g-client').value.trim();
    if (!id.includes('.apps.googleusercontent.com')) { msg.textContent = 'Pega el ID de cliente de Google Cloud (termina en .apps.googleusercontent.com).'; return; }
    msg.textContent = 'Conectando con Google…';
    const sync = syncFromFitbit(id); // se lanza ya, dentro del toque, para que la ventana de Google no se bloquee
    sync.catch(() => {});
    try {
      setSetting('googleClientId', id);
      const r = await sync;
      if (!r) { msg.textContent = 'No hay días completos todavía (hoy no cuenta). Prueba mañana.'; return; }
      await setSetting('fitbit', { date: today, avg: r.avg, days: r.days });
      await setSetting('nutrition', { ...p, measured: r.avg });
      renderNutrition(container);
    } catch (e) {
      msg.textContent = 'No se pudo leer: ' + e.message;
    }
  });
  const apply = container.querySelector('#adj-apply');
  if (apply) apply.addEventListener('click', () => save({ adj: p.adj + sug.delta, adjDate: today }));
  const ok = container.querySelector('#adj-ok');
  if (ok) ok.addEventListener('click', () => save({ adjDate: today }));
  let factor = p.factor;
  container.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
    factor = parseFloat(b.dataset.f);
    container.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  container.querySelector('#p-save').addEventListener('click', () => {
    const h = parseNum(container.querySelector('#p-h').value);
    const a = parseNum(container.querySelector('#p-a').value);
    if (!(h >= 120 && h <= 230) || !(a >= 14 && a <= 90)) return toast('Revisa la altura (cm) y la edad');
    const mRaw = container.querySelector('#p-m').value.trim();
    const m = mRaw ? parseNum(mRaw) : null;
    if (mRaw && !(m >= 1200 && m <= 6000)) return toast('El gasto diario debe estar entre 1200 y 6000 kcal');
    save({ height: h, age: a, factor, measured: m });
  });
}
