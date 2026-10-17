# Entrenador personal

App móvil (PWA) para registrar entrenamientos, ver tu progresión y seguir una guía basada en evidencia para ganar masa muscular. Funciona sin conexión: los datos se guardan en el propio móvil.

Estado: Fase 2 (base técnica). Las pantallas de entrenamiento, historial, calendario y nutrición se construyen en las fases siguientes.

## Instalar en iPhone
1. Abre la dirección de la app en Safari.
2. Toca Compartir y elige "Añadir a pantalla de inicio".

## Copia de seguridad
Ajustes > Exportar copia. En iPhone una web instalada puede perder sus datos si el móvil se queda sin espacio, así que conviene exportar de vez en cuando.

## Para desarrollar
Sin dependencias ni compilación. Sirve la carpeta con cualquier servidor estático. Al cambiar archivos de la app, sube `VERSION` en `sw.js` para que el móvil los actualice.
