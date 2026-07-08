import { Suspense } from "react";
import { LoginForm } from "./form";

// useSearchParams (callbackUrl) exige Suspense no Next 15 — mesmo padrão do /register.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Suspense fallback={<div className="text-sm text-muted">Carregando...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
