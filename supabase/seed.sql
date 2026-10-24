-- Negocios y beneficios de ejemplo para probar el canje de puntos.
-- Son ficticios: reemplazarlos por los negocios asociados reales antes de mostrarlo.

insert into app.businesses (name, address) values
  ('Bar La Previa (ejemplo)', 'Pichincha, Rosario'),
  ('Café del Puerto (ejemplo)', 'Puerto Norte, Rosario'),
  ('Cancha de Fútbol 5 (ejemplo)', 'Zona norte, Rosario');

insert into app.rewards (business_id, title, description, cost_points)
select b.id, r.title, r.description, r.cost_points
from (
  values
    ('Café del Puerto (ejemplo)', 'Café con medialuna de regalo', 'Un café chico y una medialuna.', 100),
    ('Bar La Previa (ejemplo)', '2x1 en pintas', 'De domingo a jueves.', 150),
    ('Cancha de Fútbol 5 (ejemplo)', '20 % de descuento en un turno', 'De lunes a jueves, antes de las 19.', 250)
) as r (business, title, description, cost_points)
join app.businesses b on b.name = r.business;
