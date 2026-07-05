// Integração Meta Marketing API — sobe a campanha de QUALIDADE, tudo PAUSED:
//  • Campanha CBO (orçamento na campanha) com objetivo OUTCOME_LEADS
//  • 1 conjunto otimizando pra CONVERSÃO (evento Lead no Pixel), Stories + Reels só
//  • N anúncios (um por criativo/ângulo) pro Meta achar o vencedor
// NADA gasta até você ativar no Gerenciador de Anúncios.
import fs from "node:fs";
import "../env.ts";

const G = "https://graph.facebook.com/v21.0";
function token(): string {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error("META_ACCESS_TOKEN ausente no .env");
  return t;
}

async function metaPost(path: string, params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams({ ...params, access_token: token() });
  const res = await fetch(`${G}/${path}`, { method: "POST", body });
  const j = await res.json();
  if (j.error) throw new Error(`Meta ${path}: ${j.error.message} (code ${j.error.code})`);
  return j;
}

/** Sobe a imagem a partir de um ARQUIVO local (base64) — sem precisar hospedar. */
export async function uploadAdImageFile(adAccountId: string, filePath: string): Promise<string> {
  const bytes = fs.readFileSync(filePath).toString("base64");
  const j = await metaPost(`${adAccountId}/adimages`, { bytes });
  const first: any = Object.values(j.images ?? {})[0];
  if (!first?.hash) throw new Error(`adimages(bytes) sem hash: ${JSON.stringify(j).slice(0, 200)}`);
  return first.hash;
}

/** Campanha CBO (orçamento na campanha) + objetivo de conversão. PAUSED. */
export async function createCampaign(
  adAccountId: string,
  opts: { name: string; objective?: string; dailyBudgetCents: number }
): Promise<string> {
  const j = await metaPost(`${adAccountId}/campaigns`, {
    name: opts.name,
    objective: opts.objective ?? "OUTCOME_LEADS",
    status: "PAUSED",
    special_ad_categories: "[]",
    daily_budget: String(opts.dailyBudgetCents), // CBO: orçamento no nível da campanha
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  });
  return j.id;
}

export type Targeting = {
  geo_locations: { countries: string[] };
  age_min?: number;
  age_max?: number;
  publisher_platforms?: string[]; // ["facebook","instagram"]
  facebook_positions?: string[]; // ["story","facebook_reels"]
  instagram_positions?: string[]; // ["story","reels"]
  device_platforms?: string[]; // ["mobile"]
  flexible_spec?: Array<{ interests?: Array<{ id: string; name?: string }> }>;
};

/** Conjunto (PAUSED) otimizando pra CONVERSÃO (evento do Pixel). Sem orçamento (CBO na campanha). */
export async function createAdSet(
  adAccountId: string,
  opts: { name: string; campaignId: string; pixelId: string; conversionEvent?: string; targeting: Targeting }
): Promise<string> {
  const j = await metaPost(`${adAccountId}/adsets`, {
    name: opts.name,
    campaign_id: opts.campaignId,
    billing_event: "IMPRESSIONS",
    optimization_goal: "OFFSITE_CONVERSIONS",
    promoted_object: JSON.stringify({ pixel_id: opts.pixelId, custom_event_type: opts.conversionEvent ?? "LEAD" }),
    // advantage_audience: 0 = respeita nosso público definido (não expande sozinho). Meta exige o flag.
    targeting: JSON.stringify({ ...opts.targeting, targeting_automation: { advantage_audience: 0 } }),
    status: "PAUSED",
  });
  return j.id;
}

/** Criativo do anúncio: imagem + copy, associado a uma Página (e IG). */
export async function createAdCreative(
  adAccountId: string,
  opts: { name: string; pageId: string; instagramActorId?: string; imageHash: string; message: string; headline: string; description?: string; link: string; cta?: string }
): Promise<string> {
  const object_story_spec: any = {
    page_id: opts.pageId,
    ...(opts.instagramActorId ? { instagram_actor_id: opts.instagramActorId } : {}),
    link_data: {
      image_hash: opts.imageHash,
      message: opts.message,
      name: opts.headline,
      description: opts.description,
      link: opts.link,
      call_to_action: { type: opts.cta ?? "SIGN_UP", value: { link: opts.link } },
    },
  };
  const j = await metaPost(`${adAccountId}/adcreatives`, {
    name: opts.name,
    object_story_spec: JSON.stringify(object_story_spec),
  });
  return j.id;
}

/** Anúncio (PAUSED) = conjunto + criativo. */
export async function createAd(adAccountId: string, opts: { name: string; adsetId: string; creativeId: string }): Promise<string> {
  const j = await metaPost(`${adAccountId}/ads`, {
    name: opts.name,
    adset_id: opts.adsetId,
    creative: JSON.stringify({ creative_id: opts.creativeId }),
    status: "PAUSED",
  });
  return j.id;
}

export type Creative = { label: string; imagePath: string; message: string; headline: string; description?: string };

/** Sobe a campanha de qualidade PAUSADA: CBO + LEADS + N anúncios (um por ângulo). */
export async function launchLeadCampaign(cfg: {
  adAccountId: string;
  pageId: string;
  instagramActorId?: string;
  pixelId: string;
  campaignName: string;
  dailyBudgetCents: number;
  targeting: Targeting;
  creatives: Creative[];
  link: string; // base; cada anúncio ganha utm_content=label
  cta?: string;
}): Promise<{ campaignId: string; adsetId: string; ads: Array<{ label: string; adId: string }> }> {
  const campaignId = await createCampaign(cfg.adAccountId, {
    name: cfg.campaignName,
    objective: "OUTCOME_LEADS",
    dailyBudgetCents: cfg.dailyBudgetCents,
  });
  const adsetId = await createAdSet(cfg.adAccountId, {
    name: `${cfg.campaignName} — conjunto (Stories+Reels)`,
    campaignId,
    pixelId: cfg.pixelId,
    targeting: cfg.targeting,
  });
  const ads: Array<{ label: string; adId: string }> = [];
  for (const c of cfg.creatives) {
    const imageHash = await uploadAdImageFile(cfg.adAccountId, c.imagePath);
    const sep = cfg.link.includes("?") ? "&" : "?";
    const link = `${cfg.link}${sep}utm_content=${encodeURIComponent(c.label)}`;
    const creativeId = await createAdCreative(cfg.adAccountId, {
      name: `${cfg.campaignName} — criativo ${c.label}`,
      pageId: cfg.pageId,
      instagramActorId: cfg.instagramActorId,
      imageHash,
      message: c.message,
      headline: c.headline,
      description: c.description,
      link,
      cta: cfg.cta,
    });
    const adId = await createAd(cfg.adAccountId, { name: `${cfg.campaignName} — ${c.label}`, adsetId, creativeId });
    ads.push({ label: c.label, adId });
  }
  return { campaignId, adsetId, ads };
}
