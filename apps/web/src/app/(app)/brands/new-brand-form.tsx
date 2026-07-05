"use client";
import { useActionState } from "react";
import { createBrandAction } from "@/actions/brand";
import { Button, ErrorText, Input } from "@/components/ui";

export function NewBrandForm({ defaultName = "" }: { defaultName?: string }) {
  const [state, action, pending] = useActionState(createBrandAction, undefined);
  return (
    <form action={action} className="w-full space-y-3">
      <p className="text-sm font-medium">{defaultName ? "Vamos criar sua primeira marca 👇" : "Nova marca"}</p>
      <Input name="name" placeholder="Ex: Doce Bruto, minha loja..." required defaultValue={defaultName} />
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando..." : defaultName ? "Criar minha marca →" : "Criar marca"}
      </Button>
    </form>
  );
}
