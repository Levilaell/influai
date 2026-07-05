"use client";
// Painel da marca com abas: Cérebro · Recursos · Personas · Vídeos · Agenda · Memória.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { enqueueAllDraftsAction } from "@/actions/series";
import { disconnectInstagramAction } from "@/actions/schedule";
import { analyzeLearningsAction } from "@/actions/metrics";
import type { BrandProfile } from "@influa/core/brand/index";
import type { BrandAsset } from "@/actions/brand";
import type { ScheduledPost } from "@/actions/schedule";
import { deletePersonaAction } from "@/actions/brand";
import { Badge, Card } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { BrandBrain } from "./brand-brain";
import { BrandResources } from "./resources";
import { BrandSettings } from "./brand-settings";
import { Agenda } from "./agenda";
import { AutoRefresh } from "@/components/auto-refresh";

type Persona = { id: string; name: string; status: string; niche: string | null; coverUrl: string | null };
type Video = { id: string; status: string; title: string | null; topic: string; personaName: string; finalUrl: string | null };
type Memory = { coveredTopics: { topic: string; at: string }[]; learnings: string[] };

const PERSONA_ACTIVE = ["candidates_generating", "sheet_generating"];
const VIDEO_ACTIVE = ["queued", "scripting", "keyframing", "voicing", "rendering", "assembling"];

const VIDEO_STATUS: Record<string, { label: string; tone: "ok" | "muted" | "danger" | "accent" }> = {
  draft: { label: "Rascunho", tone: "muted" }, estimated: { label: "Rascunho", tone: "muted" },
  queued: { label: "Na fila", tone: "accent" }, keyframing: { label: "Gerando cena", tone: "accent" },
  voicing: { label: "Gravando voz", tone: "accent" }, rendering: { label: "Animando", tone: "accent" },
  assembling: { label: "Finalizando", tone: "accent" }, ready: { label: "Pronto", tone: "ok" },
  failed: { label: "Falhou", tone: "danger" }, canceled: { label: "Cancelado", tone: "muted" },
};

const TABS = ["Cérebro", "Recursos", "Personas", "Vídeos", "Agenda", "Memória"] as const;
type Tab = (typeof TABS)[number];

type Instagram = { connected: boolean; username: string | null; notice: string | null };

export function BrandDashboard({
  brand,
  instagram,
  profile,
  assets,
  scheduled,
  batch,
  memory,
  personas,
  videos,
}: {
  brand: { id: string; name: string };
  instagram: Instagram;
  profile: BrandProfile | null;
  assets: BrandAsset[];
  scheduled: ScheduledPost[];
  batch: { requested: number; created: number } | null;
  memory: Memory;
  personas: Persona[];
  videos: Video[];
}) {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab") as Tab | null;
  // Marca nova abre em "Personas" (criar o influenciador = caminho do vídeo), não no print.
  // O "Cérebro" (print) é opcional — melhora os temas, mas não bloqueia nada.
  const tab: Tab = urlTab && TABS.includes(urlTab) ? urlTab : profile ? "Vídeos" : "Personas";
  const hasActive =
    Boolean(batch) ||
    personas.some((p) => PERSONA_ACTIVE.includes(p.status)) ||
    videos.some((v) => VIDEO_ACTIVE.includes(v.status));
  const draftCount = videos.filter((v) => ["draft", "estimated"].includes(v.status)).length;

  return (
    <div className="space-y-6">
      <AutoRefresh active={hasActive} />
      {batch && (
        <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Gerando sua semana... {batch.created} de {batch.requested} rascunhos prontos. Pode fechar — continua rodando.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/brands" className="text-xs text-muted hover:text-accent">
            ← Marcas
          </Link>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">{brand.name}</h1>
        </div>
        {profile && <Badge tone="ok">cérebro ativo</Badge>}
      </div>

      {/* Abas — rolam na horizontal no mobile (6 abas não cabem em telas estreitas) */}
      <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`?tab=${encodeURIComponent(t)}`}
            scroll={false}
            className={`relative shrink-0 whitespace-nowrap px-4 py-2.5 text-sm transition ${
              tab === t ? "text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded bg-accent" />}
            {t === "Recursos" && assets.length > 0 && <span className="ml-1.5 text-xs text-muted">{assets.length}</span>}
            {t === "Personas" && personas.length > 0 && <span className="ml-1.5 text-xs text-muted">{personas.length}</span>}
            {t === "Vídeos" && videos.length > 0 && <span className="ml-1.5 text-xs text-muted">{videos.length}</span>}
            {t === "Agenda" && scheduled.some((s) => s.status === "scheduled") && (
              <span className="ml-1.5 text-xs text-accent">{scheduled.filter((s) => s.status === "scheduled").length}</span>
            )}
          </Link>
        ))}
      </div>

      {tab === "Cérebro" && (
        <div className="space-y-6">
          <BrandBrain brandId={brand.id} initial={profile} />
          <BrandSettings brandId={brand.id} name={brand.name} />
        </div>
      )}

      {tab === "Recursos" && <BrandResources brandId={brand.id} initial={assets} />}

      {tab === "Agenda" && (
        <div className="space-y-5">
          <InstagramConnect brandId={brand.id} instagram={instagram} />
          <Agenda initial={scheduled} />
        </div>
      )}

      {tab === "Personas" && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <Link href={`/personas/new?brand=${brand.id}`} className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-ink">
              + Nova persona
            </Link>
          </div>
          {personas.length === 0 ? (
            <Card className="py-12 text-center text-muted">Nenhuma persona ainda. Crie o primeiro rosto desta marca.</Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {personas.map((p) => (
                <Link key={p.id} href={`/personas/${p.id}`} className="group relative">
                  <ConfirmButton
                    onConfirm={() => deletePersonaAction(p.id)}
                    confirm={`Excluir a persona "${p.name}" e TODOS os vídeos dela? Não dá pra desfazer.`}
                    className="absolute right-2 top-2 z-10 rounded-full bg-bg/80 px-2 py-1 text-xs text-muted opacity-0 backdrop-blur transition hover:text-danger group-hover:opacity-100"
                    pendingLabel="..."
                  >
                    excluir
                  </ConfirmButton>
                  <div className="overflow-hidden rounded-2xl border border-line bg-bg-soft transition group-hover:border-accent/50">
                    <div className="aspect-[3/4] w-full bg-bg">
                      {p.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.coverUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl text-muted">?</div>
                      )}
                    </div>
                    <div className="space-y-1.5 p-3">
                      <div className="text-sm font-medium">{p.name}</div>
                      <Badge tone={p.status === "ready" ? "ok" : p.status === "failed" ? "danger" : "accent"}>
                        {p.status === "ready" ? "pronta" : p.status === "failed" ? "falhou" : "gerando..."}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Vídeos" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            {draftCount > 0 && <EnqueueAll brandId={brand.id} count={draftCount} />}
            {personas.some((p) => p.status === "ready") && (
              <Link href={`/videos/batch?brand=${brand.id}`} className="rounded-full border border-line px-5 py-2 text-sm transition hover:border-accent">
                Gerar minha semana
              </Link>
            )}
            <Link
              href={`/videos/new?brand=${brand.id}`}
              className={`rounded-full px-5 py-2 text-sm font-bold ${
                personas.some((p) => p.status === "ready")
                  ? "bg-accent text-accent-ink"
                  : "pointer-events-none border border-line text-muted"
              }`}
            >
              + Novo vídeo
            </Link>
          </div>
          {videos.length === 0 ? (
            <Card className="py-12 text-center text-muted">
              {personas.some((p) => p.status === "ready")
                ? "Nenhum vídeo ainda. Gere o primeiro."
                : "Crie e finalize uma persona antes de gerar vídeos."}
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {videos.map((v) => {
                const s = VIDEO_STATUS[v.status] ?? { label: v.status, tone: "muted" as const };
                const processing = ["queued", "voicing", "keyframing", "rendering", "assembling"].includes(v.status);
                return (
                  <Link key={v.id} href={`/videos/${v.id}`} className="group">
                    <div className="overflow-hidden rounded-2xl border border-line bg-bg-soft transition group-hover:border-accent/50">
                      <div className="relative flex aspect-[9/16] w-full items-center justify-center bg-gradient-to-br from-bg-soft to-bg">
                        {v.finalUrl ? (
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <video src={v.finalUrl} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                        ) : processing ? (
                          <div className="flex flex-col items-center gap-2 text-muted">
                            <span className="h-7 w-7 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                            <span className="text-[11px]">gerando...</span>
                          </div>
                        ) : v.status === "failed" ? (
                          <div className="flex flex-col items-center gap-1.5 text-danger/70">
                            <span className="text-2xl leading-none">!</span>
                            <span className="text-[11px]">falhou</span>
                          </div>
                        ) : (
                          // rascunho: roteiro pronto, aguardando você gerar
                          <div className="flex flex-col items-center gap-2 text-muted transition group-hover:text-accent">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-current">
                              <span className="ml-0.5 border-y-[7px] border-l-[11px] border-y-transparent border-l-current" />
                            </span>
                            <span className="text-[11px]">rascunho — abrir</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 p-3">
                        <div className="line-clamp-1 text-sm font-medium">{v.title ?? v.topic}</div>
                        <div className="flex items-center justify-between">
                          <Badge tone={s.tone}>{s.label}</Badge>
                          <span className="text-xs text-muted">{v.personaName}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "Memória" && (
        <div className="space-y-5">
          <Card>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Memória operacional</h3>
            <p className="mt-1 text-sm text-muted">
              A IA registra o que já foi feito e o que funciona, para não repetir temas e melhorar com o tempo.
              É consultada em toda geração de roteiro e ideias.
            </p>
          </Card>
          <Card>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">Temas já cobertos ({memory.coveredTopics.length})</p>
            {memory.coveredTopics.length === 0 ? (
              <p className="text-sm text-muted">Ainda nenhum. Cada vídeo pronto registra seu tema aqui.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {memory.coveredTopics.slice(0, 30).map((t, i) => (
                  <Badge key={i}>{t.topic}</Badge>
                ))}
              </div>
            )}
          </Card>
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Aprendizados</p>
                <p className="text-xs text-muted">
                  A IA analisa o desempenho dos vídeos (aba Vídeos → registre os números) e aprende o que funciona.
                </p>
              </div>
              <AnalyzeLearnings brandId={brand.id} />
            </div>
            {memory.learnings.length > 0 ? (
              <ul className="space-y-1 text-sm text-muted">
                {memory.learnings.map((l, i) => (
                  <li key={i}>• {l}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Ainda nenhum. Registre o desempenho de pelo menos 2 vídeos e clique em Analisar.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// Roda a análise de aprendizado (Claude sobre os vídeos + métricas da marca).
function AnalyzeLearnings({ brandId }: { brandId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      const r = await analyzeLearningsAction(brandId);
      if (r.error) return setMsg(r.error);
      if ((r.sample ?? 0) < 2) return setMsg("Registre o desempenho de mais vídeos primeiro.");
      setMsg(`Analisado (${r.sample} vídeos).`);
    });
  return (
    <div className="flex shrink-0 items-center gap-2">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <button
        onClick={run}
        disabled={pending}
        className="rounded-full border border-accent/50 px-4 py-1.5 text-sm text-accent transition hover:bg-accent/5 disabled:opacity-60"
      >
        {pending ? "Analisando..." : "Analisar desempenho"}
      </button>
    </div>
  );
}

// Conexão com o Instagram (publicação automática). Liga quando o app review sair.
function InstagramConnect({ brandId, instagram }: { brandId: string; instagram: Instagram }) {
  const [pending, start] = useTransition();
  const disconnect = () => start(async () => { await disconnectInstagramAction(brandId); });

  return (
    <Card className="space-y-2">
      {instagram.notice && (
        <p className="rounded-lg border border-line bg-bg px-3 py-2 text-xs text-muted">{instagram.notice}</p>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Instagram</h3>
          <p className="text-xs text-muted">
            {instagram.connected
              ? `Conectado${instagram.username ? ` como @${instagram.username}` : ""} — publicação automática ativa.`
              : "Conecte a conta profissional para publicar automaticamente no horário agendado."}
          </p>
        </div>
        {instagram.connected ? (
          <button onClick={disconnect} disabled={pending} className="text-xs text-muted hover:text-danger">
            {pending ? "..." : "desconectar"}
          </button>
        ) : (
          <a
            href={`/api/instagram/connect?brand=${brandId}`}
            className="rounded-full border border-accent/50 px-4 py-1.5 text-sm text-accent transition hover:bg-accent/5"
          >
            Conectar Instagram
          </a>
        )}
      </div>
    </Card>
  );
}

// Enfileira todos os rascunhos da marca de uma vez (gera de fato).
function EnqueueAll({ brandId, count }: { brandId: string; count: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      const r = await enqueueAllDraftsAction(brandId);
      if (r.error) return setMsg(r.error);
      setMsg(`${r.queued} enviados${r.skipped ? ` · ${r.skipped} sem crédito` : ""}`);
    });
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <button
        onClick={run}
        disabled={pending}
        className="rounded-full border border-accent/50 px-5 py-2 text-sm text-accent transition hover:bg-accent/5 disabled:opacity-60"
      >
        {pending ? "Enviando..." : `Gerar ${count} rascunho(s)`}
      </button>
    </div>
  );
}
