"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool } from "@influa/core/db/client";
import { createPersonaInput } from "@influa/core/schemas";
import { moderate } from "@influa/core/moderation/gate";
import { holdByRef, InsufficientCreditsError } from "@influa/core/credits/ledger";
import { estimateCandidatesCredits, estimateCreationCredits } from "@influa/core/config";
import { requireUserId } from "@/lib/auth";
import { sendJob } from "@/lib/queue";

export type ActionState = { error?: string } | undefined;

/** Troca a voz da persona (vale para os próximos vídeos). */
export async function updatePersonaVoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const personaId = String(formData.get("personaId") ?? "");
  const voiceId = String(formData.get("voiceId") ?? "").trim();
  if (voiceId.length < 3) return { error: "Escolha uma voz" };
  const { rowCount } = await getPool().query(
    "update personas set voice_id = $3 where id = $1 and user_id = $2",
    [personaId, userId, voiceId]
  );
  if (!rowCount) return { error: "Persona não encontrada" };
  revalidatePath(`/personas/${personaId}`);
}

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
}

/** Passo 1 do wizard: cria a persona dentro de uma MARCA (moderação grátis antes de gastar). */
export async function createPersonaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const brandId = String(formData.get("brandId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(brandId)) return { error: "Marca inválida — crie o vídeo a partir de uma marca" };
  const parsed = createPersonaInput.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    niche: formData.get("niche"),
    voiceId: formData.get("voiceId"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { name, description, niche, voiceId } = parsed.data;

  const pool = getPool();
  const { rows: brand } = await pool.query("select id from brands where id = $1 and user_id = $2", [brandId, userId]);
  if (!brand[0]) return { error: "Marca não encontrada" };

  const faceStyle = formData.get("faceStyle") === "animado" ? "animado" : "realista";

  const mod = await moderate(`${name}: ${description}`, "persona");
  if (!mod.allowed) return { error: `Bloqueado pela moderação: ${mod.reason}` };

  let personaId: string;
  try {
    const { rows } = await pool.query(
      `insert into personas (user_id, brand_id, name, slug, description, niche, voice_id, moderation, face_style)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [userId, brandId, name, slugify(name), description, niche, voiceId, JSON.stringify(mod), faceStyle]
    );
    personaId = rows[0].id;
  } catch (err: any) {
    if (err?.code === "23505") return { error: "Você já tem uma persona com esse nome" };
    throw err;
  }
  redirect(`/personas/${personaId}`);
}

/** Passo 2: gera (ou re-gera) os 4 rostos candidatos. Hold por ref idempotente. */
export async function generateCandidatesAction(personaId: string): Promise<ActionState> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query(
    "select * from personas where id = $1 and user_id = $2",
    [personaId, userId]
  );
  const persona = rows[0];
  if (!persona) return { error: "Persona não encontrada" };
  // "ready" incluído: no funil novo o rosto vem automático e a escolha é OPCIONAL —
  // quem não curtiu gera 4 opções a partir da persona pronta.
  if (!["draft", "candidates_ready", "failed", "ready"].includes(persona.status))
    return { error: "Persona em processamento" };

  // 1ª geração = "criação" (cobre 4 rostos + character sheet, num preço só).
  // Re-rolls seguintes = só os 4 candidatos novos.
  const { rows: prior } = await pool.query(
    `select count(*)::int as n from credit_ledger
     where persona_id = $1 and entry_type = 'hold' and (ref = $2 or ref like $3)`,
    [personaId, `persona:${personaId}:creation`, `persona:${personaId}:candidates:%`]
  );
  const isFirst = prior[0].n === 0;
  const batch = prior[0].n + 1;
  const ref = isFirst ? `persona:${personaId}:creation` : `persona:${personaId}:candidates:${batch}`;
  const amount = isFirst ? estimateCreationCredits() : estimateCandidatesCredits();

  try {
    await holdByRef({
      userId,
      personaId,
      ref,
      amount,
      note: isFirst
        ? `reserva: criação da persona "${persona.name}" (rostos + character sheet)`
        : `reserva: novos rostos da persona "${persona.name}"`,
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError)
      return { error: `Créditos insuficientes (${err.balance}/${err.needed})` };
    throw err;
  }

  // Re-roll: limpa candidatos do batch anterior (só quando não escolhidos)
  if (batch > 1) {
    await pool.query("delete from persona_assets where persona_id = $1 and kind = 'candidate'", [personaId]);
  }

  await pool.query("update personas set status = 'candidates_generating', error = null where id = $1", [personaId]);
  await sendJob("persona-candidates", { personaId, batch }, ref);
  revalidatePath(`/personas/${personaId}`);
}

/**
 * Passo 3: escolher o rosto é GRÁTIS — o character sheet já foi pago na criação.
 * Dispara o job do sheet (identity lock em 3 ângulos) sem novo hold.
 */
export async function chooseCandidateAction(personaId: string, assetId: string): Promise<ActionState> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query(
    "select * from personas where id = $1 and user_id = $2",
    [personaId, userId]
  );
  const persona = rows[0];
  if (!persona) return { error: "Persona não encontrada" };
  if (persona.status !== "candidates_ready") return { error: "Escolha indisponível neste estado" };

  const { rows: asset } = await pool.query(
    "select id from persona_assets where id = $1 and persona_id = $2 and kind = 'candidate'",
    [assetId, personaId]
  );
  if (!asset[0]) return { error: "Rosto inválido" };

  await pool.query("update personas set status = 'sheet_generating', error = null where id = $1", [personaId]);
  // Sem hold: o custo do sheet está incluído no hold de criação.
  await sendJob("persona-sheet", { personaId, chosenAssetId: assetId }, `persona:${personaId}:sheet`);
  revalidatePath(`/personas/${personaId}`);
}

/** Renomeia a persona (o influenciador). */
export async function renamePersonaAction(personaId: string, name: string): Promise<ActionState> {
  const userId = await requireUserId();
  const n = String(name ?? "").trim().slice(0, 60);
  if (!n) return { error: "O nome não pode ficar vazio" };
  const { rowCount } = await getPool().query(
    "update personas set name = $3 where id = $1 and user_id = $2",
    [personaId, userId, n]
  );
  if (!rowCount) return { error: "Persona não encontrada" };
  revalidatePath(`/personas/${personaId}`);
}
