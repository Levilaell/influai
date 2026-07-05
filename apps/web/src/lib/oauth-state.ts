// State assinado para o OAuth (carrega brandId + userId, previne CSRF).
import crypto from "node:crypto";
import { env } from "@influa/core/env";

function sign(data: string): string {
  return crypto.createHmac("sha256", env("AUTH_SECRET")).update(data).digest("hex").slice(0, 32);
}

export function makeState(brandId: string, userId: string): string {
  const data = `${brandId}.${userId}`;
  return `${data}.${sign(data)}`;
}

export function readState(state: string): { brandId: string; userId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [brandId, userId, sig] = parts;
  if (sign(`${brandId}.${userId}`) !== sig) return null;
  return { brandId, userId };
}
