"use client";
// Registro manual de desempenho do vídeo (views/likes/comentários/salvamentos).
// Alimenta o loop de aprendizado da marca. No futuro, preenchido pela IG Insights API.
import { useState, useTransition } from "react";
import { recordVideoMetricsAction, type LatestMetrics } from "@/actions/metrics";
import { Button, Card, ErrorText } from "@/components/ui";

const FIELDS = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Curtidas" },
  { key: "comments", label: "Comentários" },
  { key: "saves", label: "Salvamentos" },
] as const;

export function MetricsPanel({ videoId, latest }: { videoId: string; latest: LatestMetrics }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState({
    views: latest?.views ?? 0, likes: latest?.likes ?? 0, comments: latest?.comments ?? 0, saves: latest?.saves ?? 0,
  });
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(undefined);
      const r = await recordVideoMetricsAction(videoId, vals);
      if (r?.error) return setError(r.error);
      setSaved(true);
      setOpen(false);
    });

  if (!open) {
    return (
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Desempenho</p>
          <p className="text-xs text-muted">
            {latest
              ? `${latest.views} views · ${latest.likes} curtidas · ${latest.saves} salvos`
              : "Registre os números do post para a IA aprender o que funciona."}
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="text-sm text-accent hover:underline">
          {saved || latest ? "atualizar" : "registrar"}
        </button>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <p className="text-sm font-medium">Registrar desempenho</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-muted">{f.label}</label>
            <input
              type="number"
              min={0}
              value={vals[f.key]}
              onChange={(e) => setVals((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
              className="w-full rounded-xl border border-line bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        ))}
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </Card>
  );
}
