"use server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool } from "@influa/core/db/client";
import { getStorage } from "@influa/core/storage/index";
import {
  extractBrandProfile,
  generateIdeas,
  generateBrandScenes,
  brandProfileFromPersona,
  type BrandProfile,
  type BrandScene,
  type VideoIdea,
} from "@influa/core/brand/index";
import { getBrandMemory, memoryForPrompt } from "@influa/core/brand/memory";
import { objectiveIdeaHint } from "@influa/core/pipeline/format";
import { requireUserId } from "@/lib/auth";
import { track } from "@influa/core/analytics";

// Rate-limit leve por usuário para chamadas de LLM grátis (ideias/cérebro).
// Janela deslizante em memória — suficiente p/ MVP; em produção, Redis/DB.
const llmHits = new Map<string, number[]>();
function rateLimit(userId: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (llmHits.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  llmHits.set(userId, arr);
  return true;
}

async function ownBrand(userId: string, brandId: string) {
  const { rows } = await getPool().query(
    "select id, name from brands where id = $1 and user_id = $2",
    [brandId, userId]
  );
  return rows[0] ?? null;
}

export async function createBrandAction(_prev: unknown, formData: FormData): Promise<{ error?: string } | undefined> {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Dê um nome à marca" };
  const { rows } = await getPool().query(
    "insert into brands (user_id, name) values ($1, $2) returning id",
    [userId, name]
  );
  await getPool().query("insert into brand_memory (brand_id) values ($1) on conflict do nothing", [rows[0].id]);
  redirect(`/brands/${rows[0].id}`);
}

// Gera e guarda cenários sob medida da marca (best-effort — não bloqueia o fluxo).
async function refreshBrandScenes(brandId: string, profile: BrandProfile) {
  try {
    const scenes = await generateBrandScenes(profile);
    await getPool().query("update brands set scenes = $2 where id = $1", [brandId, JSON.stringify(scenes)]);
  } catch {
    /* ignora — o form cai nos cenários de reserva */
  }
}

export async function listBrandScenes(brandId: string): Promise<BrandScene[]> {
  const { rows } = await getPool().query("select scenes from brands where id = $1", [brandId]);
  const s = rows[0]?.scenes;
  return Array.isArray(s) ? s : [];
}

async function saveBrandProfile(userId: string, brandId: string, p: BrandProfile, source: string) {
  await getPool().query(
    `insert into brand_profiles
       (brand_id, user_id, business, audience, value_proposition, tone, niche,
        content_pillars, products, confidence, notes, source)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (brand_id) do update set
       business=$3, audience=$4, value_proposition=$5, tone=$6, niche=$7,
       content_pillars=$8, products=$9, confidence=$10, notes=$11, source=$12`,
    [
      brandId, userId, p.business, p.audience, p.value_proposition, p.tone, p.niche,
      JSON.stringify(p.content_pillars), JSON.stringify(p.products), p.confidence, p.notes, source,
    ]
  );
}

export type CaptureResult = { profile?: BrandProfile; error?: string };

/** Captura o Cérebro da Marca de um print (data URL) e/ou texto colado. */
export async function captureBrandAction(
  brandId: string,
  input: { imageDataUrl?: string; text?: string }
): Promise<CaptureResult> {
  const userId = await requireUserId();
  if (!(await ownBrand(userId, brandId))) return { error: "Marca não encontrada" };
  if (!rateLimit(userId, 20, 60 * 60 * 1000))
    return { error: "Muitas análises em pouco tempo — espere alguns minutos." };

  let image;
  if (input.imageDataUrl) {
    const m = input.imageDataUrl.match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);
    if (!m) return { error: "Imagem inválida" };
    image = { base64: m[3], mediaType: m[1] as "image/png" | "image/jpeg" | "image/webp" };
  }
  const text = input.text?.trim() || undefined;
  if (!image && !text) return { error: "Cole um print ou um texto sobre o negócio" };

  try {
    const profile = await extractBrandProfile({ image, text });
    await saveBrandProfile(userId, brandId, profile, image ? "image" : "text");
    await refreshBrandScenes(brandId, profile);
    await track("brain_created", { userId, metadata: { via: image ? "print" : "texto" } });
    revalidatePath(`/brands/${brandId}`);
    return { profile };
  } catch (err: any) {
    return { error: `Falha ao ler o material: ${String(err.message).slice(0, 160)}` };
  }
}

/** Salva edições manuais dos campos do Cérebro (sem passar pela IA). */
export async function updateBrandProfileAction(
  brandId: string,
  fields: { business: string; audience: string; value_proposition: string; tone: string; content_pillars: string[]; notes: string }
): Promise<{ error?: string; profile?: BrandProfile }> {
  const userId = await requireUserId();
  if (!(await ownBrand(userId, brandId))) return { error: "Marca não encontrada" };
  const existing = await getBrandProfile(brandId);
  if (!existing) return { error: "Analise o negócio antes de editar" };

  const pillars = fields.content_pillars.map((p) => p.trim()).filter(Boolean).slice(0, 8);
  const merged: BrandProfile = {
    ...existing,
    business: fields.business.trim(),
    audience: fields.audience.trim(),
    value_proposition: fields.value_proposition.trim(),
    tone: fields.tone.trim(),
    content_pillars: pillars,
    notes: fields.notes.trim(),
    confidence: "alta", // editado por humano
  };
  await saveBrandProfile(userId, brandId, merged, "manual");
  await refreshBrandScenes(brandId, merged);
  revalidatePath(`/brands/${brandId}`);
  return { profile: merged };
}

export async function getBrandProfile(brandId: string): Promise<BrandProfile | null> {
  const { rows } = await getPool().query("select * from brand_profiles where brand_id = $1", [brandId]);
  const b = rows[0];
  if (!b) return null;
  return {
    business: b.business, audience: b.audience, value_proposition: b.value_proposition,
    tone: b.tone, niche: b.niche, content_pillars: b.content_pillars,
    products: b.products, confidence: b.confidence, notes: b.notes,
  };
}

// ── Recursos da marca (logo, produtos) — refs de imagem para a cena ──────
export type BrandAsset = { id: string; kind: string; label: string; url: string; storageKey: string };

export async function listBrandAssets(brandId: string): Promise<BrandAsset[]> {
  const { rows } = await getPool().query(
    "select id, kind, label, storage_key from brand_assets where brand_id = $1 order by created_at",
    [brandId]
  );
  return rows.map((r: any) => ({
    id: r.id, kind: r.kind, label: r.label, storageKey: r.storage_key,
    url: `/api/files/${r.storage_key}`,
  }));
}

export async function uploadBrandAssetAction(
  brandId: string,
  input: { imageDataUrl: string; kind: string; label: string }
): Promise<{ error?: string; asset?: BrandAsset }> {
  const userId = await requireUserId();
  if (!(await ownBrand(userId, brandId))) return { error: "Marca não encontrada" };

  const m = input.imageDataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
  if (!m) return { error: "Imagem inválida" };
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 6_000_000) return { error: "Imagem muito grande (máx 6MB)" };

  const key = `brands/${brandId}/assets/${randomUUID()}.${ext}`;
  await getStorage().put(key, buf);
  const kind = ["logo", "product", "cenario", "other"].includes(input.kind) ? input.kind : "product";
  const { rows } = await getPool().query(
    `insert into brand_assets (brand_id, user_id, kind, label, storage_key)
     values ($1,$2,$3,$4,$5) returning id`,
    [brandId, userId, kind, input.label.slice(0, 60), key]
  );
  revalidatePath(`/brands/${brandId}`);
  return {
    asset: { id: rows[0].id, kind, label: input.label.slice(0, 60), storageKey: key, url: `/api/files/${key}` },
  };
}

function rmStorageDir(prefix: string) {
  try {
    fs.rmSync(path.dirname(getStorage().getPath(`${prefix}/x`)), { recursive: true, force: true });
  } catch {
    /* arquivos podem não existir */
  }
}

/** Renomeia a marca. */
export async function renameBrandAction(brandId: string, name: string): Promise<{ error?: string } | void> {
  const userId = await requireUserId();
  const n = name.trim();
  if (n.length < 2) return { error: "Nome muito curto" };
  await getPool().query("update brands set name = $1 where id = $2 and user_id = $3", [n.slice(0, 80), brandId, userId]);
  revalidatePath(`/brands/${brandId}`);
}

/** Exclui a marca e TUDO dela (personas, vídeos, recursos, agenda) — cascade no banco. */
export async function deleteBrandAction(brandId: string): Promise<void> {
  const userId = await requireUserId();
  const pool = getPool();
  if (!(await ownBrand(userId, brandId))) return;
  const { rows: vids } = await pool.query("select id from videos where brand_id = $1", [brandId]);
  const { rows: pers } = await pool.query("select id from personas where brand_id = $1", [brandId]);
  vids.forEach((v: any) => rmStorageDir(`videos/${v.id}`));
  pers.forEach((p: any) => rmStorageDir(`personas/${p.id}`));
  await pool.query("delete from brands where id = $1 and user_id = $2", [brandId, userId]);
  redirect("/brands");
}

/** Exclui uma persona e seus vídeos (videos.persona_id é NO ACTION — removidos antes). */
export async function deletePersonaAction(personaId: string): Promise<void> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query(
    "select p.brand_id from personas p join brands b on b.id = p.brand_id where p.id = $1 and b.user_id = $2",
    [personaId, userId]
  );
  if (!rows[0]) return;
  const { rows: vids } = await pool.query("select id from videos where persona_id = $1", [personaId]);
  vids.forEach((v: any) => rmStorageDir(`videos/${v.id}`));
  await pool.query("delete from videos where persona_id = $1", [personaId]);
  rmStorageDir(`personas/${personaId}`);
  await pool.query("delete from personas where id = $1", [personaId]);
  revalidatePath(`/brands/${rows[0].brand_id}`);
}

export async function deleteBrandAssetAction(assetId: string): Promise<void> {
  const userId = await requireUserId();
  const { rows } = await getPool().query(
    "delete from brand_assets where id = $1 and user_id = $2 returning brand_id, storage_key",
    [assetId, userId]
  );
  if (rows[0]) {
    try {
      await getStorage().delete(rows[0].storage_key);
    } catch {
      /* arquivo já pode não existir */
    }
    revalidatePath(`/brands/${rows[0].brand_id}`);
  }
}

export type IdeasResult = { ideas?: VideoIdea[]; usedFallback?: boolean; error?: string };

/** Motor de ideias: Cérebro + Memória da marca + OBJETIVO escolhido; fallback pelo nicho. */
export async function generateIdeasAction(brandId: string, objective?: string): Promise<IdeasResult> {
  const userId = await requireUserId();
  if (!(await ownBrand(userId, brandId))) return { error: "Marca não encontrada" };
  if (!rateLimit(userId, 30, 60 * 60 * 1000))
    return { error: "Muitas ideias em pouco tempo — espere alguns minutos." };

  const brandProfile = await getBrandProfile(brandId);
  let profile = brandProfile;
  if (!profile) {
    // fallback: usa o nicho de alguma persona da marca
    const { rows } = await getPool().query(
      "select description, niche from personas where brand_id = $1 order by created_at limit 1",
      [brandId]
    );
    profile = rows[0] ? brandProfileFromPersona(rows[0]) : brandProfileFromPersona({ description: "", niche: null });
  }
  const memory = memoryForPrompt(await getBrandMemory(brandId));
  try {
    const ideas = await generateIdeas(profile, 6, memory, objectiveIdeaHint(objective));
    return { ideas, usedFallback: !brandProfile };
  } catch (err: any) {
    return { error: `Falha ao gerar ideias: ${String(err.message).slice(0, 160)}` };
  }
}
