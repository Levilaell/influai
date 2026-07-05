// Ledger de créditos — APPEND-ONLY. Saldo = SUM(amount). Nunca UPDATE/DELETE.
// Escritas em SQL cru: advisory locks por usuário + ON CONFLICT em índices
// únicos parciais (one_hold_per_video / one_release_per_video / *_per_ref).
import { getPool, withTx } from "../db/client.ts";

export class InsufficientCreditsError extends Error {
  constructor(public balance: number, public needed: number) {
    super(`Créditos insuficientes: saldo ${balance}, necessário ${needed}`);
    this.name = "InsufficientCreditsError";
  }
}

export async function getBalance(userId: string): Promise<number> {
  const { rows } = await getPool().query("select get_credit_balance($1) as balance", [userId]);
  return rows[0].balance;
}

export async function getLedger(userId: string, limit = 50) {
  const { rows } = await getPool().query(
    `select id, entry_type, amount, video_id, persona_id, ref, note, created_at
     from credit_ledger where user_id = $1 order by created_at desc limit $2`,
    [userId, limit]
  );
  return rows;
}

/** Concessão de admin (CLI grant-credits). */
export async function grantCredits(opts: { userId: string; amount: number; note?: string }) {
  if (opts.amount <= 0) throw new Error("amount deve ser positivo");
  await getPool().query(
    `insert into credit_ledger (user_id, entry_type, amount, note)
     values ($1, 'grant', $2, $3)`,
    [opts.userId, opts.amount, opts.note ?? "grant de admin"]
  );
}

/**
 * Concessão idempotente por ref (assinatura/topup) — o webhook pode reenviar o
 * mesmo evento; o índice único parcial one_grant_per_ref garante 1 crédito só.
 * Retorna true se concedeu agora, false se já existia.
 */
export async function grantCreditsByRef(opts: {
  userId: string;
  amount: number;
  ref: string;
  note?: string;
}): Promise<boolean> {
  if (opts.amount <= 0) throw new Error("amount deve ser positivo");
  const { rowCount } = await getPool().query(
    `insert into credit_ledger (user_id, entry_type, amount, ref, note)
     values ($1, 'grant', $2, $3, $4)
     on conflict (ref) where entry_type = 'grant' and ref is not null do nothing`,
    [opts.userId, opts.amount, opts.ref, opts.note ?? "créditos do plano"]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Enqueue de vídeo: 1 transação — lock por usuário, saldo >= estimativa,
 * hold(-N), status 'estimated' -> 'queued'. Clique duplo => unique_violation
 * no one_hold_per_video => tratado como sucesso idempotente.
 * Retorna true se o hold foi criado agora, false se já existia.
 */
export async function holdAndQueueVideo(opts: {
  userId: string;
  videoId: string;
  estimate: number;
}): Promise<boolean> {
  try {
    await withTx(async (c) => {
      await c.query("select pg_advisory_xact_lock(hashtext($1))", [`credits:${opts.userId}`]);
      const { rows } = await c.query(
        "select coalesce(sum(amount),0)::int as balance from credit_ledger where user_id = $1",
        [opts.userId]
      );
      if (rows[0].balance < opts.estimate)
        throw new InsufficientCreditsError(rows[0].balance, opts.estimate);

      await c.query(
        `insert into credit_ledger (user_id, entry_type, amount, video_id, note)
         values ($1, 'hold', $2, $3, 'hold: geração de vídeo')`,
        [opts.userId, -opts.estimate, opts.videoId]
      );
      const upd = await c.query(
        `update videos set status = 'queued', estimated_credits = $2
         where id = $1 and status in ('estimated','draft') and user_id = $3`,
        [opts.videoId, opts.estimate, opts.userId]
      );
      if (upd.rowCount !== 1) throw new Error("Vídeo em estado inválido para enfileirar");
    });
    return true;
  } catch (err: any) {
    if (err?.code === "23505") return false; // hold já existe — idempotente
    throw err;
  }
}

/**
 * Hold por ref (gastos de persona: 'persona:<id>:candidates:<n>' | 'persona:<id>:sheet').
 * Retorna true se criado agora, false se já existia (idempotente).
 */
export async function holdByRef(opts: {
  userId: string;
  personaId: string;
  ref: string;
  amount: number;
  note: string;
}): Promise<boolean> {
  try {
    await withTx(async (c) => {
      await c.query("select pg_advisory_xact_lock(hashtext($1))", [`credits:${opts.userId}`]);
      const { rows } = await c.query(
        "select coalesce(sum(amount),0)::int as balance from credit_ledger where user_id = $1",
        [opts.userId]
      );
      if (rows[0].balance < opts.amount)
        throw new InsufficientCreditsError(rows[0].balance, opts.amount);
      await c.query(
        `insert into credit_ledger (user_id, entry_type, amount, persona_id, ref, note)
         values ($1, 'hold', $2, $3, $4, $5)`,
        [opts.userId, -opts.amount, opts.personaId, opts.ref, opts.note]
      );
    });
    return true;
  } catch (err: any) {
    if (err?.code === "23505") return false;
    throw err;
  }
}

/** Devolução TOTAL do hold de um vídeo (falha terminal/cancelamento). Idempotente. */
export async function releaseVideoHold(videoId: string, note: string) {
  await getPool().query(
    `insert into credit_ledger (user_id, entry_type, amount, video_id, note)
     select user_id, 'hold_release', -amount, video_id, $2
     from credit_ledger where video_id = $1 and entry_type = 'hold'
     on conflict (video_id) where entry_type = 'hold_release' and video_id is not null do nothing`,
    [videoId, note]
  );
}

/** Devolução da SOBRA (sucesso: estimado - usado). Idempotente. */
export async function releaseVideoLeftover(videoId: string, usedCredits: number) {
  await getPool().query(
    `insert into credit_ledger (user_id, entry_type, amount, video_id, note)
     select user_id, 'hold_release', (-amount) - $2, video_id, 'sobra da estimativa'
     from credit_ledger
     where video_id = $1 and entry_type = 'hold' and (-amount) - $2 > 0
     on conflict (video_id) where entry_type = 'hold_release' and video_id is not null do nothing`,
    [videoId, usedCredits]
  );
}

/** Devolução total/sobra de um hold por ref (personas). Idempotente. */
export async function releaseRefHold(ref: string, note: string, usedCredits = 0) {
  await getPool().query(
    `insert into credit_ledger (user_id, entry_type, amount, persona_id, ref, note)
     select user_id, 'hold_release', (-amount) - $3, persona_id, ref, $2
     from credit_ledger
     where ref = $1 and entry_type = 'hold' and (-amount) - $3 > 0
     on conflict (ref) where entry_type = 'hold_release' and ref is not null do nothing`,
    [ref, note, usedCredits]
  );
}
