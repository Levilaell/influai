"use server";
import { getPool } from "@influa/core/db/client";
import { env } from "@influa/core/env";
import { PLANS, AVULSO, type PlanId } from "@influa/core/billing/plans";
import { getUserPlan, getUserSubscription } from "@influa/core/billing/service";
import {
  stripeCreateCustomer,
  stripeCreateSubscriptionCheckout,
  stripeCreateOneOffCheckout,
  stripeCreatePortalSession,
} from "@influa/core/billing/stripe";
import { track } from "@influa/core/analytics";
import { requireUserId } from "@/lib/auth";

export async function currentPlanInfo() {
  const userId = await requireUserId();
  const [plan, sub] = await Promise.all([getUserPlan(userId), getUserSubscription(userId)]);
  return { planId: plan.id, planName: plan.name, status: sub?.status ?? "none" };
}

/** Inicia o checkout de um plano no Stripe e devolve a URL de pagamento. */
export async function startCheckoutAction(planId: PlanId, returnPath?: string): Promise<{ url?: string; error?: string }> {
  const userId = await requireUserId();
  const plan = PLANS[planId];
  if (!plan || plan.id === "free" || !plan.stripePriceEnv) return { error: "Plano inválido" };

  const priceId = process.env[plan.stripePriceEnv];
  if (!priceId) return { error: "Cobrança ainda não configurada (Price do Stripe ausente)." };

  const pool = getPool();
  const { rows } = await pool.query("select email, display_name, stripe_customer_id from users where id = $1", [userId]);
  const u = rows[0];
  if (!u) return { error: "Usuário não encontrado" };

  await track("checkout_started", { userId, metadata: { plan: planId } });
  try {
    let customerId = u.stripe_customer_id;
    if (!customerId) {
      customerId = await stripeCreateCustomer({ email: u.email, name: u.display_name ?? undefined });
      await pool.query("update users set stripe_customer_id = $2 where id = $1", [userId, customerId]);
    }
    const base = env("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
    // Volta pra tela de onde o usuário assinou (ex.: o vídeo que ele tentava gerar), não /credits.
    const back = returnPath && returnPath.startsWith("/") ? returnPath.slice(0, 200) : "/credits";
    const sep = back.includes("?") ? "&" : "?";
    const url = await stripeCreateSubscriptionCheckout({
      priceId,
      customerId,
      userId,
      plan: plan.id,
      successUrl: `${base}${back}${sep}subscribed=1`,
      cancelUrl: `${base}${back}`,
    });
    return { url };
  } catch (err: any) {
    return { error: `Falha ao iniciar o checkout: ${String(err.message).slice(0, 160)}` };
  }
}

/** Vídeo avulso (pagamento único, aceita Pix): degrau de entrada antes da assinatura. */
export async function startAvulsoCheckoutAction(returnPath?: string): Promise<{ url?: string; error?: string }> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query("select email, display_name, stripe_customer_id from users where id = $1", [userId]);
  const u = rows[0];
  if (!u) return { error: "Usuário não encontrado" };

  await track("checkout_started", { userId, metadata: { plan: "avulso" } });
  try {
    let customerId = u.stripe_customer_id;
    if (!customerId) {
      customerId = await stripeCreateCustomer({ email: u.email, name: u.display_name ?? undefined });
      await pool.query("update users set stripe_customer_id = $2 where id = $1", [userId, customerId]);
    }
    const base = env("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
    const back = returnPath && returnPath.startsWith("/") ? returnPath.slice(0, 200) : "/credits";
    const sep = back.includes("?") ? "&" : "?";
    const url = await stripeCreateOneOffCheckout({
      customerId,
      userId,
      amountBRL: AVULSO.priceBRL,
      productName: "Influai — 1 vídeo avulso",
      credits: AVULSO.credits,
      successUrl: `${base}${back}${sep}subscribed=1`,
      cancelUrl: `${base}${back}`,
    });
    return { url };
  } catch (err: any) {
    return { error: `Falha ao iniciar o checkout: ${String(err.message).slice(0, 160)}` };
  }
}

/** Abre o portal do Stripe pra gerenciar a assinatura (cancelar, trocar plano, cartão, faturas). */
export async function openBillingPortalAction(): Promise<{ url?: string; error?: string }> {
  const userId = await requireUserId();
  const { rows } = await getPool().query("select stripe_customer_id from users where id = $1", [userId]);
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) return { error: "Você ainda não tem uma assinatura pra gerenciar." };
  try {
    const base = env("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
    const url = await stripeCreatePortalSession({ customerId, returnUrl: `${base}/credits` });
    return { url };
  } catch (err: any) {
    return { error: `Falha ao abrir o portal: ${String(err.message).slice(0, 160)}` };
  }
}
