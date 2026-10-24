import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db } from "./db";
import { hashToken, newDeviceToken } from "./ids";

// Cuentas propias con usuario y contraseña, sin mails. Solo las necesita quien organiza.
const SESSION_COOKIE = "planes_session";
const SESSION_DAYS = 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Abre una sesión para la cuenta y guarda el token en una cookie httpOnly. */
export async function startSession(accountId: string) {
  const token = newDeviceToken();
  await db()`
    insert into app.account_sessions (token_hash, account_id, expires_at)
    values (${hashToken(token)}, ${accountId}, now() + make_interval(days => ${SESSION_DAYS}))
  `;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token && TOKEN_PATTERN.test(token)) {
    await db()`delete from app.account_sessions where token_hash = ${hashToken(token)}`;
  }
  store.delete(SESSION_COOKIE);
}

export type SessionUser = { id: string; username: string };

/** La cuenta con sesión abierta en este navegador, si hay una vigente. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const [user] = await db()<SessionUser[]>`
    select a.id, a.username
    from app.account_sessions s
    join app.accounts a on a.id = s.account_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()
  `;
  return user ?? null;
}
