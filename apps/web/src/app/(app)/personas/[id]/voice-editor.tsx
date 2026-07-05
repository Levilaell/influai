"use client";
import { useActionState, useState } from "react";
import { updatePersonaVoiceAction } from "@/actions/personas";
import { VoicePicker } from "../../personas/new/voice-picker";
import { Button, Card, ErrorText } from "@/components/ui";

export function VoiceEditor({
  personaId,
  currentVoiceId,
  currentVoiceName,
}: {
  personaId: string;
  currentVoiceId: string;
  currentVoiceName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updatePersonaVoiceAction, undefined);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Voz da persona</h3>
          <p className="text-sm text-muted">
            Vale para os próximos vídeos. {currentVoiceName ? `Atual: ${currentVoiceName}` : ""}
          </p>
        </div>
        {!open && (
          <Button variant="ghost" onClick={() => setOpen(true)}>
            Trocar voz
          </Button>
        )}
      </div>

      {open && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="personaId" value={personaId} />
          <VoicePicker name="voiceId" defaultValue={currentVoiceId} />
          <ErrorText>{state?.error}</ErrorText>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar voz"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
