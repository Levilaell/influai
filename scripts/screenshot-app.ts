// Screenshots do app para verificação visual (dev).
// Uso: npx tsx scripts/screenshot-app.ts <cookie-jar.txt> <outdir> [path1 path2 ...]
// Requer chromium do Playwright em cache (~/.cache/ms-playwright).
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const [jarPath, outDir, ...pages] = process.argv.slice(2);
if (!jarPath || !outDir) {
  console.error("uso: tsx scripts/screenshot-app.ts <cookie-jar> <outdir> [paths...]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

// executável do chromium em cache
const cacheDir = path.join(os.homedir(), ".cache/ms-playwright");
const chromiumDir = fs.readdirSync(cacheDir).filter((d) => d.startsWith("chromium-")).sort().at(-1);
const executablePath = path.join(cacheDir, chromiumDir!, "chrome-linux64", "chrome");

// cookies do curl jar -> playwright
const cookies = fs
  .readFileSync(jarPath, "utf8")
  .split("\n")
  .filter((l) => l.includes("authjs"))
  .map((l) => {
    const f = l.split("\t");
    return {
      name: f[5],
      value: f[6],
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    };
  });

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies(cookies);

const targets = pages.length ? pages : ["login", "videos", "personas", "credits"];
for (const p of targets) {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3000/${p}`, { waitUntil: "networkidle", timeout: 30000 });
  const name = p.replace(/[\/?=]/g, "_") || "home";
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  console.log(`✓ ${p}`);
  await page.close();
}
await browser.close();
console.log("SCREENSHOTS_OK");
