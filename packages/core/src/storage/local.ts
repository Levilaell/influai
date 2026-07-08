import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env, REPO_ROOT } from "../env.ts";
import type { StorageDriver } from "./index.ts";

function storageRoot(): string {
  const dir = env("STORAGE_DIR", "./data/storage");
  return path.isAbsolute(dir) ? dir : path.join(REPO_ROOT, dir);
}

/** Assina `key` com expiração: sig = HMAC-SHA256(FILE_URL_SECRET, `${key}:${exp}`). */
export function signFileUrl(key: string, ttlSeconds = 3600): { exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = crypto
    .createHmac("sha256", env("FILE_URL_SECRET"))
    .update(`${key}:${exp}`)
    .digest("hex");
  return { exp, sig };
}

export function verifyFileSignature(key: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = crypto
    .createHmac("sha256", env("FILE_URL_SECRET"))
    .update(`${key}:${exp}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export class LocalStorageDriver implements StorageDriver {
  async put(key: string, data: Buffer | string, _contentType?: string): Promise<string> {
    if (key.includes("..")) throw new Error("key inválida");
    const dest = this.getPath(key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (typeof data === "string") fs.copyFileSync(data, dest);
    else fs.writeFileSync(dest, data);
    return key;
  }

  getPath(key: string): string {
    const resolved = path.resolve(storageRoot(), key);
    if (!resolved.startsWith(storageRoot())) throw new Error("key fora do storage");
    return resolved;
  }

  publicUrl(key: string, ttlSeconds = 3600): string {
    const base = env("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
    const { exp, sig } = signFileUrl(key, ttlSeconds);
    return `${base}/api/files/${key}?exp=${exp}&sig=${sig}`;
  }

  exists(key: string): boolean {
    return fs.existsSync(this.getPath(key));
  }

  async delete(key: string): Promise<void> {
    const p = this.getPath(key);
    if (fs.existsSync(p)) fs.rmSync(p);
  }

  async pull(key: string): Promise<string> {
    return this.getPath(key); // já está em disco
  }

  async deletePrefix(prefix: string): Promise<void> {
    try {
      fs.rmSync(this.getPath(prefix), { recursive: true, force: true });
    } catch {
      /* pode não existir */
    }
  }
}
