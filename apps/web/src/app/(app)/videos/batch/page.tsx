import Link from "next/link";
import { notFound } from "next/navigation";
import { getPool } from "@influa/core/db/client";
import { requireUserId } from "@/lib/auth";
import { listBrandScenes } from "@/actions/brand";
import { FALLBACK_SCENES } from "@influa/core/pipeline/style";
import { Card } from "@/components/ui";
import { BatchForm } from "./form";

export default async function BatchPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const userId = await requireUserId();
  const { brand: brandId } = await searchParams;
  if (!brandId) notFound();

  const { rows: brand } = await getPool().query("select id, name from brands where id = $1 and user_id = $2", [brandId, userId]);
  if (!brand[0]) notFound();

  const [{ rows: personas }, brandScenes] = await Promise.all([
    getPool().query(
      `select p.id, p.name, p.niche,
         (select storage_key from persona_assets a where a.persona_id = p.id and a.kind='front' limit 1) as cover
       from personas p where p.brand_id = $1 and p.status = 'ready' order by p.created_at desc`,
      [brandId]
    ),
    listBrandScenes(brandId),
  ]);
  const scenes = [{ label: "Automático", prompt: "" }, ...(brandScenes.length ? brandScenes : FALLBACK_SCENES.filter((s) => s.label !== "Automático"))];

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <Link href={`/brands/${brandId}`} className="text-xs text-muted hover:text-accent">← {brand[0].name}</Link>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Gerar minha semana</h1>
        <p className="mt-1 text-muted">
          Vários vídeos variados de uma vez — a IA usa a memória da marca pra não repetir temas. Chegam como
          rascunhos pra você revisar antes de gastar créditos.
        </p>
      </div>

      {personas.length === 0 ? (
        <Card className="space-y-3 py-12 text-center">
          <p className="text-muted">Esta marca precisa de uma persona pronta primeiro.</p>
          <Link href={`/personas/new?brand=${brandId}`} className="inline-block rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-ink">
            Criar persona
          </Link>
        </Card>
      ) : (
        <BatchForm
          brandId={brandId}
          personas={personas.map((p: any) => ({ id: p.id, name: p.name, niche: p.niche, coverUrl: p.cover ? `/api/files/${p.cover}` : null }))}
          scenes={scenes}
        />
      )}
    </div>
  );
}
