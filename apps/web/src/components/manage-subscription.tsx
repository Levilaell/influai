"use client";
// Abre o Customer Portal do Stripe (cancelar, trocar de plano, atualizar cartão, faturas).
import { useTransition } from "react";
import { openBillingPortalAction } from "@/actions/billing";
import { toast } from "@/components/toast";

export function ManageSubscription() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await openBillingPortalAction();
          if (r.error) return toast(r.error, "error");
          if (r.url) window.location.href = r.url;
        })
      }
      className="rounded-full border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-ink disabled:opacity-50"
    >
      {pending ? "Abrindo..." : "Gerenciar assinatura"}
    </button>
  );
}
