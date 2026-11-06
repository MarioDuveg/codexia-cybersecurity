# Cambio aplicado: Ciberseguridad = Taller 1

El código del servidor `app.js` publica a:

- RPC: `POST /rest/v1/rpc/registrar_taller`
- Cuerpo JSON: `{"p_equipo": 5, "p_taller": 1, "p_puntaje": 90}`
- Columna: `public.scores.taller_1` (máximo histórico)

No publica resultados en `batalla_final`. El ranking consulta las cinco columnas como antes.

**Para instalar la función**, ejecuta `supabase/01_instalar_taller_1.sql`
en el SQL Editor del proyecto `codexia-scores`. Si ejecutaste anteriormente
`registrar_taller`, el juego ya puede usar esa función, pero el nuevo SQL
agrega protección adicional mediante trigger para `taller_1`.

**IMPORTANTE**: Los scores antiguos en `batalla_final` no se migran ni se borran.
Para probar localmente, ejecuta `npm test` y después `npm start`.
No se requiere Supabase real para las pruebas: usan un servidor simulado.
