-- MCP público (ver docs/mcp.md). Sin cuenta se pueden ver los planes y sumarse; un plan nuevo
-- se publica en la web, con la cuenta de quien organiza.

-- Rol con el que el MCP hace sus lecturas, dentro de transacciones de solo lectura. Ve solo las
-- columnas que la web ya muestra a cualquiera sin cuenta: nunca teléfonos, cuentas, dispositivos,
-- puntos ni canjes. Aunque una consulta del MCP tuviera un error, no puede leer otra cosa ni escribir.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'tiki_mcp_reader') then
    create role tiki_mcp_reader nologin;
  end if;
end
$$;

-- La app se conecta como postgres (en local y en Supabase) y toma este rol con SET LOCAL ROLE.
grant tiki_mcp_reader to postgres with set true;

grant usage on schema app to tiki_mcp_reader;
grant select (id, slug, title, description, address, place_name, lat, lng, starts_at, capacity, points_reward, host_id)
  on app.events to tiki_mcp_reader;
grant select (id, name) on app.participants to tiki_mcp_reader;
grant select (event_id, participant_id, role, joined_at, checked_in_at) on app.event_members to tiki_mcp_reader;
grant select (event_id) on app.encounters to tiki_mcp_reader;

-- Las tablas tienen RLS sin políticas, así que un rol que no es el dueño no ve ninguna fila.
-- Estas políticas abren la lectura al MCP; qué columnas ve lo deciden los GRANT de arriba.
create policy mcp_read on app.events for select to tiki_mcp_reader using (true);
create policy mcp_read on app.participants for select to tiki_mcp_reader using (true);
create policy mcp_read on app.event_members for select to tiki_mcp_reader using (true);
create policy mcp_read on app.encounters for select to tiki_mcp_reader using (true);

-- Registro de pedidos al MCP, para el límite de uso y la auditoría. La IP se guarda como HMAC
-- (client_key) y de cada pedido se guardan solo datos que no identifican a nadie.
create table app.mcp_requests (
  id bigint generated always as identity primary key,
  client_key text not null check (client_key ~ '^[0-9a-f]{64}$'),
  operation text not null check (char_length(operation) <= 60),
  -- Agrupa pedidos con un límite propio, por ejemplo "join_plan:sec39x".
  bucket text check (char_length(bucket) <= 80),
  params jsonb,
  user_agent text check (char_length(user_agent) <= 200),
  created_at timestamptz not null default now()
);
create index mcp_requests_client_idx on app.mcp_requests (client_key, created_at desc);
create index mcp_requests_created_at_idx on app.mcp_requests (created_at);
alter table app.mcp_requests enable row level security;

-- Anota un pedido si el cliente está dentro de los límites. Devuelve 'ok', o el límite que pasó
-- ('too_many_requests' o 'bucket_full'), y en ese caso no lo anota.
create function app.log_mcp_request(
  p_client_key text,
  p_operation text,
  p_params jsonb,
  p_user_agent text,
  p_per_minute integer,
  p_bucket text,
  p_bucket_per_hour integer
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  -- De a un pedido por cliente, así dos pedidos simultáneos no pasan juntos el límite.
  perform pg_advisory_xact_lock(hashtextextended(p_client_key, 0));

  if (
    select count(*) from app.mcp_requests r
    where r.client_key = p_client_key and r.created_at > now() - interval '1 minute'
  ) >= p_per_minute then
    return 'too_many_requests';
  end if;

  if p_bucket is not null and (
    select count(*) from app.mcp_requests r
    where r.client_key = p_client_key and r.bucket = p_bucket and r.created_at > now() - interval '1 hour'
  ) >= p_bucket_per_hour then
    return 'bucket_full';
  end if;

  insert into app.mcp_requests (client_key, operation, bucket, params, user_agent)
  values (p_client_key, p_operation, p_bucket, p_params, left(p_user_agent, 200));

  -- Limpieza de vez en cuando: el registro guarda 30 días.
  if random() < 0.01 then
    delete from app.mcp_requests r where r.created_at < now() - interval '30 days';
  end if;

  return 'ok';
end;
$$;

revoke execute on function app.log_mcp_request(text, text, jsonb, text, integer, text, integer) from public;
