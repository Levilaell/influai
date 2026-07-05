"use client";
// Configurações da marca: renomear e excluir (zona de perigo).
import { useState, useTransition } from "react";
import { renameBrandAction, deleteBrandAction } from "@/actions/brand";
import { Button, Card, Input, Label } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";

export function BrandSettings({ brandId, name }: { brandId: string; name: string }) {
  const [value, setValue] = useState(name);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      await renameBrandAction(brandId, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });

  return (
    <Card className="space-y-4">
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Configurações</h3>
      <div>
        <Label htmlFor="brandname">Nome da marca</Label>
        <div className="flex gap-2">
          <Input id="brandname" value={value} onChange={(e) => setValue(e.target.value)} />
          <Button onClick={save} disabled={pending || value.trim() === name} variant="ghost">
            {saved ? "salvo" : pending ? "..." : "salvar"}
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line pt-4">
        <div className="text-sm text-muted">
          Excluir a marca apaga <b>personas, vídeos, recursos e agenda</b>. Não dá pra desfazer.
        </div>
        <ConfirmButton
          onConfirm={() => deleteBrandAction(brandId)}
          confirm={`Excluir a marca "${name}" e TUDO dela (personas, vídeos, recursos)? Não dá pra desfazer.`}
          className="shrink-0 rounded-full border border-danger/40 px-4 py-1.5 text-sm text-danger transition hover:bg-danger/10"
          pendingLabel="excluindo..."
        >
          Excluir marca
        </ConfirmButton>
      </div>
    </Card>
  );
}
