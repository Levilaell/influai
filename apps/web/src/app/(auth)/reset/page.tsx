"use client";
import { use } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/actions/auth";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";

export default function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = use(searchParams);
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl font-semibold">Nova senha</h1>
        <p className="mb-6 text-sm text-muted">Escolha uma senha com pelo menos 8 caracteres.</p>
        {!token ? (
          <p className="text-sm text-danger">Link inválido. Peça um novo em Esqueci minha senha.</p>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" name="password" type="password" required autoComplete="new-password" />
            </div>
            <ErrorText>{state?.error}</ErrorText>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Salvando..." : "Salvar nova senha"}
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
