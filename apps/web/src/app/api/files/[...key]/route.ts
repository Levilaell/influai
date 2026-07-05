// Serve arquivos do storage local.
// Acesso: assinatura HMAC válida (Atlas/downloads externos) OU sessão logada.
import fs from "node:fs";
import { NextRequest } from "next/server";
import { getStorage, verifyFileSignature } from "@influa/core/storage/index";
import { auth } from "@/lib/auth";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".srt": "text/plain; charset=utf-8",
  ".json": "application/json",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: parts } = await params;
  const key = parts.join("/");
  if (key.includes("..")) return new Response("forbidden", { status: 403 });

  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  const signedOk = sig && verifyFileSignature(key, exp, sig);

  if (!signedOk) {
    const session = await auth();
    if (!(session?.user as any)?.id) return new Response("forbidden", { status: 403 });
  }

  const storage = getStorage();

  // R2: a web não guarda o arquivo — redireciona pro objeto por URL assinada.
  // O R2 suporta Range nativamente, então o player pede direto de lá.
  if (process.env.R2_ACCESS_KEY_ID) {
    return Response.redirect(storage.publicUrl(key, 3600), 302);
  }

  if (!storage.exists(key)) return new Response("not found", { status: 404 });

  const filePath = storage.getPath(key);
  const stat = fs.statSync(filePath);
  const ext = key.slice(key.lastIndexOf("."));
  const contentType = MIME[ext] ?? "application/octet-stream";

  // Range (players de vídeo pedem)
  const range = req.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d+)-(\d*)/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(stream as any, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }

  const stream = fs.createReadStream(filePath);
  return new Response(stream as any, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
