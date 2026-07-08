// Prévia instantânea da landing (SEM login): nicho -> persona + ideias + roteiro.
// Rate-limit por IP (é LLM, barato, mas evita abuso). É a isca de conversão da waitlist.
import { generatePreview } from "@influa/core/growth/preview";
import { track } from "@influa/core/analytics";

// A prévia faz uma chamada Claude (~10-20s) — evita o timeout curto do Vercel.
export const maxDuration = 60;

const hits = new Map<string, number[]>();
function rateLimited(ip: string, max = 10, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return true;
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return Response.json({ error: "Muitas prévias — espere alguns minutos." }, { status: 429 });

  let niche = "";
  try {
    niche = String((await req.json())?.niche ?? "").trim();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (niche.length < 2) return Response.json({ error: "Conte qual é o seu negócio." }, { status: 400 });
  if (niche.length > 120) niche = niche.slice(0, 120);

  try {
    const preview = await generatePreview(niche);
    await track("preview_generated", { metadata: { niche } });
    return Response.json({ preview });
  } catch (err: any) {
    return Response.json({ error: `Não consegui gerar agora — tenta de novo. ${String(err?.message ?? "").slice(0, 100)}` }, { status: 500 });
  }
}
