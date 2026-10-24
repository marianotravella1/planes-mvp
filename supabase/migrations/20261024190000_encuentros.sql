-- Encuentros: la asistencia se confirma cuando una persona del plan escanea el QR de otra en el lugar.
-- Sumarse ya no da puntos. El primer encuentro confirma la asistencia y da los puntos del plan;
-- cada persona nueva que se conoce después suma 10, hasta 5 personas.

alter table app.points_ledger drop constraint points_ledger_reason_check;
alter table app.points_ledger add constraint points_ledger_reason_check
  check (reason in ('join_event', 'redeem_reward', 'removed_from_event', 'attended_event', 'met_person'));

-- La asistencia da puntos una sola vez por plan.
create unique index points_ledger_attended_once_idx
  on app.points_ledger (participant_id, event_id)
  where reason = 'attended_event';

alter table app.event_members add column checked_in_at timestamptz;

-- Cada par de personas se encuentra una sola vez por plan. participant_a siempre es el id menor.
create table app.encounters (
  id bigint generated always as identity primary key,
  event_id bigint not null references app.events (id) on delete cascade,
  participant_a bigint not null references app.participants (id) on delete cascade,
  participant_b bigint not null references app.participants (id) on delete cascade,
  scanned_by bigint not null references app.participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint encounters_pair_order check (participant_a < participant_b),
  constraint encounters_pair_once unique (event_id, participant_a, participant_b)
);
create index encounters_event_id_idx on app.encounters (event_id, created_at desc);
create index encounters_participant_a_idx on app.encounters (participant_a);
create index encounters_participant_b_idx on app.encounters (participant_b);
create index encounters_scanned_by_idx on app.encounters (scanned_by);
alter table app.encounters enable row level security;

-- Sumarse queda igual, pero sin puntos: ahora se ganan al encontrarse con alguien en el lugar.
create or replace function app.join_event(p_slug text, p_name text, p_phone text, p_token_hash text)
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
  end if;

  return query
  select
    v_pid,
    v_linked,
    v_already,
    0,
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

-- Puntos que gana una persona por un encuentro nuevo, según cuántos lleva en el plan.
create function app.award_encounter(p_event app.events, p_pid bigint)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from app.encounters en
  where en.event_id = p_event.id and (en.participant_a = p_pid or en.participant_b = p_pid);

  if v_count = 1 then
    update app.event_members m
    set checked_in_at = now()
    where m.event_id = p_event.id and m.participant_id = p_pid and m.checked_in_at is null;

    if p_event.points_reward > 0 then
      insert into app.points_ledger (participant_id, delta, reason, event_id)
      values (p_pid, p_event.points_reward, 'attended_event', p_event.id)
      on conflict do nothing;
      if found then
        return p_event.points_reward;
      end if;
    end if;
    return 0;
  elsif v_count <= 6 then
    insert into app.points_ledger (participant_id, delta, reason, event_id)
    values (p_pid, 10, 'met_person', p_event.id);
    return 10;
  end if;

  return 0;
end;
$$;

-- Registra que quien escanea (identificado por su navegador) se encontró con otra persona del plan.
create function app.record_encounter(p_slug text, p_token_hash text, p_scanned_id bigint)
returns table (
  encounter_id bigint,
  other_name text,
  already_met boolean,
  scanner_points integer,
  scanned_points integer
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event app.events%rowtype;
  v_scanner bigint;
  v_a bigint;
  v_b bigint;
  v_members integer;
  v_id bigint;
  v_name text;
begin
  select e.* into v_event from app.events e where e.slug = p_slug;
  if not found then
    raise exception 'event_not_found';
  end if;
  if now() < v_event.starts_at - interval '2 hours' then
    raise exception 'too_early';
  end if;
  if now() > v_event.starts_at + interval '6 hours' then
    raise exception 'event_finished';
  end if;

  select d.participant_id into v_scanner
  from app.participant_devices d
  where d.token_hash = p_token_hash;
  if v_scanner is null then
    raise exception 'device_not_linked';
  end if;
  if v_scanner = p_scanned_id then
    raise exception 'same_person';
  end if;

  v_a := least(v_scanner, p_scanned_id);
  v_b := greatest(v_scanner, p_scanned_id);

  -- Bloquea a las dos personas en orden, así dos encuentros simultáneos no se pisan los puntos.
  perform 1
  from app.event_members m
  where m.event_id = v_event.id and m.participant_id in (v_a, v_b)
  order by m.participant_id
  for update;

  select count(*) into v_members
  from app.event_members m
  where m.event_id = v_event.id and m.participant_id in (v_a, v_b);
  if v_members < 2 then
    if not exists (
      select 1 from app.event_members m
      where m.event_id = v_event.id and m.participant_id = v_scanner
    ) then
      raise exception 'scanner_not_member';
    end if;
    raise exception 'scanned_not_member';
  end if;

  select p.name into v_name from app.participants p where p.id = p_scanned_id;

  insert into app.encounters (event_id, participant_a, participant_b, scanned_by)
  values (v_event.id, v_a, v_b, v_scanner)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select en.id into v_id
    from app.encounters en
    where en.event_id = v_event.id and en.participant_a = v_a and en.participant_b = v_b;
    return query select v_id, v_name, true, 0, 0;
    return;
  end if;

  return query
  select v_id, v_name, false, app.award_encounter(v_event, v_scanner), app.award_encounter(v_event, p_scanned_id);
end;
$$;

-- Al quitar a alguien se le descuenta todo lo que sumó por ese plan y se borran sus encuentros.
create or replace function app.remove_member(p_slug text, p_account_id bigint, p_participant_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_event app.events%rowtype;
  v_points integer;
begin
  v_event := app.event_for_host(p_slug, p_account_id);

  if p_participant_id = v_event.host_id then
    raise exception 'cannot_remove_host';
  end if;

  delete from app.event_members m
  where m.event_id = v_event.id and m.participant_id = p_participant_id;
  if not found then
    return;
  end if;

  delete from app.encounters en
  where en.event_id = v_event.id
    and (en.participant_a = p_participant_id or en.participant_b = p_participant_id);

  select coalesce(sum(l.delta), 0) into v_points
  from app.points_ledger l
  where l.participant_id = p_participant_id
    and l.event_id = v_event.id
    and l.reason in ('join_event', 'attended_event', 'met_person', 'removed_from_event');

  if v_points > 0 then
    insert into app.points_ledger (participant_id, delta, reason, event_id)
    values (p_participant_id, -v_points, 'removed_from_event', v_event.id);
  end if;
end;
$$;

revoke execute on function app.award_encounter(app.events, bigint) from public;
revoke execute on function app.record_encounter(text, text, bigint) from public;
