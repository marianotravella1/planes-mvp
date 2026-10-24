"use server";

import { redirect } from "next/navigation";
import { hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { db, isUniqueViolation } from "@/lib/db";
import { safeNextPath } from "@/lib/site";

export type AuthMode = "login" | "signup";

export type AuthState = {
  mode: AuthMode;
  username?: string;
  error?: string;
  fieldErrors?: { username?: string; password?: string };
};

export async function authenticate(prev: AuthState, formData: FormData): Promise<AuthState> {
  const mode: AuthMode = formData.get("mode") === "signup" ? "signup" : "login";
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  const fieldErrors: AuthState["fieldErrors"] = {};
  if (!/^[a-z0-9._]{3,30}$/.test(username))
    fieldErrors.username = "Entre 3 y 30 caracteres: letras, números, punto o guion bajo.";
  if (password.length < 6) fieldErrors.password = "Usá al menos 6 caracteres.";
  if (fieldErrors.username || fieldErrors.password) return { mode, username, fieldErrors };

  let accountId: string | null = null;

  if (mode === "signup") {
    try {
      const [account] = await db()<{ id: string }[]>`
        insert into app.accounts (username, password_hash)
        values (${username}, ${await hashPassword(password)})
        returning id
      `;
      accountId = account.id;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { mode, username, fieldErrors: { username: "Ese usuario ya existe. Elegí otro o entrá." } };
      }
      console.error("signup", error);
      return { mode, username, error: "No pudimos crear la cuenta. Probá de nuevo en un momento." };
    }
  } else {
    const [account] = await db()<{ id: string; passwordHash: string }[]>`
      select id, password_hash from app.accounts where username = ${username}
    `;
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      return { mode, username, error: "El usuario o la contraseña no coinciden." };
    }
    accountId = account.id;
  }

  await startSession(accountId);
  redirect(next);
}
