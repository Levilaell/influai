"use client";
import { use, useState } from "react";
import { useActionState } from "react";
import { createPersonaAction } from "@/actions/personas";
import { FACE_STYLES } from "@influa/core/pipeline/face";
import { Button, Card, ErrorText, Input, Label, Textarea } from "@/components/ui";
import { IdentityPresets } from "./identity-presets";
import { VoicePicker } from "./voice-picker";

export default function NewPersonaPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const { brand } = use(searchParams);
  const [faceStyle, setFaceStyle] = useState("realista");
  const [state, action, pending] = useActionState(createPersonaAction, undefined);
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Nova persona</h1>
        <p className="mt-1 text-muted">
          Passo 1 de 3 — quem é a sua influenciadora? A moderação roda antes de qualquer gasto.
        </p>
      </div>

      <Card>
        <form action={action} className="space-y-5">
          <input type="hidden" name="brandId" value={brand ?? ""} />
          <input type="hidden" name="faceStyle" value={faceStyle} />
          <div>
            <Label>Estilo do rosto</Label>
            <div className="grid grid-cols-2 gap-2">
              {FACE_STYLES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFaceStyle(f.key)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    faceStyle === f.key ? "border-accent bg-accent/5" : "border-line hover:border-accent/40"
                  }`}
                >
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-[11px] text-muted">{f.hint}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" placeholder="Lia" required />
          </div>
          <div>
            <Label htmlFor="description">Aparência do rosto</Label>
            <p className="mb-2 text-xs text-muted">Escolha um estilo pronto ou descreva você mesmo:</p>
            <IdentityPresets />
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="mulher brasileira, ~25 anos, cabelo castanho ondulado, olhos castanhos, sorriso caloroso"
              required
            />
            <p className="mt-1.5 text-xs text-muted">
              Personas são 100% sintéticas — descrições de pessoas reais ou celebridades são bloqueadas.
            </p>
          </div>
          <div>
            <Label htmlFor="niche">Nicho de conteúdo</Label>
            <Input id="niche" name="niche" placeholder="curiosidades de tecnologia" required />
          </div>
          <div>
            <Label>Voz (fixa da persona, em todos os vídeos) — clique em ouvir para testar</Label>
            <VoicePicker name="voiceId" defaultValue="XrExE9yKIg1WjnnlVkGX" />
          </div>
          <ErrorText>{state?.error}</ErrorText>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Validando..." : "Continuar para escolher o rosto"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
