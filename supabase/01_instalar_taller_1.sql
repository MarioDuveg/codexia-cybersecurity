-- CODEXIA / CIBERSEGURIDAD — TALLER 1
-- Ejecuta en Supabase > codexia-scores > SQL Editor > New query.
-- Compatible con la tabla scores existente. NO borra scores previos.
-- NO modifica las notas de Taller 2-4 ni Batalla final.
-- Si ya ejecutaste la función registrar_taller de nuestra configuración anterior,
-- puedes omitir este paso. La incluimos para instalaciones nuevas.

create table if not exists public.scores (
  equipo integer primary key check (equipo > 0),
  taller_1 numeric(10,2) not null default 0 check (taller_1 >= 0),
  taller_2 numeric(10,2) not null default 0 check (taller_2 >= 0),
  taller_3 numeric(10,2) not null default 0 check (taller_3 >= 0),
  taller_4 numeric(10,2) not null default 0 check (taller_4 >= 0),
  batalla_final numeric(10,2) not null default 0 check (batalla_final >= 0),
  total numeric(12,2) generated always as (
    taller_1 + taller_2 + taller_3 + taller_4 + batalla_final
  ) stored
);

-- Lectura y escritura públicas: tal como pediste, no hay login.
-- AVISO: cualquier persona con la clave publicable podrá enviar notas.
alter table public.scores enable row level security;
grant select, insert, update on public.scores to anon;

drop policy if exists scores_lectura_publica on public.scores;
drop policy if exists scores_insert_publico on public.scores;
drop policy if exists scores_update_publico on public.scores;
create policy scores_lectura_publica on public.scores
  for select to anon using (true);
create policy scores_insert_publico on public.scores
  for insert to anon with check (true);
create policy scores_update_publico on public.scores
  for update to anon using (true) with check (true);

-- Asegura que ningún UPDATE disminuya el mejor Taller 1.
-- No afecta los demás talleres ni Batalla final.
create or replace function public.conservar_mejor_taller_1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.taller_1 := greatest(old.taller_1, new.taller_1);
  return new;
end;
$$;

drop trigger if exists scores_conservar_mejor_taller_1 on public.scores;
create trigger scores_conservar_mejor_taller_1
  before update of taller_1 on public.scores
  for each row execute function public.conservar_mejor_taller_1();

-- Un solo RPC para todos los talleres: este CTF envía p_taller = 1.
-- La instrucción SQL modifica únicamente la columna indicada, sin carreras
-- entre partidas del mismo equipo y conservando la puntuación máxima.
create or replace function public.registrar_taller(
  p_equipo integer,
  p_taller integer,
  p_puntaje numeric
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  mejor numeric;
begin
  if p_equipo is null or p_equipo not between 1 and 20 then
    raise exception 'Equipo fuera del rango 1-20.' using errcode = '22023';
  end if;
  if p_taller is null or p_taller not between 1 and 4 then
    raise exception 'El taller debe estar entre 1 y 4.' using errcode = '22023';
  end if;
  if p_puntaje is null or p_puntaje < 0 or p_puntaje > 100 then
    raise exception 'El puntaje debe estar entre 0 y 100.' using errcode = '22023';
  end if;

  -- p_taller ya fue validado como entero 1-4; no se aceptan nombres libres.
  execute format(
    'insert into public.scores (equipo, taller_%1$s) values ($1, $2) '
    || 'on conflict (equipo) do update set taller_%1$s = '
    || 'greatest(public.scores.taller_%1$s, excluded.taller_%1$s) '
    || 'returning taller_%1$s',
    p_taller
  ) using p_equipo, p_puntaje into mejor;
  return mejor;
end;
$$;

revoke all on function public.conservar_mejor_taller_1() from public, anon, authenticated;
revoke all on function public.registrar_taller(integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.registrar_taller(integer, integer, numeric) to anon;
notify pgrst, 'reload schema';

-- Pruebas OPCIONALES en SQL Editor (¡modifican datos reales!):
-- select public.registrar_taller(1, 1, 75);
-- select public.registrar_taller(1, 1, 25); -- conserva 75 en taller_1
-- select equipo, taller_1, batalla_final, total from public.scores where equipo=1;
