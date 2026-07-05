// Regras de negócio da assinatura: ativa/renova o plano e concede os créditos do
// ciclo (idempotente). Chamado pelo webhook da AbacatePay.
import { getPool } from "../db/client.ts";
import { grantCreditsByRef } from "../credits/ledger.ts";
import { PLANS, planById, type PlanId } from "./plans.ts";

export async function getUserSubscription(userId: string) {
  const { rows } = await getPool().query("select * from subscriptions where user_id = $1", [userId]);
  return rows[0] ?? null;
}

export async function getUserPlan(userId: string) {
  const sub = await getUserSubscription(userId);
  const isActive = sub && (sub.status === "active" || sub.status === "trialing");
  return planById(isActive ? sub.plan : "free");
}

/** Sincroniza plano/status/período de um customer.subscription.updated do Stripe
 *  (upgrade/downgrade, cancelamento agendado, past_due). Não concede créditos —
 *  isso acontece no invoice.paid (fatura de proração/renovação). */
export async function syncSubscription(opts: {
  userId: string;
  plan: PlanId | null;
  status: string; // status cru do Stripe
  subscriptionId?: string;
  periodEnd?: string;
}) {
  const ourStatus = ["active", "trialing", "past_due"].includes(opts.status) ? opts.status : "canceled";
  await getPool().query(
    `insert into subscriptions (user_id, plan, status, abacate_subscription_id, current_period_end)
     values ($1, coalesce($2, 'free'), $3, $4, $5)
     on conflict (user_id) do update set
       plan = coalesce($2, subscriptions.plan),
       status = $3,
       abacate_subscription_id = coalesce($4, subscriptions.abacate_subscription_id),
       current_period_end = coalesce($5, subscriptions.current_period_end)`,
    [opts.userId, opts.plan, ourStatus, opts.subscriptionId ?? null, opts.periodEnd ?? null]
  );
}

/** Ativa/renova a assinatura e concede os créditos do ciclo (uma vez por ciclo). */
export async function activateSubscription(opts: {
  userId: string;
  plan: PlanId;
  subscriptionId?: string; // id da assinatura no provedor (Stripe)
  periodEnd?: string; // ISO
  cycleRef: string; // identificador único do ciclo (evento/período) p/ idempotência
}): Promise<{ granted: boolean }> {
  const plan = PLANS[opts.plan];
  if (!plan) throw new Error(`plano inválido: ${opts.plan}`);
  const pool = getPool();

  await pool.query(
    `insert into subscriptions (user_id, plan, status, abacate_subscription_id, current_period_end)
     values ($1, $2, 'active', $3, $4)
     on conflict (user_id) do update set
       plan = $2, status = 'active', abacate_subscription_id = coalesce($3, subscriptions.abacate_subscription_id),
       current_period_end = $4`,
    [opts.userId, opts.plan, opts.subscriptionId ?? null, opts.periodEnd ?? null]
  );

  const granted =
    plan.monthlyCredits > 0
      ? await grantCreditsByRef({
          userId: opts.userId,
          amount: plan.monthlyCredits,
          ref: `plan:${opts.cycleRef}`,
          note: `créditos do plano ${plan.name}`,
        })
      : false;
  return { granted };
}

export async function cancelSubscription(userId: string) {
  await getPool().query("update subscriptions set status = 'canceled' where user_id = $1", [userId]);
}
