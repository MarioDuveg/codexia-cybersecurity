# CODEXIA // Cyber CTF — Misión Código Fantasma

Aplicación de taller para **quinto semestre de preparatoria**, con estética CODEXIA de ciencia ficción (negro, rojo, paneles HUD y arte del proyecto de referencia proporcionado). Incluye cinco retos sencillos de inspección de HTML, DOM, CSS, JavaScript y Base64, cronómetro individual por equipo y clasificación en tiempo real.

## Inicio rápido

Necesitas **Node.js 18 o superior**. No necesita paquetes externos ni conexión a Internet para ejecutarse. La tipografía Orbitron / Rajdhani se carga desde Google Fonts cuando hay conexión; sin Internet utiliza las fuentes de reserva del sistema. La imagen y los estilos principales se incluyen localmente.

```bash
npm start
```

Visita:
- **Alumnos:** http://localhost:3011
- **Docente:** http://localhost:3011/admin

En la consola de `npm start` se muestra una **contraseña temporal del docente** (generada aleatoriamente cada vez que arrancas el servidor). Para usar siempre la misma, configúrala antes de iniciar:

**macOS / Linux:**

```bash
ADMIN_PASSWORD='TuClaveDocenteSegura_2026!' npm start
```

**PowerShell (Windows):**

```powershell
$env:ADMIN_PASSWORD='TuClaveDocenteSegura_2026!'
npm start
```

Opcional: cambiar el puerto con la variable `PORT` (por defecto 3011). Para ejecutar las pruebas automáticas del flujo completo, usa `npm test`.

## Compartir con los estudiantes en el aula

1. Conecta el equipo del docente y los estudiantes **a la misma red Wi-Fi o LAN**.
2. Ejecuta `npm start` en la computadora del docente.
3. La terminal te mostrará una dirección de **red local**, por ejemplo `http://192.168.1.25:3011`. Comparte esa dirección (sin `/admin`) con los estudiantes. **No uses `localhost` en sus dispositivos**: apuntaría a sus propios equipos.
4. Abre `http://localhost:3011/admin` en tu computadora e inicia sesión con la contraseña docente.
5. Si no carga desde otro equipo, revisa que el firewall permita conexiones entrantes de Node.js al puerto 3011 y que la red no tenga aislamiento entre clientes ("AP isolation").

> No es necesario publicar la aplicación en internet. Está diseñada para un laboratorio controlado en red local. Si se publica fuera del aula, utiliza HTTPS, controles de acceso apropiados y un almacenamiento profesional.

## Funcionamiento

- Cada equipo escribe su nombre y pulsa **INICIAR MISIÓN**. El tiempo empieza en el servidor en ese instante.
- La columna izquierda muestra los 5 niveles: ✓ resuelto, → desbloqueado, ⌁ pendiente.
- Los retos se desbloquean **uno tras otro**. Los estudiantes no pueden abrir retos futuros cambiando manualmente la URL.
- En cada reto se introduce la contraseña hallada con herramientas de desarrollador y se verifica en el servidor.
- Al resolver el quinto reto se guarda la hora final y el cronómetro se detiene definitivamente.
- En `/admin`, los equipos terminados se ordenan por **menor tiempo transcurrido**. La columna *Llegada* muestra además quién terminó cronológicamente primero, segundo, etc., aunque hayan comenzado en horarios distintos.
- Los equipos en progreso siguen mostrando su tiempo actualizado.
- El panel del docente se actualiza aproximadamente cada 2,3 segundos, permite **exportar CSV** y **reiniciar la competencia** con doble confirmación mediante la palabra `REINICIAR`.

## Persistencia y comportamiento importante

Los datos se guardan automáticamente en `data/equipos.json`. Los estudiantes se identifican con una cookie `HttpOnly` propia del navegador, por lo que **deben continuar usando el mismo dispositivo y navegador**. El servidor puede reiniciarse y los registros se mantienen. Si un equipo borra sus cookies, pierde la posibilidad de recuperar su sesión en esta versión; el docente puede reiniciar la competencia si fuese necesario.

La carpeta `data` **nunca se expone** por las rutas públicas del servidor. No compartas esa carpeta ni el archivo `GUIA_DOCENTE.md` con los estudiantes antes de la actividad.

Las contraseñas son **ficticias y deliberadamente visibles en el código del reto activo**. Esa es precisamente la lección: ocultar, poner en CSS, fragmentar o codificar datos del lado cliente no los protege. El cronómetro, el progreso y el ranking se computan del lado del servidor; no se promete protección ante ataques avanzados ni trampas entre equipos.

## Estructura

```text
cyberctf-prepa/
├── app.js                  # Servidor Node.js, tiempo, API, niveles, admin
├── package.json
├── test/                   # Prueba automática de flujo y ranking
├── public/
│   ├── index.html          # Interfaz del alumno
│   ├── main.js
│   ├── admin.html          # Interfaz del docente
│   ├── admin.js
│   ├── styles.css
│   ├── challenge.css
│   └── ultron-sd-dim.webp # Arte de portada suministrado en el ZIP de referencia
├── data/                   # Se crea la base de equipos aquí
├── GUIA_DOCENTE.md         # Soluciones, sugerencias de taller
└── README.md
```

## Modificación de contraseñas

En `app.js`, al principio se encuentran las contraseñas que valida el servidor (`LEVELS`). Para cambiar alguna debes modificar **también** su pista visible en la función `levelExtra()` (comentario HTML, nodo oculto, CSS, fragmentos de JavaScript o cadena Base64). En el nivel 5, codifica la contraseña con `Buffer.from('NuevaContraseña').toString('base64')` antes de reemplazar el token.

## Apariencia CODEXIA

Esta edición adapta visualmente el proyecto con el diseño del ZIP **codexia-challenge-preregistro-url-fix**: palabra de marca CODEXIA, tipografía de interfaz futurista, negro y rojo luminoso, ornamentos HUD, recortes angulares y arte de robot suministrado. La portada de alumnos, el panel de retos, las cinco pantallas y la zona `/admin` comparten la misma identidad. El arte de portada se sirve como archivo WebP desde `/public/`, sin depender del sitio de referencia.

La modificación es **estética**, no cambia ni reinicia la base de equipos existente: si reemplazas una instalación anterior, conserva su carpeta `data/` para mantener los registros de las competencias.
