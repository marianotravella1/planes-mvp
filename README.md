# Planes (nombre provisorio)

MVP armado para [Shippear 3.0](https://shippe.ar) (Rosario, 24 de octubre de 2026). Publicás un plan, lo compartís por WhatsApp o con un QR y se suma gente que no conocés pero tiene ganas de lo mismo. Cada vez que alguien se suma a un plan gana puntos para canjear por descuentos en negocios asociados.

## Qué hace

- **Armar un plan (con cuenta).** Quien organiza entra sin contraseña, con un link que Supabase manda al mail. Carga qué es, dónde (con sugerencias de direcciones y mapa de Google), día, horario, cupo fijo o sin límite y una descripción opcional. Nombre y teléfono se piden la primera vez y quedan en la cuenta.
- **Sumarse sin cuenta.** Desde el link o el QR, con nombre y teléfono. Si el navegador ya se anotó antes, se suma en un toque.
- **Compartir por WhatsApp.** El plan arma el mensaje con el link listo para mandar; también se puede copiar el link o usar el menú de compartir del celular.
- **Puntos.** Al sumarse aparece el cartel "Sumaste 50 puntos". En *Puntos* están el saldo, los movimientos y los beneficios. El canje descuenta los puntos y genera un código de 6 letras que vence a los 30 minutos; la pantalla del código tiene un reloj en vivo, porque en una captura vieja la hora queda congelada.
- **Pantalla para proyector.** En `/e/<código>/pantalla`: QR grande, link corto y contador que se actualiza solo cada 3 segundos.

Todos ven todos los planes. La identidad visual sigue el template [Next.js boilerplate de v0](https://v0.app/templates/next-js-boilerplate-dNTdgBEhEAn): fondo casi negro, rojo como color principal, Montserrat en los títulos e Inter en el texto.

## Correr en local

Hace falta Node 20 o más nuevo y Docker.

```bash
npm install
cp .env.example .env.local
docker compose up -d
npm run db:reset
npm run dev
```

En `.env.local` hay que completar la URL y la clave publicable del proyecto de Supabase (Project Settings > API Keys). La app queda en http://localhost:3000.

Para probar el QR con el celular, abrí la app desde la compu con su IP de la red wifi (por ejemplo `http://192.168.0.15:3000`): el QR y los links usan la misma dirección con la que se abrió la página, así que un celular en la misma wifi los puede abrir.

`npm run db:reset` borra todo y vuelve a cargar los negocios de ejemplo de `supabase/seed.sql`. Para aplicar migraciones nuevas sin borrar datos: `npm run db:migrate`.

## Cuentas con Supabase Auth

- El link mágico vuelve a `/auth/confirm`, que acepta tanto `?code=` (plantilla de mail por defecto) como `?token_hash=&type=` (plantilla personalizada). Hay que abrirlo desde el mismo navegador donde se pidió.
- En Supabase, *Authentication > URL Configuration*: poner la URL pública como *Site URL* y agregar a *Redirect URLs* `http://localhost:3000/**`, la IP local si se prueba desde el celular y la URL de Vercel.
- El servicio de mail que trae Supabase solo manda links a los mails del equipo de la organización y con pocos envíos por hora. Para abrirlo a cualquiera hay que configurar un SMTP propio (por ejemplo Resend) en *Authentication > Emails > SMTP Settings*.

## Cómo está armado

- **Next.js 16** con App Router, Server Actions y Tailwind 4. Sin librerías de componentes.
- **Postgres 17.** Las tablas y la lógica (sumarse, cupo, puntos, canje, vínculo de cuentas) están en funciones SQL dentro de `supabase/migrations`, en un esquema `app` que la API de Supabase no expone: solo el servidor de Next.js accede, con la cadena de conexión. En local corre en Docker; Supabase se usa para las cuentas.
- **Identidad sin cuenta para sumarse.** El teléfono se normaliza a formato internacional (en Argentina se asume celular con el 9). Cada navegador guarda un token aleatorio en una cookie `httpOnly` y en la base queda solo su hash. El primer navegador que se anota con un número queda vinculado: desde otro navegador esa persona se puede sumar igual, pero no ve ni canjea los puntos. Así nadie usa los puntos de otra persona con solo saber su número.
- **Cuenta de quien organiza.** La primera vez que organiza, la cuenta se vincula con su teléfono solo si ese número es nuevo o ya se anotó desde el mismo navegador. Después, entrar con la cuenta en otro celular vincula ese celular y le da acceso a sus puntos.
- **Puntos en un libro de movimientos** (`app.points_ledger`): el saldo es la suma. Un mismo plan da puntos una sola vez y quien organiza no suma por su propio plan. El cupo y el canje bloquean la fila correspondiente, así dos personas no ocupan el último lugar ni gastan el mismo saldo al mismo tiempo.
- **Direcciones y mapas sin API key.** Las sugerencias salen de [Photon](https://photon.komoot.io) (datos de OpenStreetMap) a través de `/api/places`. El plan muestra un mapa embebido de Google y un botón "Cómo llegar" que abre Google Maps con el recorrido.

## Google Maps con API key

Con un proyecto de Google Cloud (facturación activada y una API key restringida al dominio de la app) se puede:

- Cambiar el mapa embebido por la Maps Embed API oficial, en `src/lib/maps.ts`.
- Cambiar las sugerencias de direcciones por Places API (New), en `src/app/api/places/route.ts`. El formulario solo habla con esa ruta, así que el cambio queda acotado ahí.

## Pasar a Supabase y Vercel

1. Subir el esquema al proyecto de Supabase con `npx supabase link` y `npx supabase db push`, o pegando `supabase/migrations/20261024120000_init.sql` en el SQL Editor. Después, `supabase/seed.sql` con los negocios reales.
2. En Vercel, cargar `DATABASE_URL` con la cadena del *Transaction pooler* (puerto 6543), `NEXT_PUBLIC_SITE_URL` con la URL pública, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Agregar la URL de Vercel en las *Redirect URLs* de Supabase.

## Pendientes

- Verificar el teléfono con un código por SMS o WhatsApp. Hoy se confía en el número que escribe cada persona.
- Panel para que los negocios den de alta beneficios y validen los códigos.
- Dar parte de los puntos al confirmar la asistencia en el lugar, para premiar que el plan se haga.
- Cancelar la asistencia y lista de espera cuando el plan se llena.
- Modo claro, como el template.
