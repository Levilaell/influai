import { notFound } from "next/navigation";
import { getPool } from "@influa/core/db/client";
import { PRICING, DEFAULTS, VOICES } from "@influa/core/config";
import { requireUserId } from "@/lib/auth";
import { getUserPlan } from "@influa/core/billing/service";
import { PLANS } from "@influa/core/billing/plans";
import { getLatestMetrics } from "@/actions/metrics";
import { UpgradeNudge } from "@/components/upgrade-nudge";
import { VideoStudio } from "./studio";

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const { rows } = await getPool().query(
    `select v.*, p.name as persona_name, p.voice_id as persona_voice from videos v
     join personas p on p.id = v.persona_id
     where v.id = $1 and v.user_id = $2`,
    [id, userId]
  );
  if (!rows[0]) notFound();
  const v = rows[0];
  const latestMetrics = v.status === "ready" ? await getLatestMetrics(v.id) : null;
  const rawVoice = v.voice_override || v.persona_voice;
  const currentVoiceId = VOICES[rawVoice as string] ?? rawVoice;
  const plan = await getUserPlan(userId);
  const planViews = (["starter", "pro", "studio"] as const).map((id) => {
    const p = PLANS[id];
    const feats: string[] = [
      `${p.limits.brands === -1 ? "Marcas ilimitadas" : `${p.limits.brands} marca(s)`}`,
      `${p.limits.personas === -1 ? "Personas ilimitadas" : `${p.limits.personas} persona(s)`}`,
    ];
    if (p.features.scheduling) feats.push("Agendamento de posts");
    if (p.features.priorityQueue) feats.push("Fila prioritária");
    if (p.limits.seats > 1) feats.push(`${p.limits.seats} assentos de equipe`);
    return { id: p.id, name: p.name, priceBRL: p.priceBRL, approxVideos: p.approxVideos, monthlyCredits: p.monthlyCredits, features: feats };
  });

  return (
    <>
      {v.status === "ready" && plan.id === "free" && (
        <UpgradeNudge
          title="Seu vídeo está pronto! 🎉"
          text="É assim todo dia, no piloto automático. Assine e crie sem limite."
        />
      )}
      <VideoStudio
      latestMetrics={latestMetrics}
      currentVoiceId={currentVoiceId}
      plans={planViews}
      currentPlan={plan.id}
      video={{
        id: v.id,
        status: v.status,
        error: v.error,
        topic: v.topic,
        script: v.script,
        progress: v.progress,
        personaName: v.persona_name,
        estimatedCredits: v.estimated_credits,
        actualCostUsd: v.actual_cost_usd ? Number(v.actual_cost_usd) : null,
        finalUrl: v.final_storage_key ? `/api/files/${v.final_storage_key}` : null,
        broll: v.style?.broll === true,
        segments: v.segments || 1,
      }}
      pricing={{
        imagePerUnit: PRICING.imagePerUnit,
        avatarPerSecond: PRICING.avatarPerSecond,
        scriptFlat: PRICING.scriptFlat,
        ttsFlat: PRICING.ttsFlat,
        brollFlat: PRICING.brollFlat,
        charsPerSecond: DEFAULTS.charsPerSecond,
        markup: parseFloat(process.env.CREDIT_MARKUP ?? "1.0"),
      }}
      />
    </>
  );
}
