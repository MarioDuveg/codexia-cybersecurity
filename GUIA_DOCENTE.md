# Guía exclusiva del docente — CODEXIA // Cyber CTF

**No entregar a los alumnos hasta que terminen.**

| Nivel | Tema | Dónde buscar | Clave de práctica |
|:--:|---|---|---|
| 1 | Comentario HTML | Abrir el reto aparte → Ctrl+U → buscar `AUDITORÍA` | `Orion#73!n` |
| 2 | Elemento oculto | F12 → pestaña Elementos → buscar `ficha-de-respaldo` o `display:none` | `V3l0c1dad@24` |
| 3 | Variable CSS | F12 → `<style>` de la página → `:root` y `--clave-de-emergencia` | `F1rewall-9X!` |
| 4 | JavaScript | F12 → buscar `fragmentos`; invertir el arreglo y unirlo | `R3d-S3gura_86!` |
| 5 | Base64 | F12 → buscar `cfgToken` → en consola `atob(tokenDeRespaldo)` | `R00t_Access#26` |

## Guion sugerido de 25–30 minutos

- 3 minutos: explicar que `F12` abre las herramientas de desarrollador y cómo abrir un reto en otra pestaña.
- 18–22 minutos: competencia; deja que los equipos encuentren sus respuestas, y da una pista breve a quien se estanque (cada reto incluye botón de pistas).
- 5 minutos: proyectar `/admin`, comentar los resultados, y preguntar qué significa que una contraseña esté escondida pero pueda leerse en el navegador.

## Pantalla de cierre: matriz de debilidades

Cuando se resuelven los cinco retos, aparece un archivo final con la siguiente relación:

- **Amarillo** es débil frente a **Rojo**.
- **Rojo** es débil frente a **Verde**.
- **Verde** es débil frente a **Azul**.
- **Azul** es débil frente a **Amarillo**.

El video de la portada procede de https://youtu.be/5z5KkYpFvO4 y necesita conexión a Internet para reproducirse. Al iniciar la misión se detiene, aunque estuviera reproduciéndose. Esta matriz es información adicional al terminar y **no altera la puntuación**.

## Consideraciones para la clase

- El ranking principal usa **menor tiempo registrado por equipo**, no la hora de llegada. Además se expone el **orden de llegada** porque un equipo puede comenzar después y hacer mejor tiempo.
- El tiempo no se pausa si cierran el navegador o pierden temporalmente la conexión: transcurre desde `startedAt` hasta `completedAt` en el servidor.
- Las contraseñas son ficticias, creadas para el taller. **No son ejemplos de almacenamiento seguro ni credenciales para sistemas reales**.
- Al revisar el reto 5, subraya que **Base64 codifica, pero no cifra**. En un sistema real la autenticación debe verificarse en el servidor con prácticas seguras, y los secretos reales no se envían al navegador.
- En esta práctica los alumnos podrían inspeccionar las pistas que su navegador ha recibido; no hay respuestas de niveles bloqueados en el código HTML ni JavaScript de la página inicial.

## Reiniciar para otro grupo

Desde `/admin`, pulsa **REINICIAR COMPETENCIA** y escribe `REINICIAR`. Borra los registros y tiempos de todos los equipos. Como las sesiones de los alumnos ya no estarán en la base de datos, al actualizar deberán iniciar de nuevo.
