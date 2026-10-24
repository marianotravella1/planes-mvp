-- Esquema inicial del MVP: eventos, participantes sin cuenta y puntos canjeables.
-- Todo vive en el esquema "app", que Supabase no expone por su API REST:
-- solo el servidor de Next.js lo usa, con la cadena de conexión de Postgres.

create schema if not exists app;
revoke all on schema app from public;

-- Personas identificadas por teléfono. Para sumarse a un plan no hace falta cuenta;
-- quien organiza entra con un link de Supabase Auth y queda vinculado en auth_user_id.
create table app.participants (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 40),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  auth_user_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cada navegador que se anota guarda un token aleatorio en una cookie y acá queda solo su hash.
-- El navegador vinculado es el único que puede ver y canjear los puntos de esa persona.
create table app.participant_devices (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  participant_id bigint not null references app.participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index participant_devices_participant_id_idx on app.participant_devices (participant_id);

create table app.events (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]{4,16}$'),
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 600),
  host_id bigint not null references app.participants (id),
  address text not null check (char_length(address) between 3 and 200),
  place_name text check (char_length(place_name) <= 120),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  starts_at timestamptz not null,
  -- Cantidad total de personas, contando a quien organiza. Null: sin límite.
  capacity integer check (capacity between 2 and 500),
  points_reward integer not null default 50 check (points_reward between 0 and 1000),
  created_at timestamptz not null default now(),
  constraint events_coordinates_pair check ((lat is null) = (lng is null))
);
create index events_starts_at_idx on app.events (starts_at);
create index events_host_id_idx on app.events (host_id);

create table app.event_members (
  event_id bigint not null references app.events (id) on delete cascade,
  participant_id bigint not null references app.participants (id) on delete cascade,
  role text not null default 'guest' check (role in ('host', 'guest')),
  joined_at timestamptz not null default now(),
  primary key (event_id, participant_id)
);
create index event_members_participant_id_idx on app.event_members (participant_id);

-- Negocios asociados y sus beneficios. En el MVP se cargan a mano (ver supabase/seed.sql).
create table app.businesses (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 80),
  address text check (char_length(address) <= 200),
  created_at timestamptz not null default now()
);

create table app.rewards (
  id bigint generated always as identity primary key,
  business_id bigint not null references app.businesses (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 300),
  cost_points integer not null check (cost_points > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index rewards_business_id_idx on app.rewards (business_id);

create table app.redemptions (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  participant_id bigint not null references app.participants (id) on delete cascade,
  reward_id bigint not null references app.rewards (id),
  cost_points integer not null check (cost_points > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index redemptions_participant_id_idx on app.redemptions (participant_id, created_at desc);
create index redemptions_reward_id_idx on app.redemptions (reward_id);

-- Libro de puntos: el saldo es la suma de delta. Las filas no se editan, solo se agregan.
create table app.points_ledger (
  id bigint generated always as identity primary key,
  participant_id bigint not null references app.participants (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('join_event', 'redeem_reward')),
  event_id bigint references app.events (id) on delete set null,
  redemption_id bigint references app.redemptions (id) on delete set null,
  created_at timestamptz not null default now()
);
-- Sumarse a un mismo evento da puntos una sola vez.
create unique index points_ledger_join_once_idx
  on app.points_ledger (participant_id, event_id)
  where reason = 'join_event';
create index points_ledger_participant_id_idx on app.points_ledger (participant_id, created_at desc);
create index points_ledger_event_id_idx on app.points_ledger (event_id);
create index points_ledger_redemption_id_idx on app.points_ledger (redemption_id);

-- Decide quién es la persona a partir del teléfono y si este navegador queda vinculado a ella.
create function app.resolve_participant(p_name text, p_phone text, p_token_hash text)
returns table (participant_id bigint, device_linked boolean)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pid bigint;
  v_created boolean := false;
  v_token_owner bigint;
begin
  if p_token_hash is not null then
    select d.participant_id into v_token_owner
    from app.participant_devices d
    where d.token_hash = p_token_hash;
  end if;

  insert into app.participants (name, phone_e164)
  values (p_name, p_phone)
  on conflict do nothing
  returning id into v_pid;

  if v_pid is not null then
    v_created := true;
  else
    select p.id into v_pid from app.participants p where p.phone_e164 = p_phone;
  end if;

  -- Mismo navegador y misma persona: se actualiza el nombre por si lo corrigió.
  if v_token_owner = v_pid then
    update app.participants p
    set name = p_name, updated_at = now()
    where p.id = v_pid and p.name <> p_name;

    update app.participant_devices d
    set last_seen_at = now()
    where d.token_hash = p_token_hash;

    return query select v_pid, true;
    return;
  end if;

  -- Teléfono nuevo, o teléfono que todavía no tiene ningún navegador: este queda vinculado.
  if p_token_hash is not null and (
    v_created
    or not exists (select 1 from app.participant_devices d where d.participant_id = v_pid)
  ) then
    insert into app.participant_devices (token_hash, participant_id)
    values (p_token_hash, v_pid)
    on conflict (token_hash) do update
      set participant_id = excluded.participant_id, last_seen_at = now();

    return query select v_pid, true;
    return;
  end if;

  -- Teléfono conocido desde otro navegador: se anota igual, pero este navegador no ve sus puntos.
  -- Así nadie puede usar los puntos de otra persona con solo saber su número.
  return query select v_pid, false;
end;
$$;

-- Quién organiza: la persona vinculada a la cuenta. La primera vez se vincula por teléfono,
-- solo si ese teléfono es nuevo o ya se anotó desde este mismo navegador. Así nadie puede
-- tomar la identidad (y los puntos) de otra persona escribiendo su número.
create function app.resolve_host(p_auth_user_id uuid, p_name text, p_phone text, p_token_hash text)
returns bigint
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pid bigint;
  v_linked boolean;
begin
  select p.id into v_pid from app.participants p where p.auth_user_id = p_auth_user_id;

  if v_pid is null then
    if p_name is null or p_phone is null then
      raise exception 'host_profile_missing';
    end if;

    select r.participant_id, r.device_linked into v_pid, v_linked
    from app.resolve_participant(p_name, p_phone, p_token_hash) r;

    if not v_linked then
      raise exception 'phone_in_use';
    end if;

    update app.participants p
    set auth_user_id = p_auth_user_id, updated_at = now()
    where p.id = v_pid and p.auth_user_id is null;
    if not found then
      raise exception 'phone_in_use';
    end if;
  elsif p_token_hash is not null then
    -- La cuenta ya prueba quién es: este navegador queda vinculado y puede ver sus puntos.
    insert into app.participant_devices (token_hash, participant_id)
    values (p_token_hash, v_pid)
    on conflict (token_hash) do update
      set participant_id = excluded.participant_id, last_seen_at = now();
  end if;

  return v_pid;
end;
$$;

create function app.create_event(
  p_slug text,
  p_title text,
  p_description text,
  p_address text,
  p_place_name text,
  p_lat double precision,
  p_lng double precision,
  p_starts_at timestamptz,
  p_capacity integer,
  p_auth_user_id uuid,
  p_host_name text,
  p_host_phone text,
  p_token_hash text
)
returns table (event_id bigint, host_id bigint)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_host bigint;
  v_event_id bigint;
begin
  if p_starts_at < now() - interval '1 hour' then
    raise exception 'event_in_past';
  end if;
  if p_starts_at > now() + interval '180 days' then
    raise exception 'event_too_far';
  end if;

  v_host := app.resolve_host(p_auth_user_id, p_host_name, p_host_phone, p_token_hash);

  insert into app.events (
    slug, title, description, host_id, address, place_name, lat, lng, starts_at, capacity
  )
  values (
    p_slug, p_title, p_description, v_host, p_address, p_place_name, p_lat, p_lng, p_starts_at, p_capacity
  )
  returning id into v_event_id;

  insert into app.event_members (event_id, participant_id, role)
  values (v_event_id, v_host, 'host');

  return query select v_event_id, v_host;
end;
$$;

create function app.join_event(p_slug text, p_name text, p_phone text, p_token_hash text)
returns table (
  participant_id bigint,
  device_linked boolean,
  already_member boolean,
  points_awarded integer,
  balance integer,
  members_count integer,
  capacity integer
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event app.events%rowtype;
  v_pid bigint;
  v_linked boolean;
  v_already boolean := false;
  v_points integer := 0;
  v_count integer;
begin
  -- Bloquea el evento para que dos personas no ocupen el último lugar al mismo tiempo.
  select e.* into v_event from app.events e where e.slug = p_slug for update;
  if not found then
    raise exception 'event_not_found';
  end if;
  if v_event.starts_at < now() - interval '6 hours' then
    raise exception 'event_finished';
  end if;

  select r.participant_id, r.device_linked into v_pid, v_linked
  from app.resolve_participant(p_name, p_phone, p_token_hash) r;

  if exists (
    select 1 from app.event_members m
    where m.event_id = v_event.id and m.participant_id = v_pid
  ) then
    v_already := true;
  else
    if v_event.capacity is not null then
      select count(*) into v_count from app.event_members m where m.event_id = v_event.id;
      if v_count >= v_event.capacity then
        raise exception 'event_full';
      end if;
    end if;

    insert into app.event_members (event_id, participant_id, role)
    values (v_event.id, v_pid, 'guest');

    -- Quien organiza no suma puntos por su propio evento.
    if v_event.points_reward > 0 and v_pid <> v_event.host_id then
      insert into app.points_ledger (participant_id, delta, reason, event_id)
      values (v_pid, v_event.points_reward, 'join_event', v_event.id)
      on conflict do nothing;

      if found then
        v_points := v_event.points_reward;
      end if;
    end if;
  end if;

  return query
  select
    v_pid,
    v_linked,
    v_already,
    v_points,
    case
      when v_linked then (
        select coalesce(sum(l.delta), 0)::integer
        from app.points_ledger l
        where l.participant_id = v_pid
      )
    end,
    (select count(*)::integer from app.event_members m where m.event_id = v_event.id),
    v_event.capacity;
end;
$$;

create function app.redeem_reward(
  p_token_hash text,
  p_reward_id bigint,
  p_code text,
  p_valid_minutes integer
)
returns table (redemption_code text, expires_at timestamptz, balance integer)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pid bigint;
  v_reward app.rewards%rowtype;
  v_balance integer;
  v_redemption_id bigint;
  v_expires timestamptz;
begin
  select d.participant_id into v_pid
  from app.participant_devices d
  where d.token_hash = p_token_hash;
  if v_pid is null then
    raise exception 'device_not_linked';
  end if;

  -- Bloquea a la persona para que dos canjes simultáneos no gasten el mismo saldo.
  perform 1 from app.participants p where p.id = v_pid for update;

  select r.* into v_reward from app.rewards r where r.id = p_reward_id and r.active;
  if not found then
    raise exception 'reward_not_found';
  end if;

  select coalesce(sum(l.delta), 0)::integer into v_balance
  from app.points_ledger l
  where l.participant_id = v_pid;
  if v_balance < v_reward.cost_points then
    raise exception 'insufficient_points';
  end if;

  insert into app.redemptions (code, participant_id, reward_id, cost_points, expires_at)
  values (p_code, v_pid, v_reward.id, v_reward.cost_points, now() + make_interval(mins => p_valid_minutes))
  returning id, expires_at into v_redemption_id, v_expires;

  insert into app.points_ledger (participant_id, delta, reason, redemption_id)
  values (v_pid, -v_reward.cost_points, 'redeem_reward', v_redemption_id);

  return query select p_code, v_expires, v_balance - v_reward.cost_points;
end;
$$;

revoke execute on function app.resolve_participant(text, text, text) from public;
revoke execute on function app.resolve_host(uuid, text, text, text) from public;
revoke execute on function app.create_event(
  text, text, text, text, text, double precision, double precision, timestamptz, integer, uuid, text, text, text
) from public;
revoke execute on function app.join_event(text, text, text, text) from public;
revoke execute on function app.redeem_reward(text, bigint, text, integer) from public;
