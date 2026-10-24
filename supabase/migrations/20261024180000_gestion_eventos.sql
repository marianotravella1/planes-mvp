-- Quien organiza puede quitar gente de su plan, editarlo o eliminarlo.

-- Al quitar a alguien se le descuentan los puntos que sumó por ese plan.
alter table app.points_ledger drop constraint points_ledger_reason_check;
alter table app.points_ledger add constraint points_ledger_reason_check
  check (reason in ('join_event', 'redeem_reward', 'removed_from_event'));

-- Devuelve el plan si la cuenta es la que lo organiza; si no, corta.
create function app.event_for_host(p_slug text, p_account_id bigint)
returns app.events
language plpgsql
set search_path = ''
as $$
declare
  v_event app.events%rowtype;
begin
  select e.* into v_event
  from app.events e
  join app.participants h on h.id = e.host_id
  where e.slug = p_slug and h.account_id = p_account_id
  for update of e;

  if not found then
    raise exception 'not_host';
  end if;
  return v_event;
end;
$$;

create function app.remove_member(p_slug text, p_account_id bigint, p_participant_id bigint)
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

  -- Puntos que sumó por este plan, menos lo que ya se le haya descontado antes.
  select coalesce(sum(l.delta), 0) into v_points
  from app.points_ledger l
  where l.participant_id = p_participant_id
    and l.event_id = v_event.id
    and l.reason in ('join_event', 'removed_from_event');

  if v_points > 0 then
    insert into app.points_ledger (participant_id, delta, reason, event_id)
    values (p_participant_id, -v_points, 'removed_from_event', v_event.id);
  end if;
end;
$$;

create function app.update_event(
  p_slug text,
  p_account_id bigint,
  p_title text,
  p_description text,
  p_address text,
  p_place_name text,
  p_lat double precision,
  p_lng double precision,
  p_starts_at timestamptz,
  p_capacity integer
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_event app.events%rowtype;
  v_count integer;
begin
  v_event := app.event_for_host(p_slug, p_account_id);

  if p_starts_at > now() + interval '180 days' then
    raise exception 'event_too_far';
  end if;

  if p_capacity is not null then
    select count(*) into v_count from app.event_members m where m.event_id = v_event.id;
    if p_capacity < v_count then
      raise exception 'capacity_below_members';
    end if;
  end if;

  update app.events e
  set title = p_title,
      description = p_description,
      address = p_address,
      place_name = p_place_name,
      lat = p_lat,
      lng = p_lng,
      starts_at = p_starts_at,
      capacity = p_capacity
  where e.id = v_event.id;
end;
$$;

-- Eliminar el plan borra la lista de gente; los puntos ya sumados quedan.
create function app.delete_event(p_slug text, p_account_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_event app.events%rowtype;
begin
  v_event := app.event_for_host(p_slug, p_account_id);
  delete from app.events e where e.id = v_event.id;
end;
$$;

revoke execute on function app.event_for_host(text, bigint) from public;
revoke execute on function app.remove_member(text, bigint, bigint) from public;
revoke execute on function app.update_event(
  text, bigint, text, text, text, text, double precision, double precision, timestamptz, integer
) from public;
revoke execute on function app.delete_event(text, bigint) from public;
