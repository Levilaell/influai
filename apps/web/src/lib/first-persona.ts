// Onboarding do novo fluxo: no cadastro (com nicho), cria automaticamente a 1ª marca +
// persona (rascunho) e JÁ dispara os 4 rostos. O usuário cai direto na tela de escolher o
// rosto. O hold da criação usa o bônus (cobre a persona); o VÍDEO exige assinatura depois.
// Idempotente: se já houver persona, não recria.
import { getPool } from "@influa/core/db/client";
import { holdByRef } from "@influa/core/credits/ledger";
import { estimateCreationCredits, pickVoiceForGender } from "@influa/core/config";
import { sendJob } from "@/lib/queue";

function slugify(s: string): string {
  return (s || "persona")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Retorna o personaId pra redirecionar o usuário à tela dos rostos. null = seguiu manual. */
export async function autoStartFirstPersona(userId: string, niche: string, preview?: any): Promise<string | null> {
  const pool = getPool();
  // idempotência: já tem persona? manda pra ela (não recria).
  const { rows: has } = await pool.query("select id from personas where user_id = $1 order by created_at limit 1", [userId]);
  if (has[0]) return has[0].id;

  const p = preview?.persona ?? {};
  const look =
    (typeof p.look === "string" && p.look) ||
    `creator de conteúdo brasileiro para o nicho de ${niche}, jovem adulto, carismático, estilo casual, ambiente relevante ao negócio`;
  const gender: "masculina" | "feminina" = p.gender === "masculina" ? "masculina" : "feminina";
  const name = (typeof p.name === "string" && p.name) || "Meu influenciador";
  const brandName = niche ? niche.charAt(0).toUpperCase() + niche.slice(1) : "Minha marca";

  // 1. marca
  const { rows: b } = await pool.query("insert into brands (user_id, name) values ($1,$2) returning id", [userId, brandName]);
  const brandId = b[0].id;
  await pool.query("insert into brand_memory (brand_id) values ($1) on conflict do nothing", [brandId]);

  // 2. persona rascunho (voz coerente com o gênero)
  const seed = name.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const voice = pickVoiceForGender(gender, seed);
  const { rows: pr } = await pool.query(
    `insert into personas (user_id, brand_id, name, slug, description, niche, voice_id, moderation, face_style, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'realista','draft') returning id`,
    [userId, brandId, name, `${slugify(name)}-${userId.slice(0, 4)}`, look, niche || "geral", voice, JSON.stringify({ allowed: true, auto: true })]
  );
  const personaId = pr[0].id;

  // 3. hold da criação (usa o bônus) + dispara os 4 rostos (async, já paralelizado)
  const ref = `persona:${personaId}:creation`;
  try {
    await holdByRef({ userId, personaId, ref, amount: estimateCreationCredits(), note: `reserva: criação da persona "${name}"` });
  } catch {
    return personaId; // sem créditos (não deveria) — fica em draft, o usuário gera manual
  }
  await pool.query("update personas set status = 'candidates_generating' where id = $1", [personaId]);
  await sendJob("persona-candidates", { personaId, batch: 1 }, ref);
  return personaId;
}
