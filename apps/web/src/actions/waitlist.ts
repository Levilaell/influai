"use server";
import { randomUUID } from "node:crypto";
import { getPool } from "@influa/core/db/client";
import { sendJob } from "@/lib/queue";

export type WaitlistState =
  | { error?: string; ok?: string; code?: string; position?: number; referrals?: number }
  | undefined;

function genCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 7);
}

/** Entra na lista: captura email + NICHO + prévia gerada + indicação; devolve posição e código. */
export async function joinWaitlistAction(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Digite um e-mail válido." };

  const niche = String(formData.get("niche") ?? "").trim().slice(0, 120) || null;
  const ref = String(formData.get("ref") ?? "").trim().slice(0, 20) || null;
  let preview: string | null = null;
  try {
    const raw = String(formData.get("preview") ?? "");
    if (raw) preview = JSON.stringify(JSON.parse(raw)).slice(0, 8000);
  } catch {
    /* prévia opcional */
  }

  const pool = getPool();
  try {
    // upsert: preenche nicho/prévia/indicação se estavam vazios; mantém o código original
    await pool.query(
      `insert into waitlist (email, source, niche, preview, referred_by, referral_code, lead_status)
       values ($1, 'landing', $2, $3::jsonb, $4, $5, 'none')
       on conflict (email) do update set
         niche = coalesce(waitlist.niche, excluded.niche),
         preview = coalesce(waitlist.preview, excluded.preview),
         referred_by = coalesce(waitlist.referred_by, excluded.referred_by)`,
      [email, niche, preview, ref, genCode()]
    );
  } catch {
    return { error: "Algo deu errado — tenta de novo em instantes." };
  }

  // posição (rank por indicações desc, depois ordem de entrada) + código + nº de indicações + status
  const { rows } = await pool.query(
    `with ranked as (
       select w.email, w.referral_code, w.lead_status, w.niche,
              (select count(*) from waitlist r where r.referred_by = w.referral_code) as refs,
              row_number() over (
                order by (select count(*) from waitlist r where r.referred_by = w.referral_code) desc, w.created_at asc
              ) as position
       from waitlist w
     )
     select referral_code, position, refs, lead_status, niche from ranked where email = $1`,
    [email]
  );
  const me = rows[0];

  // Fase 2: dispara a geração do vídeo grátis (assíncrono) se ainda não disparou e há nicho
  if (me?.lead_status === "none" && me?.niche) {
    try {
      await pool.query("update waitlist set lead_status = 'queued' where email = $1", [email]);
      await sendJob("lead-video", { email }, `lead:${email}`);
    } catch {
      // se a fila não existir (worker off), não bloqueia a entrada na lista
      await pool.query("update waitlist set lead_status = 'none' where email = $1", [email]);
    }
  }

  return {
    ok: "Você está na lista!",
    code: me?.referral_code ?? undefined,
    position: me?.position ? Number(me.position) : undefined,
    referrals: me?.refs ? Number(me.refs) : 0,
  };
}
