"use client";
// Agendar a publicação de um vídeo pronto (Instagram). A publicação real destrava
// quando a conta for conectada (OAuth) e o app review da Meta sair.
import { useState, useTransition } from "react";
import { schedulePostAction } from "@/actions/schedule";
import { Button, Card, ErrorText, Label, Textarea } from "@/components/ui";

export function Scheduler({ videoId, defaultCaption }: { videoId: string; defaultCaption: string }) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [caption, setCaption] = useState(defaultCaption);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(undefined);
      // datetime-local vem sem timezone → interpretado como horário local do browser
      const iso = when ? new Date(when).toISOString() : "";
      const r = await schedulePostAction(videoId, iso, caption);
      if (r?.error) return setError(r.error);
      setDone(true);
      setOpen(false);
    });

  if (done) {
    return (
      <Card className="text-center text-sm text-accent">
        Publicação agendada. Acompanhe na aba <b>Agenda</b> da marca.
      </Card>
    );
  }

  if (!open) {
    return (
      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Agendar publicação
        </Button>
      </div>
    );
  }

  return (
    <Card className="space-y-3">
      <p className="font-[family-name:var(--font-display)] text-lg">Agendar publicação</p>
      <div>
        <Label htmlFor="when">Data e hora</Label>
        <input
          id="when"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      <div>
        <Label htmlFor="cap">Legenda</Label>
        <Textarea id="cap" rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>
      <p className="text-xs text-muted">
        A publicação automática no Instagram entra no ar assim que sua conta profissional for conectada
        (depende da aprovação da Meta). Até lá, o agendamento fica registrado.
      </p>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending || !when}>
          {pending ? "Agendando..." : "Agendar"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
