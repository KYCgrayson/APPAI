import { randomBytes } from "crypto";

const SAFE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes I, O, 0, 1

export function generateDeviceCode(): string {
  return randomBytes(32).toString("hex");
}

export function generateUserCode(): string {
  let code = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return code;
}
