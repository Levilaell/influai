"use client";
import { Plans } from "@/app/(app)/credits/plans";
import type { PlanId } from "@influa/core/billing/plans";

type PlanView = {
  id: PlanId;
  name: string;
  priceBRL: number;
  approxVideos: number;
  monthlyCredits: number;
  features: string[];
};

// Modal de assinatura no "Gerar vídeo" — o momento da conversão. O usuário já montou a
// persona e o roteiro; agora assina pra gerar. Mostra os planos direto (sem redirect).
export function PaywallModal({
  open,
  onClose,
  plans,
  currentPlan,
}: {
  open: boolean;
  onClose: () => void;
  plans: PlanView[];
  currentPlan: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-bg p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="float-right text-xl leading-none text-muted hover:text-ink" aria-label="Fechar">
          ✕
        </button>
        <div className="mb-6 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold md:text-3xl">
            Seu vídeo está pronto pra ser gerado 🎬
          </p>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            Assine um plano pra gerar seu vídeo e criar quantos quiser — no piloto automático. Cancele quando quiser.
          </p>
        </div>
        <Plans plans={plans} currentPlan={currentPlan} />
        <button onClick={onClose} className="mt-5 block w-full text-center text-sm text-muted hover:text-ink">
          Agora não
        </button>
      </div>
    </div>
  );
}
