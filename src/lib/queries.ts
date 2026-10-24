import { db } from "./db";

// Los ids son bigint en Postgres y postgres.js los devuelve como string.

export type EventDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  address: string;
  placeName: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: Date;
  // Null: sin límite de personas.
  capacity: number | null;
  pointsReward: number;
  hostId: string;
  hostName: string;
  membersCount: number;
  // Mismo criterio que app.join_event: pasadas 6 horas del inicio ya no se puede sumar nadie.
  isFinished: boolean;
  // Mismo criterio que app.record_encounter: desde 2 horas antes hasta 6 horas después del inicio.
  encountersOpen: boolean;
};

export async function getEvent(slug: string) {
  const [event] = await db()<EventDetail[]>`
    select
      e.id, e.slug, e.title, e.description, e.address, e.place_name, e.lat, e.lng,
      e.starts_at, e.capacity, e.points_reward, e.host_id,
      h.name as host_name,
      (select count(*)::int from app.event_members m where m.event_id = e.id) as members_count,
      e.starts_at < now() - interval '6 hours' as is_finished,
      now() between e.starts_at - interval '2 hours' and e.starts_at + interval '6 hours' as encounters_open
    from app.events e
    join app.participants h on h.id = e.host_id
    where e.slug = ${slug}
  `;
  return event ?? null;
}

export type EventMember = { participantId: string; name: string; role: "host" | "guest"; checkedIn: boolean };

export function getEventMembers(eventId: string) {
  return db()<EventMember[]>`
    select m.participant_id, p.name, m.role, m.checked_in_at is not null as checked_in
    from app.event_members m
    join app.participants p on p.id = m.participant_id
    where m.event_id = ${eventId}
    order by m.joined_at
  `;
}

export type EventStats = {
  count: number;
  capacity: number | null;
  recentNames: string[];
  checkedIn: number;
  encounters: number;
};

export async function getEventStats(slug: string) {
  const [stats] = await db()<EventStats[]>`
    select
      e.capacity,
      (select count(*)::int from app.event_members m where m.event_id = e.id) as count,
      (select count(*)::int from app.event_members m where m.event_id = e.id and m.checked_in_at is not null) as checked_in,
      (select count(*)::int from app.encounters en where en.event_id = e.id) as encounters,
      array(
        select p.name
        from app.event_members m
        join app.participants p on p.id = m.participant_id
        where m.event_id = e.id
        order by m.joined_at desc
        limit 12
      ) as recent_names
    from app.events e
    where e.slug = ${slug}
  `;
  return stats ?? null;
}

export type UpcomingEvent = {
  slug: string;
  title: string;
  placeName: string | null;
  address: string;
  startsAt: Date;
  capacity: number | null;
  membersCount: number;
};

export function getUpcomingEvents(limit = 12) {
  return db()<UpcomingEvent[]>`
    select
      e.slug, e.title, e.place_name, e.address, e.starts_at, e.capacity,
      (select count(*)::int from app.event_members m where m.event_id = e.id) as members_count
    from app.events e
    where e.starts_at > now() - interval '3 hours'
    order by e.starts_at
    limit ${limit}
  `;
}

export type DeviceParticipant = { id: string; name: string; phoneE164: string; balance: number };

/** La persona vinculada a este navegador, con su saldo de puntos. */
export async function getDeviceParticipant(tokenHash: string | null) {
  if (!tokenHash) return null;
  const [participant] = await db()<DeviceParticipant[]>`
    select
      p.id, p.name, p.phone_e164,
      coalesce((select sum(l.delta) from app.points_ledger l where l.participant_id = p.id), 0)::int as balance
    from app.participant_devices d
    join app.participants p on p.id = d.participant_id
    where d.token_hash = ${tokenHash}
  `;
  return participant ?? null;
}

export type HostProfile = { id: string; name: string; phoneE164: string };

/** La persona vinculada a una cuenta, si ya organizó algo. */
export async function getHostProfile(accountId: string) {
  const [host] = await db()<HostProfile[]>`
    select p.id, p.name, p.phone_e164 from app.participants p where p.account_id = ${accountId}
  `;
  return host ?? null;
}

export async function isEventMember(eventId: string, participantId: string) {
  const [row] = await db()<{ exists: boolean }[]>`
    select exists (
      select 1 from app.event_members m
      where m.event_id = ${eventId} and m.participant_id = ${participantId}
    ) as exists
  `;
  return row?.exists ?? false;
}

export type Reward = {
  id: string;
  title: string;
  description: string | null;
  costPoints: number;
  businessName: string;
  businessAddress: string | null;
};

export function getRewards() {
  return db()<Reward[]>`
    select r.id, r.title, r.description, r.cost_points, b.name as business_name, b.address as business_address
    from app.rewards r
    join app.businesses b on b.id = r.business_id
    where r.active
    order by r.cost_points, r.id
  `;
}

export type LedgerEntry = {
  id: string;
  delta: number;
  reason: "join_event" | "redeem_reward" | "removed_from_event" | "attended_event" | "met_person";
  createdAt: Date;
  eventTitle: string | null;
  eventSlug: string | null;
  rewardTitle: string | null;
  businessName: string | null;
};

export function getLedger(participantId: string) {
  return db()<LedgerEntry[]>`
    select
      l.id, l.delta, l.reason, l.created_at,
      e.title as event_title, e.slug as event_slug,
      rw.title as reward_title, b.name as business_name
    from app.points_ledger l
    left join app.events e on e.id = l.event_id
    left join app.redemptions rd on rd.id = l.redemption_id
    left join app.rewards rw on rw.id = rd.reward_id
    left join app.businesses b on b.id = rw.business_id
    where l.participant_id = ${participantId}
    order by l.created_at desc, l.id desc
    limit 20
  `;
}

export type Redemption = {
  code: string;
  createdAt: Date;
  expiresAt: Date;
  costPoints: number;
  rewardTitle: string;
  rewardDescription: string | null;
  businessName: string;
  businessAddress: string | null;
  participantName: string;
};

export function getActiveRedemptions(participantId: string) {
  return db()<Redemption[]>`
    select
      rd.code, rd.created_at, rd.expires_at, rd.cost_points,
      rw.title as reward_title, rw.description as reward_description,
      b.name as business_name, b.address as business_address, p.name as participant_name
    from app.redemptions rd
    join app.rewards rw on rw.id = rd.reward_id
    join app.businesses b on b.id = rw.business_id
    join app.participants p on p.id = rd.participant_id
    where rd.participant_id = ${participantId} and rd.expires_at > now()
    order by rd.created_at desc
  `;
}

export async function getRedemption(code: string, participantId: string) {
  const [redemption] = await db()<Redemption[]>`
    select
      rd.code, rd.created_at, rd.expires_at, rd.cost_points,
      rw.title as reward_title, rw.description as reward_description,
      b.name as business_name, b.address as business_address, p.name as participant_name
    from app.redemptions rd
    join app.rewards rw on rw.id = rd.reward_id
    join app.businesses b on b.id = rw.business_id
    join app.participants p on p.id = rd.participant_id
    where rd.code = ${code} and rd.participant_id = ${participantId}
  `;
  return redemption ?? null;
}

export type MyEncounters = {
  checkedIn: boolean;
  points: number;
  encounters: { id: string; name: string; scannedByMe: boolean }[];
};

/** Con quién se encontró una persona en un plan y cuántos puntos sumó ahí. */
export async function getMyEncounters(eventId: string, participantId: string): Promise<MyEncounters> {
  const [summary] = await db()<{ checkedIn: boolean; points: number }[]>`
    select
      m.checked_in_at is not null as checked_in,
      coalesce((
        select sum(l.delta) from app.points_ledger l
        where l.participant_id = m.participant_id and l.event_id = m.event_id
          and l.reason in ('attended_event', 'met_person', 'removed_from_event')
      ), 0)::int as points
    from app.event_members m
    where m.event_id = ${eventId} and m.participant_id = ${participantId}
  `;
  const encounters = await db()<MyEncounters["encounters"]>`
    select en.id, p.name, en.scanned_by = ${participantId} as scanned_by_me
    from app.encounters en
    join app.participants p
      on p.id = case when en.participant_a = ${participantId} then en.participant_b else en.participant_a end
    where en.event_id = ${eventId}
      and (en.participant_a = ${participantId} or en.participant_b = ${participantId})
    order by en.created_at
  `;
  return { checkedIn: summary?.checkedIn ?? false, points: summary?.points ?? 0, encounters };
}

export async function getParticipantName(participantId: string) {
  const [row] = await db()<{ name: string }[]>`select p.name from app.participants p where p.id = ${participantId}`;
  return row?.name ?? null;
}
