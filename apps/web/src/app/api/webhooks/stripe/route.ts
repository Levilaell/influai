// Webhook do Stripe — concede créditos e ativa/cancela o plano.
// Eventos: invoice.paid (1ª cobrança + renovações) e customer.subscription.deleted.
// Assinatura verificada por HMAC (STRIPE_WEBHOOK_SECRET). Dev: SIMULATE_BILLING=1.
import { getPool } from "@influa/core/db/client";
import { verifyStripeWebhook } from "@influa/core/billing/stripe";
import { activateSubscription, cancelSubscription, syncSubscription } from "@influa/core/billing/service";
import { PLANS, type PlanId } from "@influa/core/billing/plans";

// price_... -> planId, a partir das env vars dos planos
function planForPrice(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceEnv && process.env[plan.stripePriceEnv] === priceId) return plan.id;
  }
  return null;
}

async function userForCustomer(pool: any, customerId: string | undefined): Promise<string | null> {
  if (!customerId) return null;
  const { rows } = await pool.query("select id from users where stripe_customer_id = $1", [customerId]);
  return rows[0]?.id ?? null;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!verifyStripeWebhook(raw, sig)) return Response.json({ error: "assinatura inválida" }, { status: 401 });

  let ev: any;
  try {
    ev = JSON.parse(raw);
  } catch {
    return Response.json({ error: "payload inválido" }, { status: 400 });
  }

  const pool = getPool();
  const obj = ev?.data?.object ?? {};

  try {
    if (ev.type === "invoice.paid" || ev.type === "invoice.payment_succeeded") {
      const line = obj.lines?.data?.[0];
      const priceId = line?.price?.id ?? line?.plan?.id;
      const plan =
        planForPrice(priceId) ??
        (obj.subscription_details?.metadata?.plan as PlanId | undefined) ??
        null;
      const userId =
        (await userForCustomer(pool, obj.customer)) ?? (obj.subscription_details?.metadata?.userId ?? null);
      if (!plan || !userId) return Response.json({ ok: true, note: "sem plano/usuário" });

      const periodEnd = line?.period?.end ? new Date(line.period.end * 1000).toISOString() : undefined;
      const { granted } = await activateSubscription({
        userId, plan,
        subscriptionId: obj.subscription,
        periodEnd,
        cycleRef: obj.id, // invoice id — único por ciclo (idempotência da concessão)
      });
      return Response.json({ ok: true, granted });
    }

    if (ev.type === "customer.subscription.deleted") {
      const userId = await userForCustomer(pool, obj.customer);
      if (userId) await cancelSubscription(userId);
      return Response.json({ ok: true });
    }

    // Mudança de plano (upgrade/downgrade), cancelamento agendado, past_due.
    if (ev.type === "customer.subscription.updated") {
      const userId = await userForCustomer(pool, obj.customer);
      if (userId) {
        const priceId = obj.items?.data?.[0]?.price?.id;
        const plan = planForPrice(priceId) ?? (obj.metadata?.plan as PlanId | undefined) ?? null;
        const periodEnd = obj.current_period_end
          ? new Date(obj.current_period_end * 1000).toISOString()
          : undefined;
        await syncSubscription({ userId, plan, status: obj.status, subscriptionId: obj.id, periodEnd });
      }
      return Response.json({ ok: true });
    }

    // Falha de cobrança — o Stripe re-tenta e transita p/ past_due via subscription.updated.
    if (ev.type === "invoice.payment_failed") {
      const userId = await userForCustomer(pool, obj.customer);
      return Response.json({ ok: true, note: userId ? "payment_failed" : "sem usuário" });
    }

    return Response.json({ ok: true, ignored: ev.type });
  } catch (err: any) {
    return Response.json({ error: String(err.message).slice(0, 200) }, { status: 500 });
  }
}
