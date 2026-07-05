"use server";
import { revalidatePath } from "next/cache";
import { getPool } from "@influa/core/db/client";
import { grantCredits, grantCreditsByRef } from "@influa/core/credits/ledger";
import { requireUserId } from "@/lib/auth";

/** Garante que o usuário logado é admin. Lança se não for. */
export async function requireAdmin(): Promise<string> {
  const userId = await requireUserId();
  const { rows } = await getPool().query("select is_admin from users where id = $1", [userId]);
  if (!rows[0]?.is_admin) throw new Error("Acesso restrito");
  return userId;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { rows } = await getPool().query("select is_admin from users where id = $1", [userId]);
  return Boolean(rows[0]?.is_admin);
}

export type Report = {
  id: string;
  videoId: string;
  title: string | null;
  finalUrl: string | null;
  userEmail: string;
  reason: string;
  chargedCredits: number;
  createdAt: string;
};

/** Reports abertos (defeitos), com o vídeo, o usuário e quanto foi cobrado. */
export async function listOpenReports(): Promise<Report[]> {
  await requireAdmin();
  const { rows } = await getPool().query(
    `select r.id, r.video_id, r.reason, r.created_at, u.email,
            v.script->>'title' as title, v.final_storage_key,
            coalesce(-(select sum(amount) from credit_ledger where video_id = v.id), 0)::int as charged
     from video_reports r
     join videos v on v.id = r.video_id
     join users u on u.id = r.user_id
     where r.status = 'open'
     order by r.created_at`
  );
  return rows.map((r: any) => ({
    id: r.id, videoId: r.video_id, title: r.title,
    finalUrl: r.final_storage_key ? `/api/files/${r.final_storage_key}` : null,
    userEmail: r.email, reason: r.reason, chargedCredits: r.charged,
    createdAt: r.created_at,
  }));
}

export type Execution = {
  id: string;
  title: string;
  status: string;
  error: string | null;
  costUsd: number;
  persona: string;
  brand: string;
  email: string;
  createdAt: string;
  elapsedSec: number | null;
};
export type ExecStats = { ready: number; failed: number; running: number; costUsd: number };

/** Auditoria: últimas execuções de vídeo (status, custo, erro, tempo) + stats de 7 dias. */
export async function listExecutions(): Promise<{ executions: Execution[]; stats: ExecStats }> {
  await requireAdmin();
  const pool = getPool();
  const { rows } = await pool.query(
    `select v.id, coalesce(v.script->>'title', v.topic) as title, v.status, v.error,
            coalesce(v.actual_cost_usd, 0) as cost,
            v.created_at, extract(epoch from (v.updated_at - v.created_at)) as elapsed,
            p.name as persona, b.name as brand, u.email
     from videos v
     join personas p on p.id = v.persona_id
     join brands b on b.id = v.brand_id
     join users u on u.id = v.user_id
     order by v.created_at desc limit 60`
  );
  const { rows: st } = await pool.query(
    `select count(*) filter (where status = 'ready') as ready,
            count(*) filter (where status = 'failed') as failed,
            count(*) filter (where status not in ('ready','failed','draft')) as running,
            coalesce(sum(actual_cost_usd), 0) as cost
     from videos where created_at > now() - interval '7 days'`
  );
  return {
    executions: rows.map((r: any) => ({
      id: r.id, title: r.title ?? "(sem título)", status: r.status, error: r.error,
      costUsd: Number(r.cost), persona: r.persona, brand: r.brand, email: r.email,
      createdAt: r.created_at, elapsedSec: r.elapsed != null ? Math.round(Number(r.elapsed)) : null,
    })),
    stats: {
      ready: Number(st[0].ready), failed: Number(st[0].failed),
      running: Number(st[0].running), costUsd: Number(st[0].cost),
    },
  };
}

/** Reembolsa o report: credita de volta o que foi cobrado no vídeo (idempotente). */
export async function refundReportAction(reportId: string): Promise<{ error?: string } | undefined> {
  await requireAdmin();
  const pool = getPool();
  const { rows } = await pool.query(
    `select r.id, r.user_id, r.video_id, r.status,
            coalesce(-(select sum(amount) from credit_ledger where video_id = r.video_id), 0)::int as charged
     from video_reports r where r.id = $1`,
    [reportId]
  );
  const r = rows[0];
  if (!r) return { error: "Report não encontrado" };
  if (r.status !== "open") return { error: "Report já resolvido" };

  if (r.charged > 0) {
    await grantCreditsByRef({
      userId: r.user_id,
      amount: r.charged,
      ref: `report:${reportId}`,
      note: "reembolso: defeito reportado no vídeo",
    });
  }
  await pool.query("update video_reports set status = 'refunded' where id = $1", [reportId]);
  revalidatePath("/admin");
}

export async function rejectReportAction(reportId: string): Promise<void> {
  await requireAdmin();
  await getPool().query("update video_reports set status = 'rejected' where id = $1 and status = 'open'", [reportId]);
  revalidatePath("/admin");
}

/** Concessão manual de créditos por e-mail (útil no beta). */
export async function adminGrantCreditsAction(_prev: unknown, formData: FormData): Promise<{ error?: string; ok?: string } | undefined> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const amount = Math.floor(Number(formData.get("amount") ?? 0));
  if (!email || amount <= 0) return { error: "Informe e-mail e um valor positivo" };
  const { rows } = await getPool().query("select id from users where email = $1", [email]);
  if (!rows[0]) return { error: "Usuário não encontrado" };
  await grantCredits({ userId: rows[0].id, amount, note: "concessão manual (admin)" });
  revalidatePath("/admin");
  return { ok: `+${amount} créditos para ${email}` };
}
