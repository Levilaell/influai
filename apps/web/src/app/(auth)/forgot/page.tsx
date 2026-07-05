"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/actions/auth";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";

export default function ForgotPage() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl font-semibold">Redefinir senha</h1>
        <p className="mb-6 text-sm text-muted">Enviaremos um link para o seu e-mail.</p>
        {state?.ok ? (
          <p className="rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent">{state.ok}</p>
        ) : (
          <form action={action} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <ErrorText>{state?.error}</ErrorText>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Enviando..." : "Enviar link"}
            </Button>
          </form>
        )}
        <p className="mt-5 text-center text-sm text-muted">
          <Link href="/login" className="text-accent hover:underline">
            Voltar ao login
          </Link>
        </p>
      </Card>
    </main>
  );
}
