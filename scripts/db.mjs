// Aplica las migraciones de supabase/migrations a la base de DATABASE_URL.
//   node --env-file=.env.local scripts/db.mjs migrate   aplica las que falten
//   node --env-file=.env.local scripts/db.mjs reset     borra el esquema app, migra y carga el seed
// En Supabase, las mismas migraciones se suben con `supabase db push`.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Copiá .env.example a .env.local.");
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const sql = postgres(url, { max: 1, onnotice: () => {} });
const command = process.argv[2] ?? "migrate";

async function migrate() {
  await sql`
    create table if not exists public.local_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;
  const applied = new Set((await sql`select name from public.local_migrations`).map((row) => row.name));
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const text = await readFile(path.join(migrationsDir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(text).simple();
      await tx`insert into public.local_migrations (name) values (${file})`;
    });
    console.log(`Migración aplicada: ${file}`);
  }
}

try {
  if (command === "reset") {
    await sql.unsafe("drop schema if exists app cascade; drop table if exists public.local_migrations;").simple();
    await migrate();
    await sql.unsafe(await readFile(path.join(root, "supabase", "seed.sql"), "utf8")).simple();
    console.log("Datos de ejemplo cargados.");
  } else if (command === "migrate") {
    await migrate();
  } else {
    console.error(`Comando desconocido: ${command}. Usá migrate o reset.`);
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
