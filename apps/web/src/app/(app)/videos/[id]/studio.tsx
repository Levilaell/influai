"use client";
// Fábrica de vídeo: draft (roteiro editável + custo AO VIVO) -> progresso -> player.
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { updateScriptAction, enqueueVideoAction, retryVideoAction, reportVideoAction, deleteVideoAction } from "@/actions/videos";
import { Badge, Button, Card, ErrorText, Input, Textarea } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { Scheduler } from "./scheduler";
import { MetricsPanel } from "./metrics-panel";
import { ChangeVoice } from "./change-voice";
import type { LatestMetrics } from "@/actions/metrics";
import { PaywallModal } from "@/components/paywall-modal";
import type { PlanId } from "@influa/core/billing/plans";

type PlanView = { id: PlanId; name: string; priceBRL: number; approxVideos: number; monthlyCredits: number; features: string[] };

type Shot = { visual_prompt: string; dialogue: string; camera: string };
type Script = { title: string; hook: string; narration: string; shots: Shot[]; hashtags: string[] };
type Pricing = {
  imagePerUnit: number;
  avatarPerSecond: number;
  scriptFlat: number;
  ttsFlat: number;
  brollFlat: number;
  charsPerSecond: number;
  markup: number;
};
type VideoState = {
  id: string;
  status: string;
  error: string | null;
  topic: string;
  script: Script;
  progress: { step?: string; pct?: number; message?: string };
  personaName: string;
  estimatedCredits: number | null;
  actualCostUsd: number | null;
  finalUrl: string | null;
  broll: boolean;
  segments: number;
};

const PROCESSING = ["queued", "scripting", "keyframing", "voicing", "rendering", "assembling"];

export function VideoStudio({
  video: initial,
  pricing,
  latestMetrics,
  currentVoiceId,
  plans,
  currentPlan,
}: {
  video: VideoState;
  pricing: Pricing;
  latestMetrics: LatestMetrics;
  currentVoiceId: string;
  plans: PlanView[];
  currentPlan: string;
}) {
  const [video, setVideo] = useState(initial);
  const [script, setScript] = useState<Script>(initial.script);
  const [error, setError] = useState<string | undefined>();
  const [showPaywall, setShowPaywall] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/videos/${initial.id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setVideo((prev) => ({ ...prev, ...data, finalUrl: data.finalUrl }));
  }, [initial.id]);

  useEffect(() => {
    if (!PROCESSING.includes(video.status)) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [video.status, refresh]);

  // Custo AO VIVO sobre o texto editado (transparência total — diferencial do produto)
  const estimate = useMemo(() => {
    const chars = script.shots.reduce((s, x) => s + x.dialogue.length, 0);
    const seconds = Math.ceil(chars / pricing.charsPerSecond);
    const usd =
      pricing.imagePerUnit * Math.max(1, video.segments) + seconds * pricing.avatarPerSecond +
      pricing.scriptFlat + pricing.ttsFlat + (video.broll ? pricing.brollFlat : 0);
    return { seconds, credits: Math.ceil(usd * 100 * pricing.markup) };
  }, [script, pricing]);

  const setDialogue = (i: number, dialogue: string) =>
    setScript((s) => ({ ...s, shots: s.shots.map((sh, j) => (j === i ? { ...sh, dialogue } : sh)) }));

  const generate = () =>
    startTransition(async () => {
      setError(undefined);
      const save = await updateScriptAction(video.id, script);
      if (save?.error) return setError(save.error);
      const r = await enqueueVideoAction(video.id);
      if (r?.error) {
        // Saldo insuficiente = momento do paywall → abre o modal de assinatura.
        if (/insuficient|assine|cr[ée]dito/i.test(r.error)) return setShowPaywall(true);
        return setError(r.error);
      }
      setVideo((v) => ({ ...v, status: "queued" }));
    });

  const retry = () =>
    startTransition(async () => {
      const r = await retryVideoAction(video.id);
      if (r?.error) setError(r.error);
    });

  const isDraft = ["draft", "estimated"].includes(video.status);

  return (
    <div className="space-y-8">
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} plans={plans} currentPlan={currentPlan} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{script.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {video.personaName} · {video.topic}
          </p>
        </div>
        <Badge tone={video.status === "ready" ? "ok" : video.status === "failed" ? "danger" : "accent"}>
          {video.status}
        </Badge>
      </div>

      {isDraft && (
        <>
          <Card className="space-y-5">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted">Hook (primeiros 2 segundos)</p>
              <Input
                value={script.hook}
                onChange={(e) => setScript((s) => ({ ...s, hook: e.target.value }))}
              />
            </div>
            {script.shots.map((shot, i) => (
              <div key={i}>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted">
                  Fala {i + 1} <span className="normal-case">({shot.camera})</span>
                </p>
                <Textarea rows={2} value={shot.dialogue} onChange={(e) => setDialogue(i, e.target.value)} />
              </div>
            ))}
            <p className="text-xs text-muted">
              {[...new Set(script.hashtags.map((h) => h.replace(/^#+/, "").toLowerCase()))]
                .map((h) => `#${h}`)
                .join(" ")}
            </p>
          </Card>

          <Card className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Custo deste vídeo (recalculado enquanto você edita)</p>
              <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-accent">
                {estimate.credits} créditos
              </p>
              <p className="text-xs text-muted">
                ~{estimate.seconds}s de fala · devolvemos a sobra e 100% em caso de falha
              </p>
            </div>
            <Button onClick={generate} disabled={pending}>
              {pending ? "Enviando..." : "Gerar vídeo"}
            </Button>
          </Card>
          <p className="text-center text-xs text-muted">
            Modelos de IA são incríveis, mas ainda podem ter pequenas imperfeições ocasionais (um detalhe
            numa mão, por exemplo) — raro, mas possível. Se sair algo assim, você pode reportar no vídeo pronto.
          </p>
          <ErrorText>{error}</ErrorText>
        </>
      )}

      {PROCESSING.includes(video.status) && (
        <Card className="space-y-4 py-10 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
          <p className="font-medium">{video.progress?.message ?? "Na fila..."}</p>
          <div className="mx-auto h-2 w-full max-w-md overflow-hidden rounded-full bg-bg">
            <div
              className="h-full bg-accent transition-all duration-700"
              style={{ width: `${video.progress?.pct ?? 5}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            Reserva: {video.estimatedCredits ?? "—"} créditos · pode fechar esta página, o vídeo continua
          </p>
        </Card>
      )}

      {video.status === "ready" && video.finalUrl && (
        <div className="space-y-5">
          <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-line">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={video.finalUrl} controls playsInline className="aspect-[9/16] w-full bg-black" />
          </div>
          <div className="flex justify-center gap-3">
            <a
              href={`${video.finalUrl}?download=1`}
              download={`${script.title}.mp4`}
              className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-accent-ink transition hover:brightness-105"
            >
              Baixar MP4
            </a>
            <Link
              href="/brands"
              className="rounded-full border border-line px-8 py-3 text-sm transition hover:border-accent"
            >
              Criar outro
            </Link>
          </div>
          {video.actualCostUsd != null && (
            <p className="text-center text-xs text-muted">
              Custo real: ${video.actualCostUsd.toFixed(2)} — a sobra da reserva já voltou pro seu saldo.
            </p>
          )}
          <Scheduler
            videoId={video.id}
            defaultCaption={`${script.hook}\n\n${[...new Set(script.hashtags.map((h) => h.replace(/^#+/, "").toLowerCase()))]
              .map((h) => `#${h}`)
              .join(" ")}`}
          />
          <MetricsPanel videoId={video.id} latest={latestMetrics} />
          <ChangeVoice videoId={video.id} currentVoiceId={currentVoiceId} />
          <ReportProblem videoId={video.id} />
        </div>
      )}

      {video.status === "failed" && (
        <Card className="space-y-4 text-center">
          <p className="text-danger">{video.error ?? "Falha na geração."}</p>
          <ErrorText>{error}</ErrorText>
          <Button onClick={retry} disabled={pending}>
            Tentar novamente (novo rascunho)
          </Button>
        </Card>
      )}

      {video.status !== "queued" && !["voicing", "keyframing", "rendering", "assembling"].includes(video.status) && (
        <div className="pt-2 text-center">
          <ConfirmButton
            onConfirm={() => deleteVideoAction(video.id)}
            confirm="Excluir este vídeo? Os arquivos serão apagados (o extrato de créditos permanece)."
            className="text-xs text-muted transition hover:text-danger"
            pendingLabel="excluindo..."
          >
            Excluir vídeo
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}

// Reportar um defeito no vídeo pronto (você revisa e reembolsa manualmente se for caso).
function ReportProblem({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      await reportVideoAction(videoId, reason);
      setSent(true);
      setOpen(false);
    });

  if (sent) return <p className="text-center text-xs text-muted">Problema reportado. Vamos analisar — obrigado!</p>;
  if (!open)
    return (
      <p className="text-center text-xs text-muted">
        Algum defeito no vídeo?{" "}
        <button onClick={() => setOpen(true)} className="underline hover:text-ink">
          reportar problema
        </button>
      </p>
    );
  return (
    <Card className="space-y-3">
      <p className="text-sm font-medium">Reportar problema</p>
      <Textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Descreva o que ficou errado (ex: a mão saiu com um dedo a mais no segundo 4)."
      />
      <div className="flex gap-2">
        <Button onClick={send} disabled={pending || reason.trim().length < 5}>
          {pending ? "Enviando..." : "Enviar report"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </Card>
  );
}
