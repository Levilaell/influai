// Grava as telas do app pro walkthrough (recordVideo do Playwright). Dirige o fluxo real
// numa conta nova, com pausas deliberadas em cada tela pro editor sincronizar com a locução.
// Saída: marketing/walkthrough/*.webm (o editor converte/corta). Roda quando o Atlas estiver livre.
import { chromium } from "playwright-core";
import fs from "node:fs";

const email = `walk-${Date.now().toString(36)}@influai.com.br`;
const OUT = "marketing/walkthrough";
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ channel: "chromium" });
const ctx = await b.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
});
const p = await ctx.newPage();
const pause = (ms) => p.waitForTimeout(ms);
const step = async (name, fn) => { try { console.log("▶ " + name); await fn(); } catch (e) { console.log("  ! " + name + ": " + e.message.slice(0, 120)); } };

await step("1. cadastro", async () => {
  await p.goto(`https://influai.com.br/register?niche=${encodeURIComponent("cafeteria artesanal")}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await pause(2500);
  await p.fill('input[name="niche"]', "");
  await p.type('input[name="niche"]', "cafeteria artesanal", { delay: 70 });
  await pause(1200);
  await p.type('input[name="displayName"]', "Ana", { delay: 45 });
  await p.fill('input[name="email"]', email);
  await p.type('input[name="password"]', "Walkthrough2026", { delay: 25 });
  await p.check('input[name="terms"]');
  await pause(1500);
  await Promise.all([
    p.waitForURL((u) => u.pathname.includes("/personas/"), { timeout: 30000 }).catch(() => {}),
    p.click('button:has-text("Criar conta grátis")'),
  ]);
  await pause(3000);
});

await step("2. rostos gerando", async () => {
  // espera aparecerem os 4 candidatos (imagens clicáveis), até 6min
  for (let i = 0; i < 90; i++) {
    const tiles = await p.locator('img[alt*="candidat"], button:has(img), [role="button"]:has(img)').count().catch(() => 0);
    const body = await p.locator("body").innerText().catch(() => "");
    if (/escolher o rosto|Usar este rosto|candidates_ready/i.test(body) && tiles >= 3) break;
    await pause(4000);
  }
  await pause(2500);
});

await step("3. escolher rosto", async () => {
  // seleciona o 1º candidato clicável e confirma
  const cand = p.locator('button:has(img), [role="button"]:has(img)').first();
  await cand.click({ timeout: 8000 }).catch(() => {});
  await pause(1500);
  await p.click('button:has-text("Usar este rosto")', { timeout: 8000 }).catch(() => {});
  await pause(3000);
});

await step("4. cérebro (texto)", async () => {
  await p.getByText(/conte sobre seu neg[oó]cio/i).scrollIntoViewIfNeeded().catch(() => {});
  await pause(1200);
  await p.click('button:has-text("texto"), button:has-text("Texto"), button:has-text("Colar texto")', { timeout: 6000 }).catch(() => {});
  await pause(800);
  const ta = p.locator("textarea").last();
  await ta.click().catch(() => {});
  await ta.type("Cafeteria artesanal no centro, cafés especiais e doces caseiros, ambiente aconchegante, público jovem que valoriza qualidade.", { delay: 12 }).catch(() => {});
  await pause(1200);
  await p.click('button:has-text("Analisar")', { timeout: 6000 }).catch(() => {});
  await pause(5000);
});

await step("5. aba Vídeos", async () => {
  // vai pra marca e abre a aba Vídeos
  const brandLink = p.locator('a[href*="/brands/"]').first();
  await brandLink.click({ timeout: 8000 }).catch(async () => { await p.goto("https://influai.com.br/brands", { waitUntil: "domcontentloaded" }); await p.locator('a[href*="/brands/"]').first().click().catch(() => {}); });
  await pause(2000);
  await p.click('button:has-text("Vídeos"), [role="tab"]:has-text("Vídeos"), a:has-text("Vídeos")', { timeout: 6000 }).catch(() => {});
  await pause(1500);
  await p.click('a:has-text("Novo vídeo"), a:has-text("+ Novo")', { timeout: 6000 }).catch(() => {});
  await pause(2500);
});

await step("6. tema + ideias + roteiro", async () => {
  await p.click('button:has-text("Me dê ideias"), button:has-text("ideias")', { timeout: 6000 }).catch(() => {});
  await pause(6000);
  // escolhe a 1ª ideia se houver cards clicáveis
  await p.locator('button:has-text("Usar"), [role="button"]').first().click({ timeout: 5000 }).catch(() => {});
  await pause(1500);
  await p.click('button:has-text("Gerar roteiro"), button:has-text("roteiro")', { timeout: 6000 }).catch(() => {});
  await p.waitForURL((u) => /\/videos\//.test(u.pathname), { timeout: 40000 }).catch(() => {});
  await pause(4000);
});

await step("7. roteiro (revisar)", async () => {
  await pause(2500);
  const line = p.locator("textarea").first();
  await line.click().catch(() => {});
  await pause(1500);
});

await step("8. gerar -> paywall", async () => {
  await p.click('button:has-text("Gerar vídeo")', { timeout: 8000 }).catch(() => {});
  await pause(4000); // segura no modal de assinatura
});

console.log("EMAIL:" + email);
await ctx.close(); // salva o vídeo
await b.close();
console.log("✔ gravação salva em " + OUT);
