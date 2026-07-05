// Screenshots das telas do Cérebro da Marca (persona) e dos cards de ideias (fábrica).
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const [jarPath, outDir, personaId] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const cacheDir = path.join(os.homedir(), ".cache/ms-playwright");
const cd = fs.readdirSync(cacheDir).filter((d) => d.startsWith("chromium-")).sort().at(-1);
const executablePath = path.join(cacheDir, cd!, "chrome-linux64", "chrome");

const cookies = fs.readFileSync(jarPath, "utf8").split("\n").filter((l) => l.includes("authjs")).map((l) => {
  const f = l.split("\t");
  return { name: f[5], value: f[6], domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" as const };
});

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
await ctx.addCookies(cookies);

// 1. Persona com Cérebro da Marca preenchido
const p1 = await ctx.newPage();
await p1.goto(`http://localhost:3000/personas/${personaId}`, { waitUntil: "networkidle" });
await p1.waitForTimeout(800);
await p1.screenshot({ path: path.join(outDir, "persona-brand.png"), fullPage: true });
console.log("✓ persona-brand");

// 2. Nova fábrica → clica "Me dê ideias" → espera os cards
const p2 = await ctx.newPage();
await p2.goto("http://localhost:3000/videos/new", { waitUntil: "networkidle" });
await p2.waitForTimeout(500);
const btn = p2.getByText("Me dê ideias");
await btn.click();
// espera aparecer pelo menos um card de ideia (formato em pill)
await p2.waitForSelector("text=mito x verdade", { timeout: 60000 }).catch(() => {});
await p2.waitForTimeout(1000);
await p2.screenshot({ path: path.join(outDir, "video-ideas.png"), fullPage: true });
console.log("✓ video-ideas");

await browser.close();
console.log("SHOTS_OK");
process.exit(0);
