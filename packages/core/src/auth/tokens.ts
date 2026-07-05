// Tokens de verificação de e-mail e reset de senha. O token cru vai só no e-mail;
// no banco guardamos o hash. Uso único, com expiração.
import crypto from "node:crypto";
import { getPool } from "../db/client.ts";

export type TokenKind = "verify" | "reset";

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** Cria um token e devolve o valor CRU (para o link do e-mail). */
export async function createAuthToken(userId: string, kind: TokenKind, ttlMs: number): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + ttlMs).toISOString();
  await getPool().query(
    "insert into auth_tokens (user_id, kind, token_hash, expires_at) values ($1, $2, $3, $4)",
    [userId, kind, sha256(raw), expires]
  );
  return raw;
}

/** Consome um token válido (uso único). Retorna o userId ou null. */
export async function consumeAuthToken(kind: TokenKind, raw: string): Promise<string | null> {
  const { rows } = await getPool().query(
    `update auth_tokens set used_at = now()
     where token_hash = $1 and kind = $2 and used_at is null and expires_at > now()
     returning user_id`,
    [sha256(raw), kind]
  );
  return rows[0]?.user_id ?? null;
}
