// Driver de storage no Cloudflare R2 (S3-compatível). Assinatura SigV4 com node crypto
// (síncrono — mantém publicUrl/getPath síncronos como a interface exige). Sem dep externa.
// Modelo: worker grava local (temp, pra ffmpeg) E sobe pro R2; a web serve por URL assinada.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { env } from "../env.ts";
import type { StorageDriver } from "./index.ts";

const ACCESS = () => env("R2_ACCESS_KEY_ID");
const SECRET = () => env("R2_SECRET_ACCESS_KEY");
const ENDPOINT = () => env("R2_ENDPOINT").replace(/\/$/, ""); // https://<acct>.r2.cloudflarestorage.com
const BUCKET = () => env("R2_BUCKET");
const REGION = "auto";
const TMP = process.env.STORAGE_DIR && !process.env.STORAGE_DIR.startsWith("./")
  ? process.env.STORAGE_DIR
  : path.join(os.tmpdir(), "influa-storage");

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}
function sha256hex(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function signingKey(date: string): Buffer {
  return hmac(hmac(hmac(hmac("AWS4" + SECRET(), date), REGION), "s3"), "aws4_request");
}
function amz() {
  const s = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: s, date: s.slice(0, 8) };
}
// codifica cada segmento mas preserva "/"
function uri(key: string): string {
  return "/" + BUCKET() + "/" + key.split("/").map(encodeURIComponent).join("/");
}
const MIME: Record<string, string> = {
  mp4: "video/mp4", mp3: "audio/mpeg", jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp", srt: "text/plain; charset=utf-8", json: "application/json",
};
function mimeOf(key: string): string | undefined {
  return MIME[key.slice(key.lastIndexOf(".") + 1).toLowerCase()];
}

/** URL GET pré-assinada (query) — síncrona. Máx do S3/R2 = 7 dias.
 *  downloadAs: força download no browser (response-content-disposition assinado) —
 *  o atributo HTML `download` é ignorado em redirect cross-origin, então tem que ser aqui. */
function presignedGet(key: string, expires: number, downloadAs?: string): string {
  expires = Math.min(Math.max(1, Math.floor(expires)), 604800);
  const { amz: a, date } = amz();
  const cred = `${ACCESS()}/${date}/${REGION}/s3/aws4_request`;
  const cu = uri(key);
  const params: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", cred],
    ["X-Amz-Date", a],
    ["X-Amz-Expires", String(expires)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  if (downloadAs) {
    const safe = downloadAs.replace(/["\\\r\n]/g, "").slice(0, 120) || "video.mp4";
    params.push(["response-content-disposition", `attachment; filename="${safe}"`]);
  }
  const host = new URL(ENDPOINT()).host;
  const cq = params.sort().map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonical = ["GET", cu, cq, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", a, `${date}/${REGION}/s3/aws4_request`, sha256hex(canonical)].join("\n");
  const sig = crypto.createHmac("sha256", signingKey(date)).update(sts).digest("hex");
  return `${ENDPOINT()}${cu}?${cq}&X-Amz-Signature=${sig}`;
}

/** Requisição assinada (Authorization header) — put/delete/get. Assina content-type. */
async function signed(method: string, key: string, body?: Buffer, contentType?: string): Promise<Response> {
  const { amz: a, date } = amz();
  const cu = uri(key);
  const host = new URL(ENDPOINT()).host;
  const ph = body ? sha256hex(body) : sha256hex("");
  const hdrs: [string, string][] = [["host", host], ["x-amz-content-sha256", ph], ["x-amz-date", a]];
  if (contentType) hdrs.push(["content-type", contentType]);
  hdrs.sort(); // canonical headers em ordem alfabética
  const ch = hdrs.map(([k, v]) => `${k}:${v}`).join("\n") + "\n";
  const sh = hdrs.map(([k]) => k).join(";");
  const canonical = [method, cu, "", ch, sh, ph].join("\n");
  const sts = ["AWS4-HMAC-SHA256", a, `${date}/${REGION}/s3/aws4_request`, sha256hex(canonical)].join("\n");
  const sig = crypto.createHmac("sha256", signingKey(date)).update(sts).digest("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${ACCESS()}/${date}/${REGION}/s3/aws4_request, SignedHeaders=${sh}, Signature=${sig}`;
  const headers: Record<string, string> = { Authorization: auth, "x-amz-date": a, "x-amz-content-sha256": ph };
  if (contentType) headers["content-type"] = contentType;
  return fetch(`${ENDPOINT()}${cu}`, { method, headers, body: body as any });
}

export class R2StorageDriver implements StorageDriver {
  getPath(key: string): string {
    return path.join(TMP, key);
  }
  async put(key: string, data: Buffer | string, contentType?: string): Promise<string> {
    const buf = typeof data === "string" ? fs.readFileSync(data) : data;
    const local = this.getPath(key);
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, buf);
    const res = await signed("PUT", key, buf, contentType ?? mimeOf(key));
    if (!res.ok) throw new Error(`R2 put ${key}: ${res.status} ${(await res.text().catch(() => "")).slice(0, 160)}`);
    return key;
  }
  /** Baixa do R2 pro disco local (pra ffmpeg em outra máquina/retry). */
  async pull(key: string): Promise<string> {
    const local = this.getPath(key);
    if (fs.existsSync(local)) return local;
    const res = await signed("GET", key);
    if (!res.ok) throw new Error(`R2 get ${key}: ${res.status}`);
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, Buffer.from(await res.arrayBuffer()));
    return local;
  }
  publicUrl(key: string, ttlSeconds = 3600, opts?: { downloadAs?: string }): string {
    return presignedGet(key, ttlSeconds, opts?.downloadAs);
  }
  exists(key: string): boolean {
    return fs.existsSync(this.getPath(key));
  }
  async delete(key: string): Promise<void> {
    try { fs.rmSync(this.getPath(key), { force: true }); } catch { /* */ }
    await signed("DELETE", key).catch(() => {});
  }
  /** Apaga todos os objetos sob um prefixo (retenção). Lista via ListObjectsV2. */
  async deletePrefix(prefix: string): Promise<void> {
    try { fs.rmSync(this.getPath(prefix), { recursive: true, force: true }); } catch { /* */ }
    const host = new URL(ENDPOINT()).host;
    const { amz: a, date } = amz();
    const q = `list-type=2&prefix=${encodeURIComponent(prefix)}`;
    const cu = "/" + BUCKET();
    const ph = sha256hex("");
    const ch = `host:${host}\nx-amz-content-sha256:${ph}\nx-amz-date:${a}\n`;
    const canonical = ["GET", cu, q, ch, "host;x-amz-content-sha256;x-amz-date", ph].join("\n");
    const sts = ["AWS4-HMAC-SHA256", a, `${date}/${REGION}/s3/aws4_request`, sha256hex(canonical)].join("\n");
    const sig = crypto.createHmac("sha256", signingKey(date)).update(sts).digest("hex");
    const auth = `AWS4-HMAC-SHA256 Credential=${ACCESS()}/${date}/${REGION}/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`;
    const res = await fetch(`${ENDPOINT()}${cu}?${q}`, { headers: { Authorization: auth, "x-amz-date": a, "x-amz-content-sha256": ph } });
    const xml = await res.text();
    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
    await Promise.all(keys.map((k) => signed("DELETE", k).catch(() => {})));
  }
}
