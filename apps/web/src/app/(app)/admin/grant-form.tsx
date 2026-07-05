"use client";
import { useActionState } from "react";
import { adminGrantCreditsAction } from "@/actions/admin";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";

export function GrantForm() {
  const [state, action, pending] = useActionState(adminGrantCreditsAction, undefined);
  return (
    <Card>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <Label htmlFor="email">E-mail do usuário</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="w-32">
          <Label htmlFor="amount">Créditos</Label>
          <Input id="amount" name="amount" type="number" min={1} required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "..." : "Conceder"}
        </Button>
      </form>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && <p className="mt-2 text-sm text-accent">{state.ok}</p>}
    </Card>
  );
}
