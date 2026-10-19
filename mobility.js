// Movilidad diaria: rutinas rápidas (5-10 min) que van rotando entre caderas, espalda alta e isquios.
import { getAll, getSetting, put, setSetting } from './db.js';
import { beep, esc, flashCard, fmtClock, keepAwake, localDate, releaseAwake, svg, unlockAudio } from './util.js';

// hold = segundos que se mantiene; reps = repeticiones. side: palabra para "derecha/izquierda".
export const MOB = {
  'zancada-baja': { video: 'https://www.youtube.com/watch?v=HmfHMdmmVhc', name: 'Zancada baja: flexor de cadera', zone: 'Caderas', sets: 2, perSide: true, hold: 30, side: 'pierna',
    cues: ['Rodilla de atrás apoyada (mejor sobre una toalla) y pie delantero bien adelantado.', 'Aprieta el glúteo de la pierna de atrás y empuja la cadera suavemente hacia delante.', 'Torso alto, sin arquear la zona lumbar.', 'Respira lento. Debes notar tirón delante de la cadera, nunca dolor.'] },
  'figura-4': { video: 'https://www.youtube.com/watch?v=HfWa2Gf-T7c', name: 'Figura 4 tumbado (glúteo)', zone: 'Caderas', sets: 2, perSide: true, hold: 30, side: 'pierna',
    cues: ['Tumbado boca arriba, apoya el tobillo de una pierna sobre la rodilla de la otra.', 'Lleva el muslo de la pierna de abajo hacia el pecho con las manos.', 'Cabeza y espalda relajadas en el suelo.', 'El tirón se nota en el glúteo. Si te molesta la rodilla, suelta un poco.'] },
  'mariposa': { video: 'https://www.youtube.com/watch?v=NatR1CMhbRU', name: 'Mariposa sentado (aductores)', zone: 'Caderas', sets: 2, perSide: false, hold: 30,
    cues: ['Sentado con las plantas de los pies juntas y las rodillas hacia los lados.', 'Espalda recta, inclínate desde la cadera, no desde la espalda.', 'Deja que las rodillas bajen solas, sin empujarlas con las manos.', 'Respira lento y relaja los hombros.'] },
  'rana': { video: 'https://www.youtube.com/watch?v=p1KAmStoOdU', name: 'Rana: apertura de cadera', zone: 'Caderas', sets: 2, perSide: false, hold: 30,
    cues: ['A cuatro apoyos, separa las rodillas hasta notar tirón en la cara interna de los muslos.', 'Pies hacia fuera, tobillos alineados con las rodillas.', 'Lleva la cadera hacia atrás despacio sin arquear la espalda.', 'Intensidad moderada. Pon una toalla bajo las rodillas si te molestan.'] },
  'noventa-noventa': { video: 'https://www.youtube.com/watch?v=t4Zz6-aG8Iw', name: '90/90 de cadera: rotaciones', zone: 'Caderas', sets: 2, perSide: false, reps: 8,
    cues: ['Sentado en el suelo con las dos rodillas dobladas a 90° y hacia el mismo lado.', 'Pasa las rodillas al otro lado girando la cadera, sin ayudarte demasiado con las manos.', 'Torso erguido durante todo el movimiento.', 'Una repetición es pasar de un lado a otro. Ve despacio.'] },
  'sentadilla-profunda': { video: 'https://www.youtube.com/watch?v=jIyBCfCyVZU', name: 'Sentadilla profunda sostenida', zone: 'Caderas', sets: 2, perSide: false, hold: 30,
    cues: ['Pies algo más anchos que los hombros y puntas ligeramente hacia fuera.', 'Baja todo lo que puedas con la espalda recta; agárrate a algo si lo necesitas.', 'Empuja las rodillas hacia fuera con los codos.', 'Talones apoyados y respiración lenta.'] },
  'circulos-cadera': { video: 'https://www.youtube.com/watch?v=TcM8ups8GtA', name: 'Círculos de cadera a cuatro apoyos', zone: 'Caderas', sets: 2, perSide: true, reps: 8, side: 'pierna',
    cues: ['A cuatro apoyos, espalda neutra y abdomen firme.', 'Levanta la rodilla hacia el lado y dibuja círculos amplios con la cadera.', 'Mueve solo la cadera, sin girar el tronco.', 'Cambia de sentido a mitad de las repeticiones.'] },
  'puente-gluteo': { video: 'https://www.youtube.com/watch?v=g-NtJsie-9w', name: 'Puente de glúteo con pausa', zone: 'Caderas', sets: 2, perSide: false, reps: 10,
    cues: ['Tumbado boca arriba, rodillas dobladas y pies a la anchura de la cadera.', 'Sube la cadera apretando glúteos hasta alinear rodillas, cadera y hombros.', 'Aguanta 2 segundos arriba sin arquear la zona lumbar.', 'Baja despacio y repite.'] },
  'estocada-rotacion': { video: 'https://www.youtube.com/watch?v=POoO7Ca8tOY', name: 'Estocada con rotación de torso', zone: 'Caderas', sets: 2, perSide: true, reps: 5, side: 'pierna',
    cues: ['Da un paso largo y baja a una zancada con la mano del mismo lado de la pierna de atrás apoyada.', 'Lleva el codo del lado de la pierna adelantada hacia el pie.', 'Luego gira el torso y sube ese brazo hacia el techo.', 'Movimiento lento y controlado, manteniendo el equilibrio.'] },
  'tobillo-pared': { video: 'https://www.youtube.com/watch?v=Gs4AyvJpG1M', name: 'Movilidad de tobillo en la pared', zone: 'Caderas', sets: 2, perSide: true, reps: 10, side: 'pierna',
    cues: ['Pie a unos 10 cm de la pared y rodilla doblada hacia la pared.', 'Empuja la rodilla hacia delante sin levantar el talón.', 'Si es fácil, aleja un poco más el pie.', 'Es normal notar un tirón detrás del tobillo.'] },

  'gato-camello': { video: 'https://www.youtube.com/watch?v=EeGZCFmRGQQ', name: 'Gato-camello', zone: 'Espalda alta', sets: 2, perSide: false, reps: 8,
    cues: ['A cuatro apoyos con las manos bajo los hombros y las rodillas bajo la cadera.', 'Redondea la espalda mirando al ombligo y luego arquéala suavemente mirando al frente.', 'Mueve toda la columna, despacio.', 'Respira: suelta el aire al redondear.'] },
  'libro-abierto': { video: 'https://www.youtube.com/watch?v=rDviWORCWEw', name: 'Libro abierto tumbado', zone: 'Espalda alta', sets: 2, perSide: true, reps: 8, side: 'lado',
    cues: ['Tumbado de lado con las rodillas dobladas y los brazos juntos delante.', 'Abre el brazo de arriba hacia el otro lado, siguiéndolo con la mirada.', 'Las rodillas se quedan juntas y quietas.', 'Vuelve despacio y repite.'] },
  'pectoral-puerta': { video: 'https://www.youtube.com/watch?v=EQXoQ4QDr8s', name: 'Estiramiento de pectoral en marco de puerta', zone: 'Espalda alta', sets: 2, perSide: true, hold: 30, side: 'brazo',
    cues: ['Antebrazo apoyado en el marco con el codo a la altura del hombro o algo por debajo.', 'Da un paso al frente hasta notar el estiramiento en el pecho.', 'No arquees la zona lumbar ni subas el hombro.', 'Respira lento; nunca dolor en el hombro.'] },
  'nino-brazos': { video: 'https://www.youtube.com/watch?v=PC1IkjO1k5Q', name: 'Postura del niño con brazos largos', zone: 'Espalda alta', sets: 2, perSide: false, hold: 30,
    cues: ['De rodillas, siéntate hacia los talones y estira los brazos al frente.', 'Deja caer el pecho hacia el suelo.', 'Empuja suavemente las manos hacia delante para alargar la espalda.', 'Respira hacia las costillas.'] },
  'extension-silla': { video: 'https://www.youtube.com/watch?v=4ZqOMX-18O0', name: 'Extensión torácica en el respaldo de la silla', zone: 'Espalda alta', sets: 2, perSide: false, reps: 8,
    cues: ['Sentado, con las manos detrás de la cabeza y el respaldo a la altura de los omóplatos.', 'Inclínate hacia atrás sobre el respaldo extendiendo la espalda alta.', 'El movimiento sale de la espalda alta, no de la lumbar.', 'Vuelve a erguirte y repite despacio.'] },
  'retraccion-barbilla': { video: 'https://www.youtube.com/watch?v=tQYo15dpKdM', name: 'Retracción de barbilla', zone: 'Espalda alta', sets: 2, perSide: false, reps: 10,
    cues: ['Sentado o de pie, mira al frente con el cuello largo.', 'Lleva la cabeza hacia atrás como haciendo "doble barbilla", sin inclinarla.', 'Aguanta 2 segundos.', 'Vuelve despacio. Ayuda a contrarrestar la cabeza adelantada de estar sentado.'] },
  'wall-slides': { video: 'https://www.youtube.com/watch?v=uxPzcxKTdlQ', name: 'Deslizamientos en la pared', zone: 'Espalda alta', sets: 2, perSide: false, reps: 10,
    cues: ['De espaldas a la pared, con cabeza, espalda y glúteos apoyados y los codos a 90°.', 'Sube los brazos deslizándolos por la pared sin despegarlos.', 'No arquees la zona lumbar.', 'Baja despacio. Si no llegas arriba, ve hasta donde puedas.'] },
  'rotacion-toracica': { video: 'https://www.youtube.com/watch?v=ktazPiK1dMA', name: 'Rotación torácica a cuatro apoyos', zone: 'Espalda alta', sets: 2, perSide: true, reps: 8, side: 'lado',
    cues: ['A cuatro apoyos con una mano detrás de la cabeza.', 'Lleva el codo hacia la rodilla y luego gira abriéndolo hacia el techo.', 'Mueve el torso, no la cadera.', 'Sigue el codo con la mirada.'] },
  'bird-dog': { video: 'https://www.youtube.com/watch?v=MEKThiUpdyc', name: 'Bird dog', zone: 'Espalda alta', sets: 2, perSide: true, reps: 8, side: 'lado',
    cues: ['A cuatro apoyos, espalda neutra y abdomen firme.', 'Estira a la vez un brazo y la pierna contraria sin girar la cadera.', 'Aguanta 2 segundos y vuelve despacio.', 'Imagina que llevas un vaso de agua en la espalda.'] },

  'isquio-pie': { video: 'https://www.youtube.com/watch?v=ELKlkc1b7D0', name: 'Isquios de pie con pierna elevada', zone: 'Isquios', sets: 2, perSide: true, hold: 30, side: 'pierna',
    cues: ['Apoya el talón de una pierna estirada en un escalón o silla baja.', 'Inclínate hacia delante desde la cadera con la espalda recta.', 'Notarás el tirón detrás del muslo; no redondees la espalda.', 'Punta del pie hacia ti, sin forzar.'] },
  'isquio-toalla': { video: 'https://www.youtube.com/watch?v=65x3Gh7Qnwk', name: 'Isquios tumbado con toalla', zone: 'Isquios', sets: 2, perSide: true, hold: 30, side: 'pierna',
    cues: ['Tumbado boca arriba, pasa una toalla bajo el pie de una pierna.', 'Sube la pierna lo más estirada posible y ayúdate con la toalla.', 'La otra pierna se queda apoyada y relajada.', 'Tirón suave detrás del muslo, sin dolor.'] },
  'perro-abajo': { video: 'https://www.youtube.com/watch?v=syajFHRGj_Y', name: 'Perro boca abajo', zone: 'Isquios', sets: 2, perSide: false, hold: 30,
    cues: ['Manos y pies en el suelo con la cadera alta formando una uve invertida.', 'Empuja el suelo con las manos y lleva el pecho hacia los muslos.', 'Puedes doblar un poco las rodillas para estirar mejor la espalda.', 'Respira lento y talones hacia el suelo.'] },
  'inchworm': { video: 'https://www.youtube.com/watch?v=fteRyTxwz_s', name: 'Gusano (inchworm)', zone: 'Isquios', sets: 2, perSide: false, reps: 6,
    cues: ['De pie, inclínate y apoya las manos en el suelo (dobla las rodillas si hace falta).', 'Camina con las manos hacia delante hasta quedar en plancha.', 'Vuelve caminando con las manos hacia los pies.', 'Mantén el abdomen firme en todo momento.'] },
  'buenos-dias': { video: 'https://www.youtube.com/watch?v=Xhs5Gd5GTBA', name: 'Bisagra de cadera sin peso', zone: 'Isquios', sets: 2, perSide: false, reps: 10,
    cues: ['De pie, manos detrás de la cabeza o cruzadas en el pecho y rodillas ligeramente flexionadas.', 'Lleva la cadera hacia atrás con la espalda recta hasta notar tirón en los isquios.', 'Sube empujando la cadera hacia delante.', 'Es la misma bisagra del peso muerto rumano: aprovéchala para practicar.'] },
  'pm-una-pierna': { video: 'https://www.youtube.com/watch?v=DPFnfAUCvTA', name: 'Peso muerto a una pierna sin peso', zone: 'Isquios', sets: 2, perSide: true, reps: 8, side: 'pierna',
    cues: ['De pie sobre una pierna, ligeramente flexionada, apoyándote en una pared si lo necesitas.', 'Inclínate llevando la otra pierna hacia atrás, con la espalda recta.', 'Vuelve apretando el glúteo de la pierna de apoyo.', 'Cadera siempre mirando al suelo, sin girar.'] }
};

export const ROUTINES = {
  'caderas-a': { name: 'Caderas: abrir', zone: 'Caderas', ids: ['zancada-baja', 'figura-4', 'mariposa', 'rana', 'noventa-noventa', 'sentadilla-profunda'] },
  'espalda-a': { name: 'Espalda alta: abrir', zone: 'Espalda alta', ids: ['gato-camello', 'libro-abierto', 'pectoral-puerta', 'nino-brazos', 'extension-silla', 'retraccion-barbilla'] },
  'isquios-a': { name: 'Isquios: estirar', zone: 'Isquios', ids: ['isquio-pie', 'isquio-toalla', 'perro-abajo', 'zancada-baja', 'tobillo-pared'] },
  'caderas-b': { name: 'Caderas: activar', zone: 'Caderas', ids: ['circulos-cadera', 'noventa-noventa', 'puente-gluteo', 'estocada-rotacion', 'sentadilla-profunda', 'tobillo-pared'] },
  'espalda-b': { name: 'Espalda alta: activar', zone: 'Espalda alta', ids: ['wall-slides', 'rotacion-toracica', 'retraccion-barbilla', 'bird-dog', 'pectoral-puerta', 'gato-camello'] },
  'isquios-b': { name: 'Cadena posterior: activar', zone: 'Isquios', ids: ['buenos-dias', 'inchworm', 'pm-una-pierna', 'puente-gluteo', 'perro-abajo'] }
};

// Orden de rotación: recorre las tres zonas y luego repite con la variante B.
export const ROTATION = ['caderas-a', 'espalda-a', 'isquios-a', 'caderas-b', 'espalda-b', 'isquios-b'];

const stepSeconds = (ex) => (ex.hold || ex.reps * 3) * (ex.perSide ? 2 : 1) * ex.sets + 10;

export function routineMinutes(id) {
  const sec = ROUTINES[id].ids.reduce((sum, k) => sum + stepSeconds(MOB[k]), 0);
  return Math.max(1, Math.round(sec / 60));
}

export function mobVideoUrl(id) {
  const ex = MOB[id];
  if (ex.video) return ex.video;
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent('cómo hacer ' + ex.name + ' movilidad');
}

export async function suggestedRoutine() {
  const last = await getSetting('lastRoutine');
  const i = ROTATION.indexOf(last);
  return ROTATION[(i + 1) % ROTATION.length];
}

export async function favorites() {
  return (await getSetting('mobFavs', [])) || [];
}

export async function toggleFavorite(id) {
  const favs = await favorites();
  const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
  await setSetting('mobFavs', next);
  return next;
}

export async function doneToday() {
  const today = localDate();
  return (await getAll('mobility')).filter((r) => r.date === today);
}

// ---------- Pantalla guiada ----------
let host = null, hooks = {}, onExit = null;
let run = null; // { routineId, idx, step, startedAt, timer: { end, total } | null, doneSteps: {} }
let tickId = null;

function steps(ex) {
  const out = [];
  const w = { pierna: ['PIERNA DERECHA', 'PIERNA IZQUIERDA'], lado: ['LADO DERECHO', 'LADO IZQUIERDO'], brazo: ['BRAZO DERECHO', 'BRAZO IZQUIERDO'] }[ex.side || 'lado'];
  for (let s = 1; s <= ex.sets; s++) {
    if (ex.perSide) w.forEach((label) => out.push({ set: s, label }));
    else out.push({ set: s, label: null });
  }
  return out;
}

export function startMobility(container, h, routineId, exitFn) {
  host = container; hooks = h || {}; onExit = exitFn;
  run = { routineId, idx: 0, step: 0, startedAt: Date.now(), timer: null };
  hooks.immersive && hooks.immersive(true);
  keepAwake();
  showEx();
}

function stopTick() { if (tickId) clearInterval(tickId); tickId = null; }

function showEx() {
  stopTick();
  const r = ROUTINES[run.routineId];
  const id = r.ids[run.idx];
  const ex = MOB[id];
  const st = steps(ex);
  const total = r.ids.length;
  const isLast = run.idx === total - 1;
  const finished = run.step >= st.length;
  const cur = st[Math.min(run.step, st.length - 1)];
  const unit = ex.hold ? `${ex.hold} s` : `${ex.reps} repeticiones`;
  const timerRunning = !!run.timer;

  host.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="eyebrow">Movilidad · ejercicio ${run.idx + 1} de ${total}</span>
        <span class="muted small">≈ ${routineMinutes(run.routineId)} min</span>
      </div>
      <div class="seg">${r.ids.map((_, i) => `<i class="${i <= run.idx ? 'on' : ''}"></i>`).join('')}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <h1 style="font-size:28px">${esc(ex.name)}</h1>
      <span class="muted" style="font-size:15px">${esc(ex.zone)} · ${ex.sets} × ${unit}${ex.perSide ? ' por lado' : ''}</span>
    </div>
    <a class="videobox" href="${mobVideoUrl(id)}" target="_blank" rel="noopener">
      <span class="play">${svg('<path d="M8 5.5v13l11-6.5z"/>', 24, 2, 'fill="#fff" stroke="#fff"')}</span>
      <span>Ver vídeo de la técnica</span>
      <small>Necesita conexión · se abre aquí mismo</small>
    </a>
    <div class="card" style="gap:8px;padding:14px 16px">
      <span class="eyebrow">Puntos clave</span>
      ${ex.cues.map((c) => `<div class="cue"><i></i><span>${esc(c)}</span></div>`).join('')}
    </div>
    <div class="card" id="mob-card" style="flex-direction:row;align-items:center;justify-content:space-between;padding:14px 16px">
      <div style="display:flex;flex-direction:column;gap:2px">
        ${finished
          ? `<span class="eyebrow" style="color:var(--green)">Ejercicio completo</span><span style="font-size:22px;font-weight:800">Pasa al siguiente</span>`
          : `<span class="eyebrow">Serie ${cur.set} de ${ex.sets}${cur.label ? ' · ' + cur.label : ''}</span>
             <span id="mob-time" style="font-size:38px;font-weight:800;line-height:1.05;font-variant-numeric:tabular-nums">${ex.hold ? fmtClock(timerRunning ? Math.max(0, Math.ceil((run.timer.end - Date.now()) / 1000)) : ex.hold) : ex.reps + ' reps'}</span>`}
      </div>
      ${finished ? '' : `<button class="mini" id="mob-go" style="flex:none;color:var(--green);border-color:var(--green)" ${timerRunning ? 'disabled' : ''}>
        ${ex.hold ? (timerRunning ? 'En marcha' : svg('<path d="M8 5.5v13l11-6.5z"/>', 16, 2, 'fill="currentColor"') + 'Iniciar') : svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 3) + 'Hecha'}</button>`}
    </div>
    <div style="flex-grow:1"></div>
    <div class="actions">
      <button class="back-btn" id="mob-prev">${svg('<path d="M15 5l-7 7 7 7"/>', 20, 2.5)}Atrás</button>
      <button class="next-btn" id="mob-next" ${finished ? '' : 'style="opacity:.92"'}>${isLast ? 'Terminar' : 'Siguiente'}${isLast ? '' : svg('<path d="M9 5l7 7-7 7"/>', 20, 2.5)}</button>
    </div>`;

  const go = document.getElementById('mob-go');
  if (go) go.addEventListener('click', async () => {
    if (ex.hold) {
      if (await getSetting('restSound', true)) unlockAudio();
      run.timer = { end: Date.now() + ex.hold * 1000 };
      showEx();
    } else {
      run.step += 1;
      showEx();
    }
  });
  document.getElementById('mob-prev').addEventListener('click', () => {
    if (run.idx === 0) return exit();
    run.idx -= 1; run.step = 0; run.timer = null;
    showEx();
  });
  document.getElementById('mob-next').addEventListener('click', () => {
    if (isLast) return finish();
    run.idx += 1; run.step = 0; run.timer = null;
    showEx();
  });
  if (timerRunning) tickId = setInterval(tick, 250);
  host.scrollTop = 0;
}

async function tick() {
  const t = document.getElementById('mob-time');
  if (!t || !run || !run.timer) { stopTick(); return; }
  const left = Math.max(0, Math.ceil((run.timer.end - Date.now()) / 1000));
  t.textContent = fmtClock(left);
  if (left === 0) {
    stopTick();
    run.timer = null;
    run.step += 1;
    flashCard(document.getElementById('mob-card'));
    if (navigator.vibrate) navigator.vibrate(200);
    if (await getSetting('restSound', true)) beep();
    setTimeout(() => run && showEx(), 600);
  }
}

function exit() {
  stopTick();
  releaseAwake();
  run = null;
  hooks.immersive && hooks.immersive(false);
  onExit && onExit();
}

async function finish() {
  stopTick();
  releaseAwake();
  const minutes = Math.max(1, Math.round((Date.now() - run.startedAt) / 60000));
  const routineId = run.routineId;
  await put('mobility', { id: Date.now(), date: localDate(), routineId, minutes, finishedAt: new Date().toISOString() });
  await setSetting('lastRoutine', routineId);
  run = null;
  hooks.immersive && hooks.immersive(false);
  host.innerHTML = `
    <div class="head"><span class="eyebrow">${esc(ROUTINES[routineId].name)}</span><h1>Movilidad hecha</h1></div>
    <div class="status"><div class="dot">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 3, 'stroke="#fff"')}</div>
      <div><strong>Bien hecho</strong><span>Registrada hoy: ${minutes} min</span></div></div>
    <div style="flex-grow:1"></div>
    <button class="btn primary" id="mob-back" style="flex:none">Volver a Hoy</button>`;
  document.getElementById('mob-back').addEventListener('click', () => onExit && onExit());
}
