// Planos — assinatura mensal concede créditos (unidade interna: 1 crédito ≈ $0.01
// de COGS) e libera capacidade. O preço embute a margem (~60-65% sobre o COGS).
// COGS de referência: vídeo 20s ≈ 112 créditos ($1.12); persona ≈ 60 créditos.
export type PlanId = "free" | "starter" | "pro" | "studio";

export type Plan = {
  id: PlanId;
  name: string;
  priceBRL: number; // mensal, em reais (informativo p/ UI; o valor real vem do Price do Stripe)
  monthlyCredits: number; // concedidos a cada ciclo pago
  approxVideos: number; // só para exibir "~N vídeos/mês"
  limits: { brands: number; personas: number; seats: number }; // -1 = ilimitado
  features: { scheduling: boolean; priorityQueue: boolean; brandAssets: boolean };
  // nome da env var com o Price ID recorrente do Stripe (ex: price_...)
  stripePriceEnv?: string;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free", name: "Grátis", priceBRL: 0, monthlyCredits: 0, approxVideos: 0,
    limits: { brands: 1, personas: 1, seats: 1 },
    features: { scheduling: false, priorityQueue: false, brandAssets: false },
  },
  starter: {
    // approxVideos calibrado pra vídeos de ~25s (~175 créditos cada)
    id: "starter", name: "Starter", priceBRL: 47, monthlyCredits: 600, approxVideos: 3,
    limits: { brands: 1, personas: 2, seats: 1 },
    features: { scheduling: true, priorityQueue: false, brandAssets: true },
    stripePriceEnv: "STRIPE_PRICE_STARTER",
  },
  pro: {
    id: "pro", name: "Pro", priceBRL: 97, monthlyCredits: 1500, approxVideos: 8,
    limits: { brands: 3, personas: 8, seats: 1 },
    features: { scheduling: true, priorityQueue: true, brandAssets: true },
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
  studio: {
    id: "studio", name: "Studio", priceBRL: 197, monthlyCredits: 3500, approxVideos: 20,
    limits: { brands: -1, personas: -1, seats: 5 },
    features: { scheduling: true, priorityQueue: true, brandAssets: true },
    stripePriceEnv: "STRIPE_PRICE_STUDIO",
  },
};

export function planById(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? "free"] ?? PLANS.free;
}

export function withinLimit(limit: number, current: number): boolean {
  return limit === -1 || current < limit;
}
