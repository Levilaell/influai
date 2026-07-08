import { requireUserId } from "@/lib/auth";
import { getBalance, getLedger } from "@influa/core/credits/ledger";
import { getUserPlan } from "@influa/core/billing/service";
import { PLANS } from "@influa/core/billing/plans";
import { Badge, Card } from "@/components/ui";
import { Plans } from "./plans";
import { ManageSubscription } from "@/components/manage-subscription";

const TYPE_LABEL: Record<string, { label: string; tone: "ok" | "muted" | "danger" | "accent" }> = {
  grant: { label: "Concessão", tone: "ok" },
  purchase: { label: "Compra", tone: "ok" },
  hold: { label: "Reserva", tone: "muted" },
  hold_release: { label: "Devolução", tone: "accent" },
  adjustment: { label: "Ajuste", tone: "muted" },
};

export default async function CreditsPage() {
  const userId = await requireUserId();
  const [balance, ledger, plan] = await Promise.all([
    getBalance(userId),
    getLedger(userId, 100),
    getUserPlan(userId),
  ]);

  const planViews = (["starter", "pro", "studio"] as const).map((id) => {
    const p = PLANS[id];
    // Simples de propósito (pedido do Levi): só os limites que diferenciam de verdade.
    const feats: string[] = [
      `${p.limits.personas === -1 ? "Personas ilimitadas" : `${p.limits.personas} persona(s)`}`,
      `${p.limits.brands === -1 ? "Marcas ilimitadas" : `${p.limits.brands} marca(s)`}`,
    ];
    return {
      id: p.id, name: p.name, priceBRL: p.priceBRL, approxVideos: p.approxVideos,
      monthlyCredits: p.monthlyCredits, features: feats,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Créditos e planos</h1>
        <p className="mt-1 text-muted">Assine um plano para receber créditos todo mês. Falhas devolvem automaticamente.</p>
      </div>

      <Card className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-[family-name:var(--font-display)] text-4xl font-semibold text-accent sm:text-5xl">
          {balance}
        </span>
        <span className="text-muted">créditos disponíveis · plano {plan.name}</span>
      </Card>

      {plan.id !== "free" && (
        <div className="-mt-4 flex justify-end">
          <ManageSubscription />
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-medium">Planos</h2>
        <Plans plans={planViews} currentPlan={plan.id} />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium">Extrato</h2>
        {ledger.length === 0 ? (
          <Card className="text-center text-muted">
            Nenhuma movimentação ainda. Créditos do beta são concedidos pela equipe.
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 text-right">Créditos</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry: any) => {
                  const t = TYPE_LABEL[entry.entry_type] ?? { label: entry.entry_type, tone: "muted" as const };
                  return (
                    <tr key={entry.id} className="border-t border-line">
                      <td className="px-4 py-3 text-muted">
                        {new Date(entry.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={t.tone}>{t.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted">{entry.note ?? "—"}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          entry.amount > 0 ? "text-accent" : "text-ink"
                        }`}
                      >
                        {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
