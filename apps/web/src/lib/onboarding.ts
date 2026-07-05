// Estado do onboarding derivado dos DADOS reais (não de uma flag que dessincroniza).
// Guia o usuário até o primeiro vídeo: marca -> cérebro -> persona -> vídeo.
import { getPool } from "@influa/core/db/client";

export type OnboardingStep = {
  key: "brand" | "brain" | "persona" | "video";
  title: string;
  desc: string;
  href: string;
  done: boolean;
};

export type OnboardingState = { complete: boolean; steps: OnboardingStep[]; nextIndex: number };

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const { rows } = await getPool().query(
    `select
       (select count(*) from brands where user_id = $1)::int as brands,
       (select count(*) from brand_profiles bp join brands b on b.id = bp.brand_id where b.user_id = $1)::int as brains,
       (select count(*) from personas where user_id = $1 and status = 'ready')::int as ready_personas,
       (select count(*) from videos where user_id = $1)::int as videos,
       (select id from brands where user_id = $1 order by created_at limit 1) as first_brand`,
    [userId]
  );
  const r = rows[0];
  const brandId = r.first_brand as string | null;

  const steps: OnboardingStep[] = [
    {
      key: "brand", title: "Crie sua primeira marca",
      desc: "A marca é o seu negócio — reúne o cérebro, as personas e os vídeos.",
      href: "/brands", done: r.brands > 0,
    },
    {
      key: "persona", title: "Crie a primeira persona",
      desc: "Gere o rosto que vai aparecer nos vídeos (escolher é grátis).",
      href: brandId ? `/personas/new?brand=${brandId}` : "/brands", done: r.ready_personas > 0,
    },
    {
      key: "video", title: "Gere o primeiro vídeo",
      desc: "Escolha um tema (ou peça ideias) e o estilo — o roteiro vem editável.",
      href: brandId ? `/videos/new?brand=${brandId}` : "/brands", done: r.videos > 0,
    },
  ];

  const nextIndex = steps.findIndex((s) => !s.done);
  return { complete: nextIndex === -1, steps, nextIndex: nextIndex === -1 ? steps.length : nextIndex };
}
