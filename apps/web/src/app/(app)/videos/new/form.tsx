"use client";
import { useActionState, useState, useTransition } from "react";
import { createVideoDraftAction } from "@/actions/videos";
import { generateIdeasAction, type BrandAsset } from "@/actions/brand";
import type { VideoIdea } from "@influa/core/brand/index";
import { DEFAULT_STYLE, type Music } from "@influa/core/pipeline/style";
import { MusicPicker } from "@/components/music-picker";
import { OBJECTIVES, LENGTHS } from "@influa/core/pipeline/format";
import { Button, Card, ErrorText, Label, Textarea } from "@/components/ui";

type PersonaOption = { id: string; name: string; niche: string | null; coverUrl: string | null };
type Scene = { label: string; prompt: string; refKey: string };

export function NewVideoForm({
  brandId,
  personas,
  assets,
  scenes,
  preselect,
}: {
  brandId: string;
  personas: PersonaOption[];
  assets: BrandAsset[];
  scenes: Scene[];
  preselect: string | null;
}) {
  const [state, action, pending] = useActionState(createVideoDraftAction, undefined);
  const [personaId, setPersonaId] = useState(preselect ?? personas[0]?.id);
  const [topic, setTopic] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const toggleRef = (id: string) =>
    setRefs((r) => (r.includes(id) ? r.filter((x) => x !== id) : r.length >= 4 ? r : [...r, id]));
  // Estilo do vídeo (sem surpresas — o usuário escolhe)
  const [sceneIdx, setSceneIdx] = useState(0);
  const [music, setMusic] = useState<Music>(DEFAULT_STYLE.music);
  const [broll, setBroll] = useState(DEFAULT_STYLE.broll);
  const [objective, setObjective] = useState(OBJECTIVES[0].key);
  const scene = scenes[sceneIdx] ?? scenes[0] ?? { label: "Automático", prompt: "", refKey: "" };
  const [ideas, setIdeas] = useState<VideoIdea[] | null>(null);
  const [ideasNote, setIdeasNote] = useState<string | undefined>();
  const [ideasPending, startIdeas] = useTransition();

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
      <form action={action} className="space-y-6">
        <input type="hidden" name="personaId" value={personaId} />
        <input type="hidden" name="referenceKeys" value={JSON.stringify(refs)} />
        <input type="hidden" name="style" value={JSON.stringify({ sceneLabel: scene.label, scenePrompt: scene.prompt, sceneRefKey: scene.refKey, music, broll })} />
        <input type="hidden" name="objective" value={objective} />
        <div>
          <Label>Persona</Label>
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

        <div>
          <Label htmlFor="objective">Objetivo <span className="normal-case text-muted">(guia as ideias, o tom e a estrutura)</span></Label>
          <select
            id="objective"
            value={objective}
            onChange={(e) => { setObjective(e.target.value as typeof objective); setIdeas(null); }}
            className="w-full rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink outline-none focus:border-accent"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor="topic">Tema do vídeo</Label>
            <button
              type="button"
              onClick={getIdeas}
              disabled={ideasPending || !personaId}
              className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
            >
              {ideasPending ? "pensando..." : "Me dê ideias"}
            </button>
          </div>
          <Textarea
            id="topic"
            name="topic"
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="3 apps de IA que parecem ilegais de tão bons"
            required
          />
          {ideasNote && <p className="mt-1.5 text-xs text-muted">{ideasNote}</p>}
          {ideas && (
            <div className="mt-3 grid gap-2">
              {ideas.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTopic(idea.topic)}
                  className="rounded-xl border border-line bg-bg px-4 py-3 text-left transition hover:border-accent"
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

        <div className="space-y-4 rounded-2xl border border-line bg-bg-soft p-4">
          <p className="text-sm font-medium">Estilo do vídeo</p>

          <div>
            <Label htmlFor="scene">Cenário <span className="normal-case text-muted">(sob medida da sua marca)</span></Label>
            <select
              id="scene"
              value={sceneIdx}
              onChange={(e) => setSceneIdx(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent"
            >
              {scenes.map((s, i) => (
                <option key={i} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="music">Música de fundo</Label>
            <MusicPicker value={music} onChange={setMusic} />
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={broll} onChange={(e) => setBroll(e.target.checked)} className="mt-0.5 accent-accent" />
            <span>
              Corte de B-roll <span className="text-muted">(+custo)</span>
              <span className="block text-[11px] text-muted">
                A IA corta para um clipe ilustrativo no melhor momento, mantendo a voz.
              </span>
            </span>
          </label>
        </div>

        <div>
          <Label htmlFor="length">Duração</Label>
          <select
            id="length"
            name="length"
            defaultValue="curto"
            className="w-full rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink outline-none focus:border-accent"
          >
            {LENGTHS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
                {l.segments > 1 ? ` — vídeo longo (${l.segments} takes)` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted">
            Vídeos longos custam mais (vários takes) — o custo abaixo já considera isso.
          </p>
        </div>
        <ErrorText>{state?.error}</ErrorText>
        {state?.error?.includes("insuficientes") && (
          <a href="/credits" className="block text-sm font-semibold text-accent hover:underline">
            Ver planos →
          </a>
        )}
        <Button type="submit" disabled={pending || !personaId} className="w-full">
          {pending ? "Escrevendo o roteiro..." : "Gerar roteiro →"}
        </Button>
      </form>
    </Card>
  );
}
