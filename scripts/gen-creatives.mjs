// Gera 4 criativos de anúncio (Stories/Reels 1620x2880) em HTML/CSS -> PNG (playwright).
// Sem Atlas: usa os posters reais dos exemplos + tipografia da marca. Saída: uploads/.
import { chromium } from "playwright-core";
import fs from "node:fs";

const P = {};
for (const n of ["cafe", "animacao", "autoajuda", "tech", "reviews"]) {
  P[n] = "data:image/jpeg;base64," + fs.readFileSync(`apps/web/public/examples/${n}.jpg`).toString("base64");
}
const GRAIN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const SHELL = (inner) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600;0,9..144,700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d0d0f;--soft:#141417;--line:#2a2a30;--ink:#f2f1ec;--muted:#9b9a93;--accent:#d4ff3f;--aink:#131500}
html,body{width:1620px;height:2880px}
body{background:var(--bg);color:var(--ink);font-family:'Space Grotesk',sans-serif;position:relative;overflow:hidden}
.serif{font-family:'Fraunces',serif;font-weight:600}
.it{font-style:italic;color:var(--accent)}
.glow{position:absolute;top:0;left:0;right:0;height:1000px;background:radial-gradient(60% 100% at 50% 0%,rgba(212,255,63,.14),transparent 70%)}
.grain{position:absolute;inset:0;opacity:.05;background-image:url("${GRAIN}")}
.wm{font-family:'Fraunces',serif;font-weight:600;font-size:56px}
.wm b{color:var(--accent)}
.wrap{position:relative;z-index:2;height:100%;padding:120px 104px;display:flex;flex-direction:column}
.pill{display:inline-flex;align-items:center;justify-content:center;background:var(--accent);color:var(--aink);font-weight:700;border-radius:999px}
.phone{border:4px solid var(--line);border-radius:48px;overflow:hidden;background:var(--soft);box-shadow:0 60px 130px -30px rgba(0,0,0,.92);background-size:cover;background-position:center}
.chip{display:inline-block;background:rgba(212,255,63,.12);color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:.04em;border-radius:999px}
.sticker{position:absolute;background:var(--accent);color:var(--aink);font-weight:800;border-radius:16px}
</style></head><body><div class="glow"></div><div class="grain"></div><div class="wrap">${inner}</div></body></html>`;

const CREATIVES = {
  // ── PÚBLICO 01 — MARCA ──
  "1a-marca-cache": `
    <div class="wm">influai<b>.</b></div>
    <div style="margin-top:64px">
      <h1 class="serif" style="font-size:130px;line-height:1.02;letter-spacing:-.012em">Seu produto ganhou um <span class="it">garoto-propaganda</span> que posta <span class="it">todo dia</span>.</h1>
      <p style="font-size:48px;color:var(--muted);margin-top:46px">Nunca pede cachê. Nunca falta. Nunca some.</p>
    </div>
    <div style="position:relative;margin:64px auto 0;width:660px">
      <div class="phone" style="width:660px;height:1173px;background-image:url('${P.cafe}')"></div>
      <div class="sticker" style="top:-28px;right:-24px;transform:rotate(-8deg);font-size:36px;padding:16px 26px">100% IA</div>
    </div>
    <div class="pill" style="margin:auto auto 0;font-size:50px;padding:38px 72px">Criar o meu — grátis</div>`,

  "1b-marca-so-sua": `
    <div class="wm">influai<b>.</b></div>
    <h1 class="serif" style="font-size:124px;line-height:1.03;letter-spacing:-.012em;margin-top:60px">Um influenciador que <span class="it">só fala</span> da sua marca.</h1>
    <div style="display:flex;gap:20px;margin-top:44px">
      <span class="chip" style="font-size:38px;padding:16px 34px">cafeteria</span>
      <span class="chip" style="font-size:38px;padding:16px 34px">loja</span>
      <span class="chip" style="font-size:38px;padding:16px 34px">app</span>
    </div>
    <div style="display:flex;justify-content:center;align-items:center;gap:-40px;margin:90px 0 auto">
      <div class="phone" style="width:380px;height:675px;background-image:url('${P.reviews}');transform:rotate(-7deg);margin-right:-40px;z-index:1"></div>
      <div class="phone" style="width:420px;height:746px;background-image:url('${P.cafe}');z-index:3"></div>
      <div class="phone" style="width:380px;height:675px;background-image:url('${P.tech}');transform:rotate(7deg);margin-left:-40px;z-index:1"></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto">
      <p class="serif" style="font-size:52px">Posta sozinho,<br>todo dia.</p>
      <div class="pill" style="font-size:48px;padding:36px 64px">Começar grátis</div>
    </div>`,

  // ── PÚBLICO 02 — AUDIÊNCIA ──
  "2a-audiencia-do-zero": `
    <div class="wm">influai<b>.</b></div>
    <h1 class="serif" style="font-size:128px;line-height:1.03;letter-spacing:-.012em;margin-top:60px">Cresça um perfil <span class="it">do zero</span> — sem aparecer.</h1>
    <p style="font-size:46px;color:var(--muted);margin-top:40px">Dicas, listas, curiosidades. A máquina roteiriza e posta pra você, todo dia.</p>
    <div style="position:relative;margin:70px auto auto">
      <div class="phone" style="width:720px;height:1180px;padding:38px;background:var(--soft)">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;height:100%">
          ${["autoajuda", "tech", "reviews", "animacao", "cafe", "autoajuda"].map((n) => `<div style="border-radius:16px;background-image:url('${P[n]}');background-size:cover;background-position:center"></div>`).join("")}
        </div>
      </div>
      <div class="sticker" style="bottom:60px;right:-30px;transform:rotate(6deg);font-size:44px;padding:20px 30px">1.2k → 48k</div>
    </div>
    <div class="pill" style="margin:60px auto 0;font-size:50px;padding:38px 72px">Ver funcionando — grátis</div>`,

  "2b-audiencia-1-post": `
    <div class="wm">influai<b>.</b></div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:100px">
      <div style="display:flex;align-items:flex-start;gap:40px">
        <div class="serif it" style="font-size:360px;line-height:.72">1</div>
        <h1 class="serif" style="font-size:100px;line-height:1.03;margin-top:28px">post por dia.<br>No seu nicho.<br><span class="it">Sem você aparecer.</span></h1>
      </div>
      <div style="display:flex;gap:24px;justify-content:center">
        ${["tech", "autoajuda", "reviews", "animacao"].map((n, i) => `<div class="phone" style="width:342px;height:640px;background-image:url('${P[n]}');transform:rotate(${i % 2 ? 4 : -4}deg)"></div>`).join("")}
      </div>
      <p style="font-size:48px;color:var(--muted);text-align:center">Tema → roteiro → vídeo → postado. No piloto automático.</p>
    </div>
    <div class="pill" style="margin:0 auto;font-size:50px;padding:38px 72px">Criar o meu grátis</div>`,
};

const b = await chromium.launch({ channel: "chromium" });
fs.mkdirSync("uploads", { recursive: true });
for (const [id, inner] of Object.entries(CREATIVES)) {
  const page = await b.newPage({ viewport: { width: 1620, height: 2880 }, deviceScaleFactor: 1 });
  await page.setContent(SHELL(inner), { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `uploads/criativo-${id}.png` });
  await page.close();
  console.log("✔ criativo-" + id + ".png");
}
await b.close();
console.log("pronto");
