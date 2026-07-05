// Abstração de storage: MVP em disco local; trocar por R2 = novo driver com a
// mesma interface (publicUrl assinada com expiração ≡ presigned URL).
export interface StorageDriver {
  /** Grava buffer ou copia arquivo local para a key. Retorna a key. */
  put(key: string, data: Buffer | string): Promise<string>;
  /** Caminho absoluto local (para ffmpeg/ffprobe). */
  getPath(key: string): string;
  /** URL pública temporária que o Atlas/browser consegue buscar. */
  publicUrl(key: string, ttlSeconds?: number): string;
  exists(key: string): boolean;
  delete(key: string): Promise<void>;
  /** Garante o arquivo em disco local (R2: baixa; local: no-op). Retorna o path. */
  pull?(key: string): Promise<string>;
  /** Apaga tudo sob um prefixo (retenção). */
  deletePrefix?(prefix: string): Promise<void>;
}

import { LocalStorageDriver } from "./local.ts";
import { R2StorageDriver } from "./r2.ts";

let driver: StorageDriver | null = null;
export function getStorage(): StorageDriver {
  if (!driver) driver = process.env.R2_ACCESS_KEY_ID ? new R2StorageDriver() : new LocalStorageDriver();
  return driver;
}

export { signFileUrl, verifyFileSignature } from "./local.ts";
