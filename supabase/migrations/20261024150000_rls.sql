-- Defensa extra: el esquema app no está expuesto por la API de Supabase, pero si algún día se
-- expone, las tablas quedan cerradas. RLS sin políticas: solo el dueño (el servidor) las usa.
alter table app.participants enable row level security;
alter table app.participant_devices enable row level security;
alter table app.events enable row level security;
alter table app.event_members enable row level security;
alter table app.businesses enable row level security;
alter table app.rewards enable row level security;
alter table app.redemptions enable row level security;
alter table app.points_ledger enable row level security;
