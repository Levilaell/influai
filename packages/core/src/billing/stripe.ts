// Cliente Stripe (API REST, form-encoded). Assinatura via Checkout Session.
// Não usa o SDK — chamadas diretas com fetch. Verificação de webhook com HMAC.
import crypto from "node:crypto";
import { env } from "../env.ts";

const BASE = "https://api.stripe.com/v1";

function key() {
  return env("STRIPE_SECRET_KEY");
}

async function stripePost(path: string, form: Record<string, string>): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

export async function stripeCreateCustomer(opts: { email: string; name?: string }): Promise<string> {
  const json = await stripePost("/customers", { email: opts.email, ...(opts.name ? { name: opts.name } : {}) });
  return json.id as string;
}

/** Cria a sessão de checkout de assinatura e devolve a URL de pagamento. */
export async function stripeCreateSubscriptionCheckout(opts: {
  priceId: string;
  customerId: string;
  userId: string;
  plan: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const json = await stripePost("/checkout/sessions", {
    mode: "subscription",
    customer: opts.customerId,
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": "1",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "metadata[plan]": opts.plan,
    "metadata[userId]": opts.userId,
    // propaga o plano para a assinatura (usado nas renovações)
    "subscription_data[metadata][plan]": opts.plan,
    "subscription_data[metadata][userId]": opts.userId,
  });
  return json.url as string;
}

/** Checkout de pagamento ÚNICO (vídeo avulso). payment_method_types fica automático:
 *  o dashboard controla os métodos (habilitar Pix lá = aparece aqui, sem mudar código). */
export async function stripeCreateOneOffCheckout(opts: {
  customerId: string;
  userId: string;
  amountBRL: number;
  productName: string;
  credits: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const json = await stripePost("/checkout/sessions", {
    mode: "payment",
    customer: opts.customerId,
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": String(Math.round(opts.amountBRL * 100)),
    "line_items[0][price_data][product_data][name]": opts.productName,
    "line_items[0][quantity]": "1",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "metadata[kind]": "avulso",
    "metadata[userId]": opts.userId,
    "metadata[credits]": String(opts.credits),
  });
  return json.url as string;
}

/** Abre o Customer Portal do Stripe (cancelar, trocar plano, atualizar cartão, faturas). */
export async function stripeCreatePortalSession(opts: { customerId: string; returnUrl: string }): Promise<string> {
  const form: Record<string, string> = { customer: opts.customerId, return_url: opts.returnUrl };
  if (process.env.STRIPE_PORTAL_CONFIG) form.configuration = process.env.STRIPE_PORTAL_CONFIG;
  const json = await stripePost("/billing_portal/sessions", form);
  return json.url as string;
}

/** Verifica a assinatura do webhook (header Stripe-Signature: t=...,v1=...). */
export function verifyStripeWebhook(payload: string, sigHeader: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return process.env.SIMULATE_BILLING === "1";
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}
