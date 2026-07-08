"use client";
import { useTransition } from "react";
import { startCheckoutAction } from "@/actions/billing";
import { Button, Card } from "@/components/ui";
import { toast } from "@/components/toast";
import type { PlanId } from "@influa/core/billing/plans";

type PlanView = {
  id: PlanId;
  name: string;
  priceBRL: number;
  approxVideos: number;
  monthlyCredits: number;
  features: string[];
};

export function Plans({ plans, currentPlan, returnPath }: { plans: PlanView[]; currentPlan: string; returnPath?: string }) {
  const [pending, start] = useTransition();

  const subscribe = (id: PlanId) =>
    start(async () => {
      const r = await startCheckoutAction(id, returnPath);
      if (r.error) return toast(r.error, "error");
      if (r.url) window.location.href = r.url;
    });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.map((p) => {
        const current = currentPlan === p.id;
        return (
          <Card key={p.id} className={`space-y-4 ${current ? "border-accent" : ""}`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-display)] text-xl font-semibold">{p.name}</span>
                {current && <span className="text-xs text-accent">seu plano</span>}
              </div>
              <div className="mt-1">
                <span className="text-3xl font-semibold">R${p.priceBRL}</span>
                <span className="text-sm text-muted">/mês</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {p.monthlyCredits} créditos · ~{p.approxVideos} vídeos/mês
              </p>
            </div>
            <ul className="space-y-1.5 text-sm text-muted">
              {p.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <Button onClick={() => subscribe(p.id)} disabled={pending || current} className="w-full">
              {current ? "Plano atual" : "Assinar"}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
