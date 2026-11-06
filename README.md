# CODEXIA — Cyber CTF + Supabase (edición equipos 1–20)

Proyecto del mini CTF de 5 retos integrado con **Supabase, proyecto `codexia-scores`**.

## Antes de comenzar (indispensable)

1. En Supabase (`codexia-scores`), abre **SQL Editor → New query**.
2. Copia y ejecuta el archivo **`supabase/01_instalar_batalla_final.sql`**. Crea `scores` si no existe; si ya existe con las columnas de Taller 1, Taller 2, Taller 3, Taller 4 y Batalla final, la reutiliza. Crea también la función `registrar_batalla_final` y el mecanismo para que el score final **no pueda disminuir** con envíos posteriores.
3. Inicia la app con **Node.js 18+**:

```bash
npm start
```

4. Abre `http://localhost:3011`. Para ver la clasificación en la misma app: `http://localhost:3011/resultados`.
5. Si necesitas ver los resultados en **otra página web independiente**, publica `extras/resultados_externa.html`. Este archivo ya viene configurado con la URL y clave **publicable** facilitadas para el proyecto.

**IMPORTANTE:** El URL que compartiste termina en `/rest/v1/`; para configurar `SUPABASE_URL` internamente se utiliza solo el origen `https://zgpfcmvjmjfaphtudmis.supabase.co`. El servidor añade la ruta `/rest/v1/` por su cuenta. No uses claves secretas en HTML.

## Selección de equipos

- La portada muestra **ningún equipo seleccionado** de inicio: el campo está vacío y START deshabilitado.
- Introduce un entero entre **1 y 20**, o utiliza los botones **+** y **−** (desde vacío: + empieza en 1, − en 20).
- La validación también se hace en el servidor: se rechazan valores vacíos, negativos, fraccionarios o superiores a 20.
- Cuando se inicia una misión se asocia una cookie segura de sesión a ese intento del equipo; al recargar la página se reanuda el mismo intento.
- Se pueden realizar varios intentos desde el botón **REINTENTAR CON ESTE EQUIPO** una vez completada o vencida la misión. Distintos navegadores también pueden usar el mismo número de equipo. El mejor score prevalece en Supabase.

## Cronómetro de 45 minutos

El reloj comienza al aceptar `/api/start`, usando el tiempo **del servidor Node**, y no se puede pausar. El límite son **45:00 minutos**, tras los cuales ya no se aceptan respuestas y la misión finaliza aunque falten retos. El reloj se detiene al completar el quinto reto o al agotarse el tiempo. El servidor revisa vencimientos incluso sin actividad periódicamente.

## Cálculo exacto de la calificación

Son **5 retos**. La fórmula asigna un intervalo de 20 puntos según los retos resueltos; dentro de ese intervalo, terminar más rápido suma puntos. Se utiliza el tiempo en que se resolvió **el último reto correcto** (no el tiempo que el usuario deja la página abierta).

```text
Sin retos:                1 punto
Con n retos (1 a 5):     (n - 1) × 20 + 1 + redondear(19 × (1 - t / 2700000))
                         t = milisegundos transcurridos hasta el último reto
                         t se limita a [0, 2700000]  (45 minutos)
```

| Retos correctos | Puntuación posible |
|---|---:|
| 0 | 1 |
| 1 | 1–20 |
| 2 | 21–40 |
| 3 | 41–60 |
| 4 | 61–80 |
| 5 | 81–100 |

Por ejemplo, **5 retos completados casi de inmediato → 100**, mientras que **5 retos completados a los 44 minutos 59 segundos → 81**. Un equipo con más retos resueltos siempre supera en puntuación a uno con menos retos, independientemente del tiempo.

## Envío a Supabase y mejor intento

- **Tabla:** `public.scores`.
- **Identificador:** `equipo` (de 1 a 20 en esta actividad).
- **Columna actualizada:** `batalla_final`. Las demás (`taller_1`, `taller_2`, `taller_3`, `taller_4`) se conservan intactas.
- **Total:** se calcula automáticamente con las cinco columnas en Supabase.
- Se envía el score tras cada reto correctamente resuelto y al finalizar la misión. Si ocurre un fallo de red, se conserva en `data/equipos.json` y el servidor vuelve a intentar enviarlo, normalmente cada 15 segundos mientras está en funcionamiento.
- La función SQL `registrar_batalla_final` realiza un `INSERT ... ON CONFLICT DO UPDATE` con `greatest(puntaje_actual, puntaje_nuevo)` **de forma atómica**. La regla también se aplica a cambios directos sobre `batalla_final` mediante un trigger, por ejemplo desde una página de captura.
- **No necesitas una cuenta de administrador en Supabase ni iniciar sesión** para publicar o consultar. No obstante, **no hay protección antifraude**: con la clave publicable y las políticas de escritura anónima, cualquiera que conozca la API podría enviar valores o modificar otros puntajes. Para una competencia adversarial real se necesitarían controles de autenticación y autorización.

## Resultados sin login

- Ruta del servidor: `http://localhost:3011/resultados` (consulta `/api/scores`, refresca cada 10 segundos).
- HTML independiente para subir a otro dominio: `extras/resultados_externa.html` (consulta Supabase directamente, refresca cada 15 segundos).
- HTML opcional para editar talleres desde otra web: `extras/captura_talleres_externa.html` (también preconfigurado; no lo publiques si no quieres permitir modificaciones públicas).

## Configuración opcional

La URL y clave publicable de Supabase están incorporadas en `app.js` para que la conexión sea inmediata una vez instalada la función SQL. Pueden reemplazarse con variables de entorno sin tocar el código:

```bash
SUPABASE_URL='https://zgpfcmvjmjfaphtudmis.supabase.co' \
SUPABASE_PUBLISHABLE_KEY='sb_publishable_TU_CLAVE' npm start
```

El puerto predeterminado es `3011`, configurable con `PORT`. En red local visita la IP que muestra la terminal (no `localhost` desde el móvil). La aplicación requiere ejecución de **Node.js**; **no basta subir `index.html` a un hosting estático**, porque el servidor valida contraseñas, tiempos y envía scores. Para publicarla en internet, usa un hosting que ejecute Node 18+ y HTTPS, además de un almacenamiento persistente para `data/`.

## Desarrollo y verificación

```bash
npm test
```

Las pruebas usan un **simulador local de Supabase**: no envían calificaciones al proyecto real. Incluyen selección inválida, puntuaciones por nivel, 45 minutos, segundo intento con nota menor, resultado sin retos y consulta pública.

## Funcionalidades originales que se conservan

- Cinco retos secuenciales de HTML/DOM/CSS/JavaScript/Base64, validación de contraseñas en el servidor, cronómetro en servidor y video inicial.
- Archivo local `data/equipos.json` con intentos y cookies de sesión. El servidor docente original sigue accesible en `/admin` para quien lo utilice, pero **no hace falta entrar ahí para enviar scores a Supabase**. Reiniciar las partidas locales desde ese panel **no borra** los mejores resultados de Supabase.
- Contraseñas de práctica en `app.js` (`LEVELS`), con pistas y explicación en `GUIA_DOCENTE.md`.

## Nota sobre datos de una versión anterior

Si reutilizas `data/equipos.json` de una edición donde los equipos escribían nombres libres, sus intentos antiguos se conservan como historial local, pero **no se sincronizan a Supabase** porque no tenían asignado un equipo numérico (1–20). Las misiones iniciadas desde esta versión sí lo hacen.
