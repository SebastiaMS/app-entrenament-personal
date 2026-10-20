// Biblioteca de ejercicios y programa Push / Pull / Legs.
// Los rangos de repeticiones y series son convenciones habituales para hipertrofia,
// no cifras salidas de un estudio concreto; la app las ajusta según tu rendimiento.

// carga: 'mancuerna' (saltos de 2,5 kg), 'maquina', 'polea', 'barra', 'smith', 'discos', 'peso-corporal'
// tecnica: true = ejercicio con técnica exigente (la app sugerirá aprender primero con poco peso)
export const EXERCISES = {
  // ---------- PUSH ----------
  'press-inclinado-mancuernas': { video: 'https://www.youtube.com/watch?v=oTD5g77GgSA', name: 'Press inclinado con mancuernas', muscle: 'Pecho (parte alta)', equip: 'Banco ajustable y mancuernas', carga: 'mancuerna', sets: 3, reps: [8, 12],
    cues: ['Banco a unos 30-45°, espalda y glúteos bien apoyados.', 'Baja las mancuernas controlado hasta notar estiramiento en el pecho.', 'Empuja hacia arriba sin chocar las mancuernas ni bloquear los codos con fuerza.', 'Codos a unos 45° del tronco, no abiertos del todo.'] },
  'press-plano-smith': { video: 'https://www.youtube.com/watch?v=Iksyjnu2Q4U', name: 'Press plano en Smith', muscle: 'Pecho', equip: 'Máquina Smith y banco', carga: 'smith', sets: 3, reps: [8, 12],
    cues: ['Coloca el banco para que la barra baje a la altura del pecho medio.', 'Escápulas juntas y pecho alto durante todo el movimiento.', 'Baja controlado hasta rozar el pecho y empuja en vertical.', 'Usa los topes de seguridad de la barra.'] },
  'press-pecho-maquina': { video: 'https://www.youtube.com/watch?v=iBAUNsrwWdI', name: 'Press de pecho en máquina', muscle: 'Pecho', equip: 'Máquina de press', carga: 'maquina', sets: 3, reps: [8, 12],
    cues: ['Ajusta el asiento para que las asas queden a la altura del pecho.', 'Espalda pegada al respaldo, hombros abajo y atrás.', 'Empuja sin despegar la espalda y vuelve despacio.', 'No bloquees los codos del todo arriba.'] },
  'press-plano-mancuernas': { video: 'https://www.youtube.com/watch?v=W-qU8CF-WeU', name: 'Press plano con mancuernas', muscle: 'Pecho', equip: 'Banco y mancuernas', carga: 'mancuerna', sets: 3, reps: [8, 12],
    cues: ['Espalda apoyada, escápulas juntas, pies firmes en el suelo.', 'Baja hasta que los codos queden un poco por debajo del banco.', 'Empuja hacia arriba y ligeramente hacia dentro.', 'Si no tienes ayudante, no uses un peso con el que no puedas dejar las mancuernas con seguridad.'] },
  'pec-deck': { video: 'https://www.youtube.com/watch?v=NfQJyaxAJX8', name: 'Aperturas en pec deck', muscle: 'Pecho (aislamiento)', equip: 'Pec deck', carga: 'maquina', sets: 2, reps: [12, 15],
    cues: ['Asiento a la altura que deje los brazos a la altura del pecho.', 'Junta las manos delante del pecho, sin encoger los hombros.', 'Vuelve despacio hasta notar estiramiento, sin pasarte hacia atrás.', 'Movimiento controlado, sin rebotes.'] },
  'cruces-polea': { video: 'https://www.youtube.com/watch?v=nOswSMok7ww', name: 'Cruces en polea', muscle: 'Pecho (aislamiento)', equip: 'Poleas ajustables', carga: 'polea', sets: 2, reps: [12, 15],
    cues: ['Poleas a la altura de los hombros o algo más altas.', 'Un pie adelantado y el torso ligeramente inclinado.', 'Junta las manos delante del pecho con los codos casi estirados y algo flexionados.', 'Vuelve controlado hasta notar estiramiento en el pecho.'] },
  'press-hombro-mancuernas': { video: 'https://www.youtube.com/watch?v=SYA1r1J49R8', name: 'Press de hombro con mancuernas', muscle: 'Hombro', equip: 'Banco con respaldo y mancuernas', carga: 'mancuerna', sets: 3, reps: [8, 12],
    cues: ['Respaldo casi vertical, espalda apoyada y abdomen firme.', 'Mancuernas a la altura de las orejas, codos algo por delante del cuerpo.', 'Empuja hacia arriba sin arquear la zona lumbar.', 'Baja controlado hasta que los codos queden a unos 90°.'] },
  'press-hombro-smith': { video: 'https://www.youtube.com/watch?v=pAcFnjAH-TA', name: 'Press de hombro en Smith', muscle: 'Hombro', equip: 'Máquina Smith y banco', carga: 'smith', sets: 3, reps: [8, 12],
    cues: ['Banco casi vertical y colocado para que la barra baje por delante de la cara.', 'Baja hasta la altura de la barbilla o algo menos.', 'Empuja en vertical sin arquear la espalda.', 'Usa los topes de seguridad de la barra.'] },
  'elevaciones-laterales-mancuernas': { video: 'https://www.youtube.com/watch?v=aVa9ce3SlSA', name: 'Elevaciones laterales con mancuernas', muscle: 'Hombro (lateral)', equip: 'Mancuernas', carga: 'mancuerna', sets: 3, reps: [12, 20],
    cues: ['Peso ligero y torso estable, sin balancearte.', 'Sube los brazos hacia los lados hasta la altura de los hombros.', 'Codos ligeramente flexionados y un poco por delante del cuerpo.', 'Baja despacio; la bajada también cuenta.'] },
  'elevaciones-laterales-polea': { video: 'https://www.youtube.com/watch?v=OXLuvI4GF7E', name: 'Elevaciones laterales en polea', muscle: 'Hombro (lateral)', equip: 'Polea baja', carga: 'polea', sets: 3, reps: [12, 20],
    cues: ['Polea baja, de lado a la máquina y agarrando con la mano lejana.', 'Sube el brazo hacia el lateral hasta la altura del hombro.', 'Sin balancear el tronco.', 'Baja controlado manteniendo tensión.'] },
  'extension-triceps-polea': { video: 'https://www.youtube.com/watch?v=1g81uZqcyak', name: 'Extensión de tríceps en polea', muscle: 'Tríceps', equip: 'Polea alta', carga: 'polea', sets: 3, reps: [10, 15],
    cues: ['Codos pegados a los costados y quietos.', 'Estira los codos hasta abajo sin mover los hombros.', 'Vuelve despacio hasta que las manos lleguen cerca del pecho.', 'Torso ligeramente inclinado, sin usar el peso del cuerpo.'] },
  'press-frances-barra-z': { video: 'https://www.youtube.com/watch?v=_n194KVOxLU', name: 'Press francés con barra Z', muscle: 'Tríceps', equip: 'Banco y barra Z', carga: 'barra', sets: 3, reps: [8, 12],
    cues: ['Tumbado, brazos casi verticales y codos apuntando al techo.', 'Baja la barra hacia la frente o justo detrás de la cabeza doblando solo los codos.', 'Sube estirando los codos sin abrirlos.', 'Empieza con poco peso para cuidar los codos.'] },
  'abdominales-declinado': { video: 'https://www.youtube.com/watch?v=NO63FqJ1zXk', name: 'Abdominales en banco declinado', muscle: 'Abdomen', equip: 'Banco declinado', carga: 'peso-corporal', sets: 3, reps: [10, 15],
    cues: ['Pies bien sujetos y manos cruzadas sobre el pecho.', 'Sube enrollando el tronco, no tirando del cuello.', 'Baja controlado sin dejarte caer.', 'Si es fácil, añade un disco sobre el pecho.'] },
  'encogimiento-polea': { video: 'https://www.youtube.com/watch?v=xr_9c1IpaCU', name: 'Encogimiento de abdomen en polea', muscle: 'Abdomen', equip: 'Polea alta y cuerda', carga: 'polea', sets: 3, reps: [10, 15],
    cues: ['De rodillas, con la cuerda junto a la cabeza.', 'Enrolla el tronco llevando los codos hacia las rodillas.', 'Mueve la columna, no la cadera.', 'Vuelve despacio sin perder la tensión.'] },

  // ---------- PULL ----------
  'jalon-pecho': { video: 'https://www.youtube.com/watch?v=3eYSv1nsiIU', name: 'Jalón al pecho', muscle: 'Espalda (dorsal)', equip: 'Polea de jalón', carga: 'polea', sets: 3, reps: [8, 12],
    cues: ['Agarre algo más ancho que los hombros y muslos bien sujetos.', 'Tira de la barra hacia la parte alta del pecho llevando los codos hacia abajo.', 'Torso ligeramente inclinado hacia atrás, sin balancearte.', 'Sube despacio hasta estirar los brazos.'] },
  'jalon-convergente': { video: 'https://www.youtube.com/watch?v=4UBCW3f9Vig', name: 'Jalón convergente', muscle: 'Espalda (dorsal)', equip: 'Máquina de jalón convergente', carga: 'maquina', sets: 3, reps: [8, 12],
    cues: ['Ajusta el asiento para agarrar las asas con los brazos casi estirados.', 'Tira llevando los codos hacia las costillas.', 'Pecho alto y hombros lejos de las orejas.', 'Vuelve controlado hasta estirar del todo.'] },
  'remo-sentado-polea': { video: 'https://www.youtube.com/watch?v=nwdptbhYjTw', name: 'Remo sentado en polea', muscle: 'Espalda (dorsal y romboides)', equip: 'Polea baja', carga: 'polea', sets: 3, reps: [8, 12],
    cues: ['Rodillas ligeramente flexionadas y espalda recta.', 'Tira hacia el abdomen juntando las escápulas.', 'No te balancees: el tronco apenas se mueve.', 'Vuelve despacio dejando que las escápulas se separen.'] },
  'remo-maquina': { video: 'https://www.youtube.com/watch?v=A4D5A7i39K0', name: 'Remo en máquina', muscle: 'Espalda', equip: 'Máquina de remo', carga: 'maquina', sets: 3, reps: [8, 12],
    cues: ['Pecho apoyado en el soporte y asas a la altura del pecho.', 'Tira llevando los codos hacia atrás, cerca del cuerpo.', 'Junta las escápulas al final del movimiento.', 'Vuelve controlado sin soltar el peso de golpe.'] },
  'remo-mancuerna-banco': { video: 'https://www.youtube.com/watch?v=PKL7DvlOpM8', name: 'Remo con mancuerna en banco', muscle: 'Espalda', equip: 'Banco y mancuerna', carga: 'mancuerna', sets: 3, reps: [8, 12],
    cues: ['Rodilla y mano del mismo lado apoyadas en el banco, espalda plana.', 'Tira de la mancuerna hacia la cadera, no hacia el hombro.', 'No gires el tronco para subir el peso.', 'Baja hasta estirar el brazo sin soltar la tensión.'] },
  'remo-t-apoyo-pecho': { video: 'https://www.youtube.com/watch?v=UXi3cO3ooDc', name: 'Remo T con apoyo de pecho', muscle: 'Espalda', equip: 'Máquina de remo T', carga: 'discos', sets: 3, reps: [8, 12],
    cues: ['Pecho bien apoyado en el pad, sin levantarlo al tirar.', 'Tira de las asas hacia el abdomen llevando los codos atrás.', 'Junta las escápulas sin encoger los hombros.', 'Baja despacio hasta estirar los brazos.'] },
  'pajaros-mancuernas': { video: 'https://www.youtube.com/watch?v=-NtDTvtncy0', name: 'Pájaros con mancuernas', muscle: 'Hombro posterior', equip: 'Banco y mancuernas', carga: 'mancuerna', sets: 3, reps: [12, 20],
    cues: ['Sentado en el borde del banco, torso inclinado hacia delante y pecho cerca de los muslos.', 'Peso ligero: es un músculo pequeño.', 'Abre los brazos hacia los lados con los codos casi estirados, hasta la altura del torso.', 'Piensa en llevar las manos hacia fuera, no en juntar las escápulas con fuerza.', 'Vuelve despacio sin perder tensión y sin balancear el cuerpo.'] },
  'face-pull': { video: 'https://www.youtube.com/watch?v=BwFDZGcM0Hc', name: 'Face pull en polea', muscle: 'Hombro posterior y espalda alta', equip: 'Polea alta y cuerda', carga: 'polea', sets: 3, reps: [12, 20],
    cues: ['Polea a la altura de la cara y cuerda con agarre neutro.', 'Tira hacia la cara abriendo los codos a los lados.', 'Termina con las manos a los lados de la cabeza.', 'Peso ligero y movimiento controlado.'] },
  'curl-barra-z-scott': { video: 'https://www.youtube.com/watch?v=0AJueE--SMw', name: 'Curl con barra Z en banco Scott', muscle: 'Bíceps', equip: 'Banco Scott y barra Z', carga: 'barra', sets: 3, reps: [8, 12],
    cues: ['Axilas apoyadas en el borde del pad y brazos apoyados.', 'Sube sin levantar los codos del pad.', 'Baja despacio hasta estirar casi del todo, sin dejarte caer.', 'Empieza ligero para proteger el codo al estirar.'] },
  'curl-alterno-mancuernas': { video: 'https://www.youtube.com/watch?v=b-DeZccsPSY', name: 'Curl alterno con mancuernas', muscle: 'Bíceps', equip: 'Mancuernas', carga: 'mancuerna', sets: 3, reps: [8, 12],
    cues: ['De pie o sentado, con la espalda recta.', 'Sube una mancuerna girando la palma hacia arriba.', 'Codo pegado al costado, sin balancear el cuerpo.', 'Baja controlado antes de subir la otra.'] },
  'curl-martillo': { video: 'https://www.youtube.com/watch?v=RHdacbwKbTo', name: 'Curl martillo', muscle: 'Bíceps y braquial', equip: 'Mancuernas', carga: 'mancuerna', sets: 3, reps: [8, 12],
    cues: ['Palmas mirando hacia dentro durante todo el movimiento.', 'Sube sin mover el codo hacia delante.', 'Evita balancearte para subir el peso.', 'Baja despacio hasta estirar el brazo.'] },
  'curl-polea': { video: 'https://www.youtube.com/watch?v=7Jc4jHxax60', name: 'Curl en polea', muscle: 'Bíceps', equip: 'Polea baja', carga: 'polea', sets: 3, reps: [10, 15],
    cues: ['Polea baja con barra recta o cuerda.', 'Codos pegados a los costados y quietos.', 'Sube hasta contraer el bíceps, sin echar el cuerpo hacia atrás.', 'Baja despacio manteniendo tensión.'] },
  'curl-muneca-espalda': { video: 'https://www.youtube.com/watch?v=JKoQ9ej4UUQ', name: 'Curl de muñeca con barra por detrás', muscle: 'Antebrazo', equip: 'Barra', carga: 'barra', sets: 3, reps: [12, 20], start: { w: 17.5, r: 15 },
    cues: ['De pie, con la barra por detrás del cuerpo, agarre con las palmas hacia atrás.', 'Deja que la barra baje hasta los dedos y sube enrollando solo las muñecas.', 'Brazos quietos y pegados al cuerpo.', 'Peso ligero y repeticiones controladas; si notas dolor en la muñeca, para.'] },
  'curl-inverso': { video: 'https://www.youtube.com/watch?v=10AFVfSUzsU', name: 'Curl inverso', muscle: 'Antebrazo y braquial', equip: 'Barra Z o mancuernas', carga: 'barra', sets: 3, reps: [10, 15],
    cues: ['Agarre con las palmas hacia abajo, a la anchura de los hombros.', 'Sube sin mover los codos de los costados.', 'Mantén las muñecas rectas.', 'Baja despacio; el peso será menor que en un curl normal.'] },

  // ---------- LEGS ----------
  'prensa-45': { video: 'https://www.youtube.com/watch?v=681MG5l5SrA', name: 'Prensa de pierna 45°', muscle: 'Cuádriceps y glúteo', equip: 'Prensa inclinada', carga: 'discos', sets: 3, reps: [8, 12],
    cues: ['Pies a la anchura de los hombros en el centro de la plataforma.', 'Baja hasta que las rodillas lleguen a unos 90°, sin que se despegue la cadera.', 'Empuja con todo el pie y no bloquees las rodillas arriba.', 'Rodillas en la dirección de los pies, sin que se vayan hacia dentro.'] },
  'sentadilla-articulada': { video: 'https://www.youtube.com/watch?v=bmQ0Avf4EHo', name: 'Sentadilla en máquina articulada', muscle: 'Cuádriceps y glúteo', equip: 'Máquina de sentadilla y zancada', carga: 'discos', sets: 3, reps: [8, 12],
    cues: ['Hombros bajo los pads y espalda recta.', 'Pies a la anchura de los hombros, algo adelantados.', 'Baja controlado hasta unos 90° o hasta donde mantengas la espalda neutra.', 'Empuja con todo el pie y sube sin balancearte.'] },
  'curl-femoral-tumbado': { video: 'https://www.youtube.com/watch?v=sRMO3SbTqjk', name: 'Curl femoral tumbado', muscle: 'Isquios', equip: 'Máquina de curl femoral', carga: 'maquina', sets: 3, reps: [10, 15],
    cues: ['Rodillo sobre la parte baja de los gemelos, justo encima del tobillo.', 'Cadera pegada al banco, sin levantarla al subir.', 'Flexiona hasta que los talones se acerquen a los glúteos.', 'Baja despacio hasta estirar casi del todo.'] },
  'extension-cuadriceps': { video: 'https://www.youtube.com/watch?v=rf5Nxw0vaOc', name: 'Extensión de cuádriceps', muscle: 'Cuádriceps', equip: 'Máquina de extensión', carga: 'maquina', sets: 3, reps: [12, 15],
    cues: ['Rodillas alineadas con el eje de giro de la máquina.', 'Estira las piernas sin balancear el cuerpo.', 'Aguanta un instante arriba contrayendo el muslo.', 'Baja despacio, sin dejar caer el peso.'] },
  'hip-thrust-maquina': { video: 'https://www.youtube.com/watch?v=4ksQt-cEfng', name: 'Hip thrust en máquina', muscle: 'Glúteo', equip: 'Máquina de hip thrust de discos (tipo DHZ Evost II)', carga: 'discos', sets: 3, reps: [8, 12], tecnica: true,
    cues: ['Espalda apoyada en el respaldo y rodillo sobre la cadera, no sobre el abdomen.', 'Pies a la anchura de los hombros, con las espinillas casi verticales arriba.', 'Empuja con los talones hasta que la cadera quede alineada con el tronco.', 'Aprieta el glúteo arriba sin arquear la zona lumbar y baja controlado.'] },
  'peso-muerto-rumano-mancuernas': { video: 'https://www.youtube.com/watch?v=Y8jFtqIoyyU', name: 'Peso muerto rumano con mancuernas', muscle: 'Isquios y glúteo', equip: 'Mancuernas', carga: 'mancuerna', sets: 3, reps: [8, 12], tecnica: true,
    cues: ['Rodillas ligeramente flexionadas y mancuernas pegadas a las piernas.', 'Lleva la cadera hacia atrás como si cerraras una puerta con el glúteo.', 'Espalda recta todo el tiempo; baja hasta notar estiramiento en los isquios.', 'Sube empujando la cadera hacia delante. Empieza con poco peso.'] },
  'zancadas-mancuernas': { video: 'https://www.youtube.com/watch?v=5WrNbdXNHe8', name: 'Zancadas con mancuernas', muscle: 'Cuádriceps y glúteo', equip: 'Mancuernas', carga: 'mancuerna', sets: 3, reps: [8, 12], tecnica: true,
    cues: ['Da un paso largo y baja la rodilla de atrás hacia el suelo.', 'Torso erguido y rodilla delantera alineada con el pie.', 'Empuja con el pie de delante para volver.', 'Si pierdes el equilibrio, empieza sin peso o con apoyo.'] },
  'gemelos-sentado': { video: 'https://www.youtube.com/watch?v=Az8wdZmbVPo', name: 'Gemelos en máquina sentado', muscle: 'Gemelos (sóleo)', equip: 'Máquina de gemelos sentado', carga: 'maquina', sets: 3, reps: [12, 20],
    cues: ['Almohadillas sobre los muslos, justo encima de las rodillas.', 'Baja los talones para estirar bien el gemelo.', 'Sube lo más alto posible y aguanta un instante.', 'Sin rebotes: ritmo lento y controlado.'] }
};

// ---------- Programa ----------
// Cada día tiene 7 huecos. Cada hueco tiene la opción de la semana A y la de la semana B.
export const PROGRAM = {
  push: { name: 'Push', slots: [
    ['press-inclinado-mancuernas', 'press-plano-smith'],
    ['press-pecho-maquina', 'press-plano-mancuernas'],
    ['pec-deck', 'cruces-polea'],
    ['press-hombro-mancuernas', 'press-hombro-smith'],
    ['elevaciones-laterales-mancuernas', 'elevaciones-laterales-polea'],
    ['extension-triceps-polea', 'press-frances-barra-z'],
    ['abdominales-declinado', 'encogimiento-polea']
  ] },
  pull: { name: 'Pull', slots: [
    ['jalon-pecho', 'jalon-convergente'],
    ['remo-sentado-polea', 'remo-maquina'],
    ['remo-mancuerna-banco', 'remo-t-apoyo-pecho'],
    ['pajaros-mancuernas', 'face-pull'],
    ['curl-barra-z-scott', 'curl-alterno-mancuernas'],
    ['curl-martillo', 'curl-polea'],
    ['curl-muneca-espalda', 'curl-inverso']
  ] },
  legs: { name: 'Legs', slots: [
    ['prensa-45', 'prensa-45'],
    ['sentadilla-articulada', 'sentadilla-articulada'],
    ['curl-femoral-tumbado', 'curl-femoral-tumbado'],
    ['extension-cuadriceps', 'extension-cuadriceps'],
    ['hip-thrust-maquina', 'hip-thrust-maquina'],
    ['peso-muerto-rumano-mancuernas', 'zancadas-mancuernas'],
    ['gemelos-sentado', 'gemelos-sentado']
  ] }
};

const DAY_MS = 24 * 60 * 60 * 1000;

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dow);
  return d;
}

// Lunes de la semana siguiente (o el mismo día si hoy es lunes): así la semana A empieza en lunes.
export function nextMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const add = (8 - d.getDay()) % 7; // domingo = 0 -> 1, lunes = 1 -> 0, sábado = 6 -> 2
  d.setDate(d.getDate() + add);
  return d;
}

// Semana A o B según las semanas transcurridas desde el inicio del programa.
export function weekVariant(date, startDate) {
  const weeks = Math.round((mondayOf(date) - mondayOf(startDate)) / (7 * DAY_MS));
  if (weeks < 0) return 'A'; // antes de empezar el programa se muestra la semana A
  return weeks % 2 === 0 ? 'A' : 'B';
}

// Lista de ejercicios de un día (push/pull/legs) para la semana A o B.
export function sessionFor(day, variant) {
  const i = variant === 'B' ? 1 : 0;
  return PROGRAM[day].slots.map((pair) => ({ id: pair[i], ...EXERCISES[pair[i]] }));
}

// Enlace al vídeo. Cuando haya un vídeo elegido (campo `video`) se usa ese;
// mientras tanto abre una búsqueda en YouTube con la técnica del ejercicio.
export function videoUrl(id) {
  const ex = EXERCISES[id];
  if (ex.video) return ex.video;
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent('cómo hacer ' + ex.name + ' técnica');
}

// Otro ejercicio del mismo hueco (para ver "la semana contraria").
export function otherOption(day, id) {
  for (const pair of PROGRAM[day].slots) {
    if (pair.includes(id) && pair[0] !== pair[1]) return pair[0] === id ? pair[1] : pair[0];
  }
  return null;
}
