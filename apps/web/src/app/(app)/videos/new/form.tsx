"use client";
// Novo vídeo em ETAPAS (uma coisa por vez, sem parede de opções):
//   [Influenciador →] Tema → Estilo (cenário em cards + música + voz) → Gerar roteiro.
// Tudo vive num único <form>; as etapas só mostram/escondem — nada se perde ao voltar.
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createVideoDraftAction } from "@/actions/videos";
import { generateIdeasAction, type BrandAsset } from "@/actions/brand";
import type { VideoIdea } from "@influa/core/brand/index";
import { DEFAULT_STYLE, type Music } from "@influa/core/pipeline/style";
import { MusicPicker, PlayIcon } from "@/components/music-picker";
import { OBJECTIVES } from "@influa/core/pipeline/format";
import { Button, Card, ErrorText, Label, Textarea } from "@/components/ui";

type PersonaOption = { id: string; name: string; niche: string | null; voiceId: string; coverUrl: string | null };
type Scene = { label: string; prompt: string; refKey: string; thumbUrl: string | null };
type Voice = { id: string; name: string; preview: string | null; labels: Record<string, string> };

export function NewVideoForm({
  brandId,
  personas,
  assets,
  scenes,
  preselect,
  initialTopic,
  topicPlaceholder,
}: {
  brandId: string;
  personas: PersonaOption[];
  assets: BrandAsset[];
  scenes: Scene[];
  preselect: string | null;
  initialTopic: string;
  topicPlaceholder: string;
}) {
  const [state, action, pending] = useActionState(createVideoDraftAction, undefined);
  const [personaId, setPersonaId] = useState(preselect ?? personas[0]?.id);
  const [topic, setTopic] = useState(initialTopic);
  const [refs, setRefs] = useState<string[]>([]);
  const toggleRef = (id: string) =>
    setRefs((r) => (r.includes(id) ? r.filter((x) => x !== id) : r.length >= 4 ? r : [...r, id]));
  const [sceneIdx, setSceneIdx] = useState(0);
  const [music, setMusic] = useState<Music>(DEFAULT_STYLE.music);
  const [objective, setObjective] = useState(OBJECTIVES[0].key);
  const scene = scenes[sceneIdx] ?? scenes[0] ?? { label: "Automático", prompt: "", refKey: "", thumbUrl: null };
  const [ideas, setIdeas] = useState<VideoIdea[] | null>(null);
  const [ideasNote, setIdeasNote] = useState<string | undefined>();
  const [ideasPending, startIdeas] = useTransition();

  const persona = personas.find((p) => p.id === personaId);
  // voz do vídeo: começa na voz da persona; o usuário pode trocar só pra este vídeo
  const [voiceId, setVoiceId] = useState(persona?.voiceId ?? "");
  useEffect(() => {
    setVoiceId(persona?.voiceId ?? "");
  }, [personaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── etapas ──
  const stepKeys = [...(personas.length > 1 ? (["persona"] as const) : []), "tema", "estilo"] as const;
  const [stepIdx, setStepIdx] = useState(0);
  const step = stepKeys[stepIdx];
  const isLast = stepIdx === stepKeys.length - 1;
  const canContinue =
    step === "persona" ? Boolean(personaId) : step === "tema" ? topic.trim().length >= 3 : true;
  const STEP_LABEL: Record<string, string> = { persona: "Influenciador", tema: "Tema", estilo: "Estilo" };

  const getIdeas = () =>
    startIdeas(async () => {
      setIdeasNote(undefined);
      const r = await generateIdeasAction(brandId, objective);
      if (r.error) return setIdeasNote(r.error);
      setIdeas(r.ideas!);
      if (r.usedFallback)
        setIdeasNote("Dica: conecte o Cérebro da Marca (aba Cérebro) pra ideias muito mais afiadas.");
    });

  return (
    <Card>
      {/* Barra de etapas */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          {stepKeys.map((k, i) => (
            <button
              key={k}
              type="button"
              onClick={() => i < stepIdx && setStepIdx(i)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition ${
                i === stepIdx
                  ? "bg-accent/15 font-semibold text-accent"
                  : i < stepIdx
                    ? "text-ink hover:text-accent"
                    : "cursor-default text-muted"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                  i < stepIdx ? "border-accent bg-accent text-accent-ink" : i === stepIdx ? "border-accent text-accent" : "border-line"
                }`}
              >
                {i < stepIdx ? "✓" : i + 1}
              </span>
              {STEP_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${((stepIdx + 1) / stepKeys.length) * 100}%` }}
          />
        </div>
      </div>

      <form action={action} className="space-y-6">
        <input type="hidden" name="personaId" value={personaId} />
        <input type="hidden" name="topic" value={topic} />
        <input type="hidden" name="referenceKeys" value={JSON.stringify(refs)} />
        <input type="hidden" name="style" value={JSON.stringify({ sceneLabel: scene.label, scenePrompt: scene.prompt, sceneRefKey: scene.refKey, music, broll: false })} />
        <input type="hidden" name="objective" value={objective} />
        <input type="hidden" name="voice" value={voiceId} />
        <input type="hidden" name="length" value="curto" />

        {/* ── ETAPA: influenciador ── */}
        {step === "persona" && (
          <div>
            <Label>Quem vai apresentar este vídeo?</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {personas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPersonaId(p.id);
                    setIdeas(null);
                  }}
                  className={`overflow-hidden rounded-xl border-2 text-left transition ${
                    personaId === p.id ? "border-accent" : "border-line hover:border-accent/40"
                  }`}
                >
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt={p.name} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-2xl text-muted">?</div>
                  )}
                  <div className="p-2 text-xs">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-muted">{p.niche}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── ETAPA: objetivo + tema ── */}
        {step === "tema" && (
          <div className="space-y-6">
            <div>
              <Label>Objetivo <span className="normal-case text-muted">(guia as ideias, o tom e a estrutura)</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {OBJECTIVES.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => {
                      setObjective(o.key);
                      setIdeas(null);
                    }}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                      objective === o.key ? "border-accent bg-accent/5 font-medium text-ink" : "border-line text-muted hover:border-accent/40"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label htmlFor="topic-input">Tema do vídeo</Label>
                <button
                  type="button"
                  onClick={getIdeas}
                  disabled={ideasPending || !personaId}
                  className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                >
                  {ideasPending ? "pensando..." : "Me dê ideias ✨"}
                </button>
              </div>
              <Textarea
                id="topic-input"
                rows={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={topicPlaceholder}
              />
              {ideasNote && <p className="mt-1.5 text-xs text-muted">{ideasNote}</p>}
              {ideas && (
                <div className="mt-3 grid gap-2">
                  {ideas.map((idea, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTopic(idea.topic)}
                      className={`rounded-xl border bg-bg px-4 py-3 text-left transition ${
                        topic === idea.topic ? "border-accent" : "border-line hover:border-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                          {idea.format}
                        </span>
                        <span className="text-sm font-medium">{idea.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted">"{idea.hook}"</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ETAPA: estilo (cenário + música + voz + recursos) ── */}
        {step === "estilo" && (
          <div className="space-y-6">
            <div>
              <Label>Cenário <span className="normal-case text-muted">(sob medida da sua marca)</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {scenes.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSceneIdx(i)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm leading-snug transition ${
                      sceneIdx === i ? "border-accent bg-accent/5 font-medium text-ink" : "border-line text-muted hover:border-accent/40"
                    }`}
                  >
                    {s.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumbUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    ) : i === 0 ? (
                      <span className="shrink-0 text-accent">✦</span>
                    ) : null}
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                O cenário vira instrução da cena do vídeo — escolher aqui não gera nada nem custa a mais.
              </p>
            </div>

            <div>
              <Label>Música de fundo</Label>
              <MusicPicker value={music} onChange={setMusic} />
            </div>

            <VoiceSelect value={voiceId} onChange={setVoiceId} personaVoiceId={persona?.voiceId ?? ""} />

            {assets.length > 0 && (
              <div>
                <Label>Mostrar na cena (opcional — logo/produto, até 4)</Label>
                <div className="grid grid-cols-4 gap-3 md:grid-cols-6">
                  {assets.map((a) => {
                    const on = refs.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleRef(a.id)}
                        title={a.label || a.kind}
                        className={`relative overflow-hidden rounded-xl border-2 bg-white transition ${
                          on ? "border-accent" : "border-line hover:border-accent/40"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.label} className="aspect-square w-full object-contain" />
                        {on && (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  A persona vai aparecer apresentando o que você marcar. Deixe vazio para uma cena só com a persona.
                </p>
              </div>
            )}
          </div>
        )}

        <ErrorText>{state?.error}</ErrorText>
        {state?.error?.includes("insuficientes") && (
          <a href="/credits" className="block text-sm font-semibold text-accent hover:underline">
            Ver planos →
          </a>
        )}

        {/* Navegação das etapas */}
        <div className="flex items-center justify-between gap-3">
          {stepIdx > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStepIdx((i) => i - 1)}>
              ← Voltar
            </Button>
          ) : (
            <span />
          )}
          {isLast ? (
            <Button type="submit" disabled={pending || !personaId || topic.trim().length < 3} className="flex-1 sm:flex-none sm:px-10">
              {pending ? "Escrevendo o roteiro..." : "Gerar roteiro →"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canContinue}
              onClick={() => setStepIdx((i) => i + 1)}
              className="flex-1 sm:flex-none sm:px-10"
            >
              Continuar →
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

// Voz deste vídeo: padrão = voz da persona; trocar aqui vale SÓ pra este vídeo.
function VoiceSelect({
  value,
  onChange,
  personaVoiceId,
}: {
  value: string;
  onChange: (id: string) => void;
  personaVoiceId: string;
}) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d) => setVoices(d.voices ?? []))
      .catch(() => {});
    return () => audioRef.current?.pause();
  }, []);

  const play = (v: Voice) => {
    audioRef.current?.pause();
    if (playing === v.id) return setPlaying(null);
    if (!v.preview) return;
    const a = new Audio(v.preview);
    audioRef.current = a;
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
    setPlaying(v.id);
  };

  const current = voices.find((v) => v.id === value);

  return (
    <div>
      <Label>Voz</Label>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-bg px-4 py-3 text-sm">
        <span>
          <b>{current?.name ?? "Voz da persona"}</b>
          {current?.labels?.tone && <span className="text-muted"> — {current.labels.tone}</span>}
          {value === personaVoiceId && <span className="text-muted"> (voz da persona)</span>}
        </span>
        {current?.preview && (
          <button
            type="button"
            onClick={() => play(current)}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-accent transition hover:border-accent"
          >
            <PlayIcon /> {playing === current.id ? "parar" : "ouvir"}
          </button>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-muted underline hover:text-accent">
          {open ? "fechar" : "trocar só neste vídeo"}
        </button>
      </div>
      {open && (
        <div className="mt-2 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {voices.map((v) => (
            <div
              key={v.id}
              className={`flex items-center justify-between rounded-xl border bg-bg px-3 py-2 text-sm transition ${
                value === v.id ? "border-accent" : "border-line hover:border-accent/40"
              }`}
            >
              <button type="button" onClick={() => onChange(v.id)} className="flex-1 text-left">
                <span className="font-medium">{v.name}</span>
                <span className="block text-[11px] text-muted">
                  {v.labels?.gender}
                  {v.labels?.tone ? ` · ${v.labels.tone}` : ""}
                </span>
              </button>
              <button
                type="button"
                onClick={() => play(v)}
                className="ml-2 shrink-0 rounded-full border border-line px-3 py-1 text-xs text-accent transition hover:border-accent"
              >
                {playing === v.id ? "parar" : "ouvir"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
