"use client";
import { useActionState, useState } from "react";
import { generateWeekAction } from "@/actions/series";
import { DEFAULT_STYLE, type Music } from "@influa/core/pipeline/style";
import { MusicPicker } from "@/components/music-picker";
import { OBJECTIVES, LENGTHS } from "@influa/core/pipeline/format";
import { Button, Card, ErrorText, Label } from "@/components/ui";

type PersonaOption = { id: string; name: string; niche: string | null; coverUrl: string | null };
type Scene = { label: string; prompt: string };

export function BatchForm({
  brandId,
  personas,
  scenes,
}: {
  brandId: string;
  personas: PersonaOption[];
  scenes: Scene[];
}) {
  const [state, action, pending] = useActionState(generateWeekAction, undefined);
  const [personaId, setPersonaId] = useState(personas[0]?.id);
  const [count, setCount] = useState(5);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [music, setMusic] = useState<Music>(DEFAULT_STYLE.music);
  const [objective, setObjective] = useState(OBJECTIVES[0].key);
  const [length, setLength] = useState(LENGTHS[0].key);
  const scene = scenes[sceneIdx] ?? scenes[0] ?? { label: "Automático", prompt: "" };

  return (
    <Card>
      <form action={action} className="space-y-6">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="personaId" value={personaId} />
        <input type="hidden" name="style" value={JSON.stringify({ sceneLabel: scene.label, scenePrompt: scene.prompt, music })} />
        <input type="hidden" name="objective" value={objective} />
        <input type="hidden" name="length" value={length} />

        <div>
          <Label>Persona</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersonaId(p.id)}
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
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="count">Quantos vídeos</Label>
          <div className="grid grid-cols-3 gap-2">
            {[3, 5, 7].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  count === n ? "border-accent bg-accent/5" : "border-line hover:border-accent/40"
                }`}
              >
                {n} vídeos
              </button>
            ))}
          </div>
          <input type="hidden" name="count" value={count} />
        </div>

        <div>
          <Label htmlFor="objective">Objetivo</Label>
          <select id="objective" value={objective} onChange={(e) => setObjective(e.target.value as typeof objective)}
            className="w-full rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink outline-none focus:border-accent">
            {OBJECTIVES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <Label htmlFor="length">Duração (aplicada a todos)</Label>
          <select id="length" value={length} onChange={(e) => setLength(e.target.value as typeof length)}
            className="w-full rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink outline-none focus:border-accent">
            {LENGTHS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>

        <div className="space-y-4 rounded-2xl border border-line bg-bg-soft p-4">
          <p className="text-sm font-medium">Estilo (aplicado a todos)</p>
          <div>
            <Label htmlFor="scene">Cenário <span className="normal-case text-muted">(da sua marca)</span></Label>
            <select
              id="scene"
              value={sceneIdx}
              onChange={(e) => setSceneIdx(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent"
            >
              {scenes.map((s, i) => (
                <option key={i} value={i}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="music">Música</Label>
            <MusicPicker value={music} onChange={setMusic} />
          </div>
        </div>

        <ErrorText>{state?.error}</ErrorText>
        <Button type="submit" disabled={pending || !personaId} className="w-full">
          {pending ? "Gerando roteiros..." : `Gerar ${count} rascunhos`}
        </Button>
        <p className="text-center text-xs text-muted">
          Só gera os roteiros agora (grátis). Você revisa e gera os vídeos na aba Vídeos.
        </p>
      </form>
    </Card>
  );
}
