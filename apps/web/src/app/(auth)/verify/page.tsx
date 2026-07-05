import Link from "next/link";
import { verifyEmailAction } from "@/actions/auth";
import { Card } from "@/components/ui";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const ok = token ? await verifyEmailAction(token) : false;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm text-center">
        <h1 className="mb-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
          {ok ? "E-mail confirmado" : "Link inválido"}
        </h1>
        <p className="mb-6 text-sm text-muted">
          {ok
            ? "Tudo certo — sua conta está verificada."
            : "Este link expirou ou já foi usado. Você pode reenviar a verificação dentro do app."}
        </p>
        <Link
          href="/brands"
          className="inline-block rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-ink"
        >
          Ir para o app
        </Link>
      </Card>
    </main>
  );
}
