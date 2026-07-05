import { Suspense } from "react";
import { RegisterForm } from "./form";

// useSearchParams (pré-preenche email/nicho) exige Suspense no Next 15.
export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Suspense fallback={<div className="text-sm text-muted">Carregando...</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
