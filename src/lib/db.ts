import postgres from "postgres";

declare global {
  // Evita abrir un pool nuevo en cada recarga del servidor de desarrollo.
  var __planesSql: postgres.Sql | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL. Copiá .env.example a .env.local.");
  }
  return postgres(url, {
    // El pooler de Supabase en modo transacción no admite sentencias preparadas.
    prepare: false,
    max: 5,
    idle_timeout: 20,
    // Las columnas llegan en camelCase (starts_at pasa a startsAt).
    transform: postgres.camel,
  });
}

export function db() {
  if (!globalThis.__planesSql) {
    globalThis.__planesSql = createClient();
  }
  return globalThis.__planesSql;
}

/** Mensaje de un RAISE EXCEPTION de las funciones SQL (por ejemplo "event_full"). */
export function dbErrorMessage(error: unknown): string | null {
  if (error instanceof postgres.PostgresError) return error.message;
  return null;
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  return (
    error instanceof postgres.PostgresError &&
    error.code === "23505" &&
    (!constraint || error.constraint_name === constraint)
  );
}
