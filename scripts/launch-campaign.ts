// Sobe a campanha de QUALIDADE PAUSADA no Meta:
//   CBO + objetivo LEADS (otimiza pro evento Lead do Pixel) + Stories/Reels só + 3 ângulos.
//   node --import tsx scripts/launch-campaign.ts
// NADA gasta: tudo entra como PAUSED. Você revisa e ativa no Gerenciador de Anúncios.
import { launchLeadCampaign, type Targeting, type Creative } from "../packages/core/src/marketing/meta-ads.ts";

// ── CONFIG (puxa do .env) ────────────────────────────────────────────
const AD_ACCOUNT = process.env.META_ACCOUNT_ID!; // act_827063593794052 (levilael.com.br)
const PAGE_ID = process.env.META_PAGE_ID!; // 1156147157589130 (Influai.)
const PIXEL_ID = process.env.META_PIXEL_ID!; // 1319760387031763 (Influai)
const INSTAGRAM_ACTOR_ID = process.env.META_IG_ID || undefined; // dealzy.com.br quando propagar
const DAILY_BUDGET_CENTS = 20000; // R$200/dia (CBO — distribui entre os 3 anúncios)
const LINK = "https://influai.com.br/?utm_source=meta&utm_medium=paid&utm_campaign=lancamento";
// ─────────────────────────────────────────────────────────────────────

// Só Stories + Reels, mobile.
const targeting: Targeting = {
  geo_locations: { countries: ["BR"] },
  age_min: 25,
  age_max: 45,
  publisher_platforms: ["facebook", "instagram"],
  facebook_positions: ["story", "facebook_reels"],
  instagram_positions: ["story", "reels"],
  device_platforms: ["mobile"],
};

// 5 criativos finais (pasta /creatives): 2 do público Marca + 3 Stories.
const creatives: Creative[] = [
  {
    label: "marca-cache",
    imagePath: "creatives/Influai Pub1a Cache 1620x2880.png",
    message: "Seu produto ganhou um garoto-propaganda de IA que posta todo dia. Nunca pede cachê, nunca falta, nunca some.",
    headline: "Um influenciador de IA pra sua marca",
    description: "Comece grátis.",
  },
  {
    label: "marca-so-sua",
    imagePath: "creatives/Influai Pub1b Marca 1620x2880.png",
    message: "Um influenciador de IA que só fala do seu negócio — cafeteria, loja, app. Posta sozinho, todo dia.",
    headline: "Seu influenciador, só da sua marca",
    description: "Ferramenta, não curso.",
  },
  {
    label: "negocio-local",
    imagePath: "creatives/Influai Stories 2a 1080x1920.png",
    message: "Sua marca com um influenciador que posta sozinho, todo dia. Sem aparecer, sem gravar, sem editor.",
    headline: "Crie seu influenciador de IA — grátis",
    description: "Ferramenta, não curso.",
  },
  {
    label: "ferramenta",
    imagePath: "creatives/Influai Stories 2c 1080x1920.png",
    message: "Seu marketing inteiro em um clique: tema, roteiro, vídeo 9:16 com voz e legenda, e o post agendado.",
    headline: "Ferramenta, não curso",
    description: "Veja funcionando — grátis.",
  },
  {
    label: "faceless",
    imagePath: "creatives/Influai Stories 3a v2 1080x1920.png",
    message: "Crie um influenciador de IA e poste todo dia — sem nunca mostrar seu rosto.",
    headline: "Seu influenciador de IA, sem aparecer",
    description: "Comece grátis.",
  },
];

async function main() {
  for (const k of ["META_ACCOUNT_ID", "META_PAGE_ID", "META_PIXEL_ID"]) {
    if (!process.env[k]) throw new Error(`${k} ausente no .env`);
  }
  const r = await launchLeadCampaign({
    adAccountId: AD_ACCOUNT,
    pageId: PAGE_ID,
    instagramActorId: INSTAGRAM_ACTOR_ID,
    pixelId: PIXEL_ID,
    campaignName: "Influai — Lançamento (LEADS)",
    dailyBudgetCents: DAILY_BUDGET_CENTS,
    targeting,
    creatives,
    link: LINK,
    cta: "SIGN_UP",
  });
  console.log("Campanha PAUSADA criada. Revise no Gerenciador antes de ativar:");
  console.log(JSON.stringify(r, null, 2));
  console.log(`\nAds Manager: https://business.facebook.com/adsmanager/manage/campaigns?act=${AD_ACCOUNT.replace("act_", "")}`);
}
main().then(() => process.exit(0));
