# Entrenador personal

App móvil (PWA) para registrar entrenamientos, ver tu progresión y seguir una guía basada en evidencia para ganar masa muscular. Funciona sin conexión: los datos se guardan en el propio móvil.

Estado: versión 1.0 (fases 0-6 completas). Incluye sesiones Push/Pull/Legs con ejercicios grandes fijos y aislamiento rotando cada 4 semanas (bloques A/B), temporizador de descanso, progresión de cargas por repeticiones, movilidad diaria guiada, historial con gráficas, calendario semanal (oficina, pádel, descanso) y guía de nutrición. Pendiente: integración con la Fitbit Air (fase 8).

Los vídeos de técnica enlazan a YouTube y necesitan conexión; todo lo demás funciona sin ella.

## Instalar en iPhone
1. Abre la dirección de la app en Safari.
2. Toca Compartir y elige "Añadir a pantalla de inicio".

## Copia de seguridad
Ajustes > Exportar copia. En iPhone una web instalada puede perder sus datos si el móvil se queda sin espacio, así que conviene exportar de vez en cuando.

## Para desarrollar
Sin dependencias ni compilación. Sirve la carpeta con cualquier servidor estático. Al cambiar archivos de la app, sube `VERSION` en `sw.js` para que el móvil los actualice.
