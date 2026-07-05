// Cria os Prices dos planos + a configuração do Customer Portal no Stripe.
// Usa TEST ou LIVE conforme a STRIPE_SECRET_KEY passada. Rode UMA vez e cole os IDs no .env + Vercel.
//   STRIPE_SECRET_KEY=sk_test_... node --import tsx scripts/stripe-setup.ts
const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("Faltou STRIPE_SECRET_KEY (ex.: STRIPE_SECRET_KEY=sk_test_... node --import tsx scripts/stripe-setup.ts)");
  process.exit(1);
}
const BASE = "https://api.stripe.com/v1";

async function sp(path: string, form: Record<string, string>): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${path}: ${j.error.message}`);
  return j;
}

const PLANS = [
  { key: "STARTER", name: "Influai Starter", reais: 127 },
  { key: "PRO", name: "Influai Pro", reais: 397 },
  { key: "STUDIO", name: "Influai Studio", reais: 997 },
];

const out: string[] = [];
const created: { productId: string; priceId: string }[] = [];
for (const p of PLANS) {
  const price = await sp("/prices", {
    unit_amount: String(p.reais * 100),
    currency: "brl",
    "recurring[interval]": "month",
    "product_data[name]": p.name,
  });
  created.push({ productId: price.product, priceId: price.id });
  out.push(`STRIPE_PRICE_${p.key}=${price.id}`);
  console.log(`✓ ${p.name}: ${price.id}`);
}

// Customer Portal: cancelar + trocar de plano (proração) + cartão + faturas.
const cfgForm: Record<string, string> = {
  "business_profile[headline]": "Gerencie sua assinatura Influai",
  "features[invoice_history][enabled]": "true",
  "features[payment_method_update][enabled]": "true",
  "features[customer_update][enabled]": "true",
  "features[customer_update][allowed_updates][0]": "email",
  "features[subscription_cancel][enabled]": "true",
  "features[subscription_update][enabled]": "true",
  "features[subscription_update][default_allowed_updates][0]": "price",
  "features[subscription_update][proration_behavior]": "create_prorations",
};
created.forEach((c, i) => {
  cfgForm[`features[subscription_update][products][${i}][product]`] = c.productId;
  cfgForm[`features[subscription_update][products][${i}][prices][0]`] = c.priceId;
});
const cfg = await sp("/billing_portal/configurations", cfgForm);
out.push(`STRIPE_PORTAL_CONFIG=${cfg.id}`);
console.log(`✓ Portal config: ${cfg.id}`);

console.log("\n════ Cole no .env + Vercel (e Railway se precisar) ════");
console.log(out.join("\n"));
console.log("\nFalta ainda: STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET (do endpoint do webhook).");
process.exit(0);
