import Link from "next/link";
import { notFound } from "next/navigation";
import { getPool } from "@influa/core/db/client";
import { requireUserId } from "@/lib/auth";
import { getBrandProfile, listBrandAssets, listBrandScenes } from "@/actions/brand";
import { FALLBACK_SCENES } from "@influa/core/pipeline/style";
import { Card } from "@/components/ui";
import { NewVideoForm } from "./form";

export default async function NewVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; persona?: string; topic?: string }>;
}) {
  const userId = await requireUserId();
  const { brand: brandParam, persona: personaParam, topic: topicParam } = await searchParams;

  // Resolve a marca: por ?brand, ou pela persona pré-selecionada
  let brandId = brandParam ?? null;
  if (!brandId && personaParam) {
    const { rows } = await getPool().query(
      "select brand_id from personas where id = $1 and user_id = $2",
      [personaParam, userId]
    );
    brandId = rows[0]?.brand_id ?? null;
  }
  if (!brandId) notFound();

  // Cérebro OPCIONAL (funil novo): ideias/roteiro têm fallback pelo nicho; o form
  // já mostra a dica de conectar o Cérebro pra temas mais afiados.
  const { rows: brand } = await getPool().query(
    "select id, name from brands where id = $1 and user_id = $2",
    [brandId, userId]
  );
  if (!brand[0]) notFound();

  const [{ rows: personas }, assets, brandScenes, profile] = await Promise.all([
    getPool().query(
      `select p.id, p.name, p.niche, p.voice_id,
         (select storage_key from persona_assets a where a.persona_id = p.id and a.kind='front' limit 1) as cover
       from personas p where p.brand_id = $1 and p.status = 'ready' order by p.created_at desc`,
      [brandId]
    ),
    listBrandAssets(brandId),
    listBrandScenes(brandId),
    getBrandProfile(brandId),
  ]);
  // cenários: fotos do espaço real (kind=cenario) + gerados do Cérebro (texto) + reserva
  const photoScenes = assets
    .filter((a) => a.kind === "cenario")
    .map((a) => ({ label: `Meu espaço: ${a.label || "foto"}`, prompt: "", refKey: a.storageKey, thumbUrl: `/api/files/${a.storageKey}` }));
  const textScenes = (brandScenes.length ? brandScenes : FALLBACK_SCENES.filter((s) => s.label !== "Automático")).map(
    (s) => ({ label: s.label, prompt: s.prompt, refKey: "", thumbUrl: null })
  );
  const scenes = [{ label: "Automático", prompt: "", refKey: "", thumbUrl: null }, ...photoScenes, ...textScenes];
  // Placeholder do tema ancorado no negócio (não um exemplo genérico de outro nicho)
  const nicheLabel = (profile?.niche || personas[0]?.niche || "seu negócio").toLowerCase();
  const topicPlaceholder = `Ex.: 3 coisas que ninguém te conta sobre ${nicheLabel}`;
  // "mostrar na cena" = produtos/logo (cenário não entra aqui)
  const productAssets = assets.filter((a) => a.kind !== "cenario");

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <Link href={`/brands/${brandId}`} className="text-xs text-muted hover:text-accent">
          ← {brand[0].name}
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Novo vídeo</h1>
        <p className="mt-1 text-muted">
          Escolha a persona e o tema. O roteiro chega editável antes de qualquer gasto.
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
        <NewVideoForm
          brandId={brandId}
          personas={personas.map((p: any) => ({
            id: p.id, name: p.name, niche: p.niche, voiceId: p.voice_id,
            coverUrl: p.cover ? `/api/files/${p.cover}` : null,
          }))}
          assets={productAssets}
          scenes={scenes}
          preselect={personaParam ?? null}
          initialTopic={(topicParam ?? "").slice(0, 300)}
          topicPlaceholder={topicPlaceholder}
        />
      )}
    </div>
  );
}
