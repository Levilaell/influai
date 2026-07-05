"use client";
// Trocar voz e refazer: escolhe outra voz (com preview) e regera o vídeo com o
// mesmo roteiro. Custa uma nova geração (o take é lip-sync do novo áudio).
import { useRef, useState, useTransition } from "react";
import { changeVideoVoiceAction } from "@/actions/videos";
import { VoicePicker } from "../../personas/new/voice-picker";
import { Button, Card, ErrorText } from "@/components/ui";

export function ChangeVoice({ videoId, currentVoiceId }: { videoId: string; currentVoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const submit = () =>
    start(async () => {
      setError(undefined);
      const voiceId = ref.current?.querySelector<HTMLInputElement>('input[name="voiceId"]')?.value ?? "";
      const r = await changeVideoVoiceAction(videoId, voiceId);
      if (r?.error) setError(r.error);
      // sucesso => redirect (server action)
    });

  if (!open) {
    return (
      <p className="text-center text-xs text-muted">
        Não gostou da voz?{" "}
        <button onClick={() => setOpen(true)} className="underline hover:text-ink">
          refazer com outra voz
        </button>
      </p>
    );
  }

  return (
    <Card className="space-y-3">
      <p className="text-sm font-medium">Refazer com outra voz</p>
      <p className="text-xs text-muted">
        Escolha outra voz (clique em ouvir). Gera um <b>vídeo novo</b> com o mesmo roteiro — como o lip-sync
        precisa casar com a nova voz, custa igual a um vídeo normal (não é uma troca barata).
      </p>
      <div ref={ref}>
        <VoicePicker name="voiceId" defaultValue={currentVoiceId} />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Refazendo..." : "Refazer com esta voz"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </Card>
  );
}
