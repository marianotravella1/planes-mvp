import { cookies } from "next/headers";
import { hashToken, newDeviceToken } from "./ids";

// Sin cuentas: cada navegador guarda un token aleatorio. En la base solo queda su hash,
// vinculado a la persona que se anotó primero desde ese navegador.
const COOKIE_NAME = "planes_device";
const ONE_YEAR = 60 * 60 * 24 * 365;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Hash del token del navegador actual, o null si nunca se anotó desde acá. */
export async function currentDeviceHash(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token && TOKEN_PATTERN.test(token) ? hashToken(token) : null;
}

/** Igual que currentDeviceHash, pero crea el token si falta. Solo dentro de Server Actions. */
export async function ensureDeviceHash(): Promise<string> {
  const store = await cookies();
  let token = store.get(COOKIE_NAME)?.value;
  if (!token || !TOKEN_PATTERN.test(token)) {
    token = newDeviceToken();
    store.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR,
      path: "/",
    });
  }
  return hashToken(token);
}
