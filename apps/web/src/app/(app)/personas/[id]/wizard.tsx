"use client";
// Wizard da persona: draft -> candidates -> sheet -> ready, com polling.
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { generateCandidatesAction, chooseCandidateAction } from "@/actions/personas";
import { Badge, Button, Card, ErrorText } from "@/components/ui";
import { BrandBrain } from "../../brands/[id]/brand-brain";
import type { BrandProfile } from "@influa/core/brand/index";

type Asset = { id: string; kind: string; idx: number; url: string };
type PersonaState = {
  id: string;
  name: string;
  description?: string;
  niche?: string;
  voice_id: string;
  status: string;
  error: string | null;
  assets?: Asset[];
};

const GENERATING = ["candidates_generating", "sheet_generating"];

// Rótulos em PT dos ângulos do character sheet
const KIND_LABEL: Record<string, string> = {
  front: "Frente",
  three_quarter: "3/4",
  profile: "Perfil",
  speaking: "Falando",
};

const CANDIDATE_COUNT = 4;
const SHEET_KINDS = ["front", "three_quarter", "profile", "speaking"];

export function PersonaWizard({
  persona: initial,
  brandId,
  brandProfile,
  estimates,
}: {
  persona: PersonaState;
  brandId: string;
  brandProfile: BrandProfile | null;
  estimates: { creation: number; candidates: number };
}) {
  const [persona, setPersona] = useState<PersonaState>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/personas/${initial.id}`, { cache: "no-store" });
    if (res.ok) setPersona(await res.json());
  }, [initial.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!GENERATING.includes(persona.status)) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [persona.status, refresh]);

  const candidates = (persona.assets ?? []).filter((a) => a.kind === "candidate");
  const sheet = (persona.assets ?? []).filter((a) => SHEET_KINDS.includes(a.kind));

  // Erro de "não encontrada" = página velha/persona removida → recarrega pro estado atual
  // (evita ficar preso num wizard obsoleto com um erro sem saída).
  const handle = (r: { error?: string } | void) => {
    if (r?.error?.includes("não encontrada")) return window.location.reload();
    if (r?.error) setError(r.error);
    else refresh();
  };

  const runCandidates = () =>
    startTransition(async () => {
      setError(undefined);
      handle(await generateCandidatesAction(persona.id));
    });

  const runSheet = () =>
    startTransition(async () => {
      if (!selected) return;
      setError(undefined);
      handle(await chooseCandidateAction(persona.id, selected));
    });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">{persona.name}</h1>
          <p className="mt-1 text-muted">
            Voz: {persona.voice_id} · {initial.niche}
          </p>
        </div>
        <Badge tone={persona.status === "ready" ? "ok" : persona.status === "failed" ? "danger" : "accent"}>
          {persona.status}
        </Badge>
      </div>

      {persona.status !== "ready" && (
        <Card className="space-y-3 border-accent/30">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg">Enquanto isso, conte sobre seu negócio 👇</p>
            <p className="mt-1 text-sm text-muted">
              É assim que a IA entende sua marca e cria vídeos sob medida (não genéricos). Um print do Instagram ou site
              já basta — ou escreva em texto.
            </p>
          </div>
          <BrandBrain brandId={brandId} initial={brandProfile} />
        </Card>
      )}

      {persona.status === "draft" && (
        <Card className="space-y-4 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl">Passo 2 — escolher o rosto</p>
          <p className="text-muted">
            Vamos gerar <b className="text-ink">4 opções de rosto</b> a partir da sua descrição. Você
            escolhe uma; ela vira a identidade permanente da persona.
          </p>
          <p className="text-sm text-muted">
            Custo único: <b className="text-accent">{estimates.creation} créditos</b> — já inclui o
            character sheet. Escolher o rosto é grátis.
          </p>
          <ErrorText>{error}</ErrorText>
          <Button onClick={runCandidates} disabled={pending}>
            {pending ? "Enviando..." : `Gerar 4 rostos (${estimates.creation} créditos)`}
          </Button>
        </Card>
      )}

      {persona.status === "candidates_generating" && (
        <div className="space-y-4">
          <Card className="text-center">
            <p className="font-[family-name:var(--font-display)] text-lg">Gerando os rostos...</p>
            <p className="text-sm text-muted">Cada opção leva alguns segundos.</p>
          </Card>
          <TileGrid total={CANDIDATE_COUNT} assets={candidates} />
        </div>
      )}

      {persona.status === "candidates_ready" && (
        <div className="space-y-5">
          <Card className="space-y-1 text-center">
            <p className="font-[family-name:var(--font-display)] text-xl">Escolha o rosto oficial</p>
            <p className="text-sm text-muted">
              O escolhido vira a identidade travada — mesmo rosto em todos os vídeos. Escolher é grátis.
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`overflow-hidden rounded-2xl border-2 transition ${
                  selected === c.id ? "border-accent" : "border-line hover:border-accent/40"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt={`Opção ${c.idx + 1}`} className="aspect-[3/4] w-full object-cover" />
              </button>
            ))}
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-center gap-3">
            <Button variant="ghost" onClick={runCandidates} disabled={pending}>
              Gerar outros ({estimates.candidates} créditos)
            </Button>
            <Button onClick={runSheet} disabled={pending || !selected}>
              {pending ? "Enviando..." : "Usar este rosto"}
            </Button>
          </div>
        </div>
      )}

      {persona.status === "sheet_generating" && (
        <div className="space-y-4">
          <Card className="text-center">
            <p className="font-[family-name:var(--font-display)] text-lg">Travando a identidade...</p>
            <p className="text-sm text-muted">Gerando o mesmo rosto em 4 ângulos.</p>
          </Card>
          <TileGrid total={SHEET_KINDS.length} assets={sheet} labels />
        </div>
      )}

      {persona.status === "ready" && (
        <div className="space-y-6">
          <Card className="space-y-1 text-center">
            <p className="font-[family-name:var(--font-display)] text-xl text-accent">Persona pronta</p>
            <p className="text-sm text-muted">
              Character sheet travado — este rosto aparece idêntico em todos os vídeos.
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {sheet.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-2xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={KIND_LABEL[a.kind] ?? a.kind} className="aspect-[3/4] w-full object-cover" />
                <div className="bg-bg-soft p-2 text-center text-xs text-muted">
                  {KIND_LABEL[a.kind] ?? a.kind}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center">
            <Link
              href={`/videos/new?persona=${persona.id}`}
              className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-accent-ink transition hover:brightness-105"
            >
              Criar o primeiro vídeo
            </Link>
          </div>
        </div>
      )}

      {persona.status === "failed" && (
        <Card className="space-y-4 text-center">
          <p className="text-danger">{persona.error ?? "Algo deu errado."}</p>
          <ErrorText>{error}</ErrorText>
          <Button onClick={runCandidates} disabled={pending}>
            Tentar novamente ({estimates.creation} créditos)
          </Button>
        </Card>
      )}
    </div>
  );
}

/** Grade que mostra os ativos já gerados + placeholders animados para os pendentes. */
function TileGrid({
  total,
  assets,
  labels = false,
}: {
  total: number;
  assets: Asset[];
  labels?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: total }).map((_, i) => {
        const asset = assets[i];
        return (
          <div key={i} className="overflow-hidden rounded-2xl border border-line">
            {asset ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt="" className="aspect-[3/4] w-full object-cover" />
                {labels && (
                  <div className="bg-bg-soft p-2 text-center text-xs text-muted">
                    {KIND_LABEL[asset.kind] ?? asset.kind}
                  </div>
                )}
              </>
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center bg-bg-soft">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-accent" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
