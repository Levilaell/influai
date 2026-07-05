// Resolve URL que o Atlas consegue buscar, em ordem de custo:
//  1. provider_url fresca (<50min) — já é uma URL do Atlas, sem re-upload
//  2. upload pro storage do PRÓPRIO Atlas (uploadMedia) — robusto, sem túnel
import { getPool } from "@influa/core/db/client";
import { getStorage } from "@influa/core/storage/index";
import { atlasUploadMedia } from "@influa/core/providers/index";
import fs from "node:fs";

const FRESH_MS = 50 * 60 * 1000;

function contentTypeFor(key: string): string {
  if (key.endsWith(".mp3")) return "audio/mpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function publicAssetUrl(asset: {
  storage_key: string;
  provider_url: string | null;
  created_at: Date | string;
}): Promise<string> {
  const age = Date.now() - new Date(asset.created_at).getTime();
  if (asset.provider_url && age < FRESH_MS) return asset.provider_url;
  const buf = fs.readFileSync(getStorage().getPath(asset.storage_key));
  return atlasUploadMedia(buf, contentTypeFor(asset.storage_key));
}

export async function getPersonaAssets(personaId: string, kinds?: string[]) {
  const { rows } = await getPool().query(
    `select id, kind, idx, storage_key, provider_url, created_at
     from persona_assets where persona_id = $1 ${kinds ? "and kind = any($2)" : ""}
     order by kind, idx`,
    kinds ? [personaId, kinds] : [personaId]
  );
  return rows;
}
