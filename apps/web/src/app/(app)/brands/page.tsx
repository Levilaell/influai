import Link from "next/link";
import { getPool } from "@influa/core/db/client";
import { requireUserId } from "@/lib/auth";
import { getOnboardingState } from "@/lib/onboarding";
import { sendJob } from "@/lib/queue";
import { Card } from "@/components/ui";
import { NewBrandForm } from "./new-brand-form";
import { Onboarding } from "./onboarding";

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ niche?: string }> }) {
  const userId = await requireUserId();
  const niche = (await searchParams)?.niche?.trim().slice(0, 80) ?? "";
  const suggestedName = niche ? niche.charAt(0).toUpperCase() + niche.slice(1) : "";
  const onboarding = await getOnboardingState(userId);
  const { rows: brands } = await getPool().query(
    `select b.id, b.name,
       (select count(*)::int from personas p where p.brand_id = b.id) as personas,
       (select count(*)::int from videos v where v.brand_id = b.id) as videos,
       (select storage_key from persona_assets a
          join personas p on p.id = a.persona_id
          where p.brand_id = b.id and a.kind = 'front' limit 1) as cover,
       exists(select 1 from brand_profiles bp where bp.brand_id = b.id) as has_brain
     from brands b where b.user_id = $1 order by b.created_at desc`,
    [userId]
  );

  // Catch-all do 1º vídeo automático: usuário novo (0 marcas) que chegou com um nicho
  // (LP, ou Google via ?niche=) dispara a geração. Idempotente (singletonKey + o job
  // pula se já houver vídeo). Cobre TODOS os caminhos de cadastro, não só o email.
  if (brands.length === 0 && niche) {
    await sendJob("first-video", { userId, niche }, `first-video:${userId}`).catch(() => {});
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Marcas</h1>
        <p className="mt-1 text-muted">
          Cada marca é um negócio: tem seu cérebro, sua memória e suas personas (rostos).
        </p>
      </div>

      <Onboarding state={onboarding} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {brands.map((b: any) => (
          <Link key={b.id} href={`/brands/${b.id}`} className="group">
            <div className="flex gap-4 rounded-2xl border border-line bg-bg-soft p-4 transition group-hover:border-accent/50">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bg">
                {b.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${b.cover}`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl text-muted">M</div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{b.name}</div>
                <div className="mt-1 text-xs text-muted">
                  {b.personas} persona(s) · {b.videos} vídeo(s)
                </div>
                <div className="mt-1 text-xs">
                  {b.has_brain ? (
                    <span className="text-accent">cérebro ativo</span>
                  ) : (
                    <span className="text-muted">sem cérebro</span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}

        <Card className={`flex items-center ${brands.length === 0 && suggestedName ? "border-accent/40" : ""}`}>
          <NewBrandForm defaultName={suggestedName} />
        </Card>
      </div>
    </div>
  );
}
