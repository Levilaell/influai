// URLs públicas para os providers (WaveSpeed) buscarem — agora 100% via R2 (presigned),
// sem Atlas. A URL assinada do R2 é acessível publicamente até expirar.
import { getPool } from "@influa/core/db/client";
import { getStorage } from "@influa/core/storage/index";

const HOST_TTL = 2 * 60 * 60; // 2h — cobre a geração (take pode levar minutos) com folga

// URL pública (R2 presigned) de um asset já gravado no storage.
export async function publicAssetUrl(asset: {
  storage_key: string;
  provider_url?: string | null;
  created_at?: Date | string;
}): Promise<string> {
  return getStorage().publicUrl(asset.storage_key, HOST_TTL);
}

// Hospeda um buffer efêmero (áudio/imagem/vídeo) no R2 e devolve URL pública temporária.
export async function hostBuffer(key: string, buf: Buffer, contentType: string): Promise<string> {
  const storage = getStorage();
  await storage.put(key, buf, contentType);
  return storage.publicUrl(key, HOST_TTL);
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
