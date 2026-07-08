"use client";
import { useTransition } from "react";
import { Plans } from "@/app/(app)/credits/plans";
import { startAvulsoCheckoutAction } from "@/actions/billing";
import { toast } from "@/components/toast";
import { AVULSO, type PlanId } from "@influa/core/billing/plans";

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
// Degrau de entrada: 1 vídeo avulso (pagamento único — aceita Pix, diferente da assinatura).
export function PaywallModal({
  open,
  onClose,
  plans,
  currentPlan,
  returnPath,
}: {
  open: boolean;
  onClose: () => void;
  plans: PlanView[];
  currentPlan: string;
  returnPath?: string;
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
        <Plans plans={plans} currentPlan={currentPlan} returnPath={returnPath} />
        <AvulsoOption returnPath={returnPath} />
        <button onClick={onClose} className="mt-5 block w-full text-center text-sm text-muted hover:text-ink">
          Agora não
        </button>
      </div>
    </div>
  );
}

function AvulsoOption({ returnPath }: { returnPath?: string }) {
  const [pending, start] = useTransition();
  const buy = () =>
    start(async () => {
      const r = await startAvulsoCheckoutAction(returnPath);
      if (r.error) return toast(r.error, "error");
      if (r.url) window.location.href = r.url;
    });
  return (
    <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl border border-line bg-bg-soft px-5 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
      <div>
        <p className="text-sm font-medium">Ainda não quer assinar?</p>
        <p className="text-xs text-muted">Gere só este vídeo — pagamento único, no Pix ou cartão.</p>
      </div>
      <button
        onClick={buy}
        disabled={pending}
        className="shrink-0 rounded-full border border-accent/60 px-6 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-60"
      >
        {pending ? "Abrindo..." : `1 vídeo por R$${AVULSO.priceBRL}`}
      </button>
    </div>
  );
}
