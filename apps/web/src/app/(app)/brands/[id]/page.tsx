import { notFound } from "next/navigation";
import { getPool } from "@influa/core/db/client";
import { getBrandMemory } from "@influa/core/brand/memory";
import { requireUserId } from "@/lib/auth";
import { getBrandProfile, listBrandAssets } from "@/actions/brand";
import { listScheduledPosts } from "@/actions/schedule";
import { BrandDashboard } from "./dashboard";

const IG_NOTICE: Record<string, string> = {
  connected: "Instagram conectado com sucesso.",
  error: "Não deu para conectar o Instagram. Tente de novo.",
  noaccount: "Nenhuma conta profissional do Instagram vinculada a uma Página foi encontrada.",
  unavailable: "A conexão com o Instagram entra no ar após a aprovação da Meta.",
};

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ig?: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const { ig } = await searchParams;
  const { rows } = await getPool().query(
    "select id, name, instagram from brands where id = $1 and user_id = $2",
    [id, userId]
  );
  if (!rows[0]) notFound();
  const igConn = rows[0].instagram;

  const [profile, memory, assets, scheduled, batchRow, personas, videos] = await Promise.all([
    getBrandProfile(id),
    getBrandMemory(id),
    listBrandAssets(id),
    listScheduledPosts(id),
    getPool().query(
      "select requested, created from content_batches where brand_id = $1 and status = 'running' order by created_at desc limit 1",
      [id]
    ),
    getPool().query(
      `select p.id, p.name, p.status, p.niche,
         (select storage_key from persona_assets a where a.persona_id = p.id and a.kind='front' limit 1) as cover
       from personas p where p.brand_id = $1 order by p.created_at desc`,
      [id]
    ),
    getPool().query(
      `select v.id, v.status, v.topic, v.script->>'title' as title, v.final_storage_key, p.name as persona_name
       from videos v join personas p on p.id = v.persona_id
       where v.brand_id = $1 order by v.created_at desc`,
      [id]
    ),
  ]);

  return (
    <BrandDashboard
      brand={{ id: rows[0].id, name: rows[0].name }}
      instagram={{
        connected: Boolean(igConn?.ig_user_id),
        username: igConn?.username ?? null,
        notice: ig ? IG_NOTICE[ig] ?? null : null,
      }}
      profile={profile}
      assets={assets}
      scheduled={scheduled}
      batch={batchRow.rows[0] ? { requested: batchRow.rows[0].requested, created: batchRow.rows[0].created } : null}
      memory={{ coveredTopics: memory.covered_topics, learnings: memory.learnings }}
      personas={personas.rows.map((p: any) => ({
        id: p.id, name: p.name, status: p.status, niche: p.niche,
        coverUrl: p.cover ? `/api/files/${p.cover}` : null,
      }))}
      videos={videos.rows.map((v: any) => ({
        id: v.id, status: v.status, title: v.title, topic: v.topic,
        personaName: v.persona_name,
        finalUrl: v.final_storage_key ? `/api/files/${v.final_storage_key}` : null,
      }))}
    />
  );
}
