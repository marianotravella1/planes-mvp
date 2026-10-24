-- Cuentas propias con usuario y contraseña, sin mails. Reemplazan a Supabase Auth.
create table app.accounts (
  id bigint generated always as identity primary key,
  username text not null unique check (username ~ '^[a-z0-9._]{3,30}$'),
  -- Formato: scrypt$<sal en hex>$<hash en hex>. La contraseña nunca se guarda.
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Cada sesión abierta guarda un token aleatorio en una cookie; acá queda solo su hash.
create table app.account_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  account_id bigint not null references app.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index account_sessions_account_id_idx on app.account_sessions (account_id);

alter table app.accounts enable row level security;
alter table app.account_sessions enable row level security;

-- Quien organiza queda vinculado a su cuenta en lugar de a un usuario de Supabase Auth.
alter table app.participants drop column auth_user_id;
alter table app.participants add column account_id bigint unique references app.accounts (id) on delete set null;

drop function app.create_event(
  text, text, text, text, text, double precision, double precision, timestamptz, integer, uuid, text, text, text
);
drop function app.resolve_host(uuid, text, text, text);

-- La primera vez se vincula por teléfono, solo si ese teléfono es nuevo o ya se anotó desde este
-- mismo navegador. Así nadie puede tomar la identidad (y los puntos) de otra persona con su número.
create function app.resolve_host(p_account_id bigint, p_name text, p_phone text, p_token_hash text)
returns bigint
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pid bigint;
  v_linked boolean;
begin
  select p.id into v_pid from app.participants p where p.account_id = p_account_id;

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
    set account_id = p_account_id, updated_at = now()
    where p.id = v_pid and p.account_id is null;
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
  p_account_id bigint,
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

  v_host := app.resolve_host(p_account_id, p_host_name, p_host_phone, p_token_hash);

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

revoke execute on function app.resolve_host(bigint, text, text, text) from public;
revoke execute on function app.create_event(
  text, text, text, text, text, double precision, double precision, timestamptz, integer, bigint, text, text, text
) from public;
