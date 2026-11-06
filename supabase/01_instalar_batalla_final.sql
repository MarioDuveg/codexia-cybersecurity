-- CODEXIA: instala la tabla si todavía no existe y habilita la publicación
-- del mejor puntaje en la columna batalla_final.
-- Ejecutar UNA vez en Supabase > SQL Editor. Puede ejecutarse de nuevo.
-- No modifica ni borra los puntajes existentes de Taller 1-4.

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

-- Las páginas que ya tienes de captura y resultados usan acceso sin login.
-- Se mantiene el acceso de lectura e inserción/actualización, pero no borrado.
-- ADVERTENCIA: esto permite a terceros cambiar puntajes si tienen la API key
-- pública y conocen la API (no es un sistema antifraude).
alter table public.scores enable row level security;
revoke all on table public.scores from public, anon, authenticated;
grant select, insert, update on table public.scores to anon;

drop policy if exists scores_lectura_publica on public.scores;
drop policy if exists scores_insert_publico on public.scores;
drop policy if exists scores_update_publico on public.scores;
create policy scores_lectura_publica on public.scores for select to anon using (true);
create policy scores_insert_publico on public.scores for insert to anon with check (true);
create policy scores_update_publico on public.scores for update to anon using (true) with check (true);

-- Protege contra la reducción accidental de batalla_final, incluso si una
-- página antigua usa upsert() en lugar de la función de este proyecto.
create or replace function public.conservar_mejor_batalla_final()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.batalla_final := greatest(old.batalla_final, new.batalla_final);
  return new;
end;
$$;

drop trigger if exists scores_conservar_mejor_batalla_final on public.scores;
create trigger scores_conservar_mejor_batalla_final
before update of batalla_final on public.scores
for each row execute function public.conservar_mejor_batalla_final();

-- La petición del CTF se realiza de forma atómica (no hace lectura + escritura
-- separadas). Varias partidas concurrentes del mismo equipo no se pisan.
create or replace function public.registrar_batalla_final(
  p_equipo integer,
  p_puntaje integer
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  mejor numeric;
begin
  if p_equipo is null or p_equipo < 1 or p_equipo > 20 then
    raise exception 'El equipo debe estar entre 1 y 20.' using errcode = '22023';
  end if;
  if p_puntaje is null or p_puntaje < 1 or p_puntaje > 100 then
    raise exception 'La puntuación debe estar entre 1 y 100.' using errcode = '22023';
  end if;

  insert into public.scores (equipo, batalla_final)
  values (p_equipo, p_puntaje)
  on conflict (equipo) do update
    set batalla_final = greatest(public.scores.batalla_final, excluded.batalla_final)
  returning batalla_final into mejor;

  return mejor;
end;
$$;

revoke all on function public.conservar_mejor_batalla_final() from public, anon, authenticated;
revoke all on function public.registrar_batalla_final(integer, integer) from public, anon, authenticated;
grant execute on function public.registrar_batalla_final(integer, integer) to anon;

-- Comprobar tabla: select * from public.scores order by total desc;
-- Probar la función manualmente (¡esto modificará un score real!):
-- select public.registrar_batalla_final(1, 65);
-- select public.registrar_batalla_final(1, 35); -- conserva 65
notify pgrst, 'reload schema';
