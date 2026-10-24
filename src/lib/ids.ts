import { createHash, randomBytes, randomInt } from "node:crypto";

// Sin 0, o, 1, l ni i para que se puedan dictar y tipear sin confundirse.
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomString(alphabet: string, length: number) {
  let value = "";
  for (let i = 0; i < length; i++) value += alphabet[randomInt(alphabet.length)];
  return value;
}

export const newEventSlug = () => randomString(SLUG_ALPHABET, 6);
export const newRedemptionCode = () => randomString(CODE_ALPHABET, 6);
export const newDeviceToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
