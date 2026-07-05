// Gera as 9 imagens dos placeholders dos criativos (Claude Design) via Atlas genImage (9:16, 1k).
// Saída: uploads/<nome>.jpg. Com retry (Atlas tem rate limit apertado).
import fs from "node:fs";
import { genImage, downloadToBuffer } from "@influa/core/providers/index";

const NEG = "No watermark, no logo, no ugly distorted text, natural realistic hands.";
const UGC = "Shot like an authentic vertical phone selfie-video, cinematic soft lighting, high detail, photorealistic, shallow depth of field.";

const IMAGES = [
  { name: "pub1a-video", prompt: `Young Brazilian male content creator, around 30, short dark curly hair, light beard, warm genuine smile, wearing a casual apron, standing behind the counter inside a cozy specialty coffee shop. He points toward the camera with one hand and holds a plain unbranded kraft-paper coffee bag in the other. Medium shot. ${UGC} No text on screen. ${NEG}` },
  { name: "pub1b-v1", prompt: `Brazilian male content creator, friendly, holding a coffee cup and a plain kraft coffee bag toward the camera, inside a modern warm café with an espresso machine behind him, promoting the product. Medium shot. ${UGC} No text on screen. ${NEG}` },
  { name: "pub1b-v2", prompt: `Brazilian female content creator, stylish, smiling, showing off a nice folded blouse / garment toward the camera, inside a bright modern boutique clothing store with clothing racks behind her. Medium shot. ${UGC} No text on screen. ${NEG}` },
  { name: "pub1b-v3", prompt: `Brazilian content creator holding up a smartphone toward the camera, showing a colorful generic mobile app interface on the screen (abstract UI, no readable words), casual bright home setting, pointing at the phone with an excited expression. Medium shot. ${UGC} ${NEG}` },
  { name: "pub2a-feed", prompt: `A dark-mode vertical social media profile feed mockup on a phone, a clean 3-column grid of six vertical short-video thumbnails of niche content (finance, cooking, fitness, curiosities, study, motivation), each thumbnail has a bold catchy caption bar, moody dark UI, high contrast, modern TikTok/Reels aesthetic. No prominent human face. Sleek app interface, sharp, professional.` },
  { name: "pub2b-n1", prompt: `Vertical Reels video frame, FINANCE niche: close-up of hands using a calculator next to a laptop showing a rising green financial chart, warm organized desk. Big bold Reels-style karaoke caption near the bottom, short Portuguese phrase with one word highlighted in bright lime-green. High contrast, cinematic. ${NEG}` },
  { name: "pub2b-n2", prompt: `Vertical Reels video frame, RECIPES niche: appetizing top-down of hands plating a delicious homemade dish in a warm rustic kitchen, steam rising. Big bold Reels-style karaoke caption near the bottom, short Portuguese phrase with one word highlighted in a bright color. Mouth-watering food photography, cinematic. ${NEG}` },
  { name: "pub2b-n3", prompt: `Vertical Reels video frame, FITNESS niche: an athletic person mid-workout in a modern gym, dynamic energetic pose, dramatic lighting, sweat. Big bold Reels-style karaoke caption near the bottom, short Portuguese phrase with one word highlighted in a bright color. High contrast, cinematic. ${NEG}` },
  { name: "pub2b-n4", prompt: `Vertical Reels video frame, CURIOSITIES niche: a stunning awe-inspiring colorful galaxy nebula in deep space, vivid cosmic colors. Big bold Reels-style karaoke caption near the bottom, short Portuguese phrase with one word highlighted in a bright color. Breathtaking, cinematic. ${NEG}` },
];

async function one(item: (typeof IMAGES)[number]): Promise<string | null> {
  if (fs.existsSync(`uploads/${item.name}.jpg`)) {
    console.log(`= ${item.name}.jpg já existe, pulando`);
    return item.name;
  }
  for (let a = 1; a <= 4; a++) {
    try {
      const url = await genImage({ prompt: item.prompt });
      const buf = await downloadToBuffer(url);
      fs.writeFileSync(`uploads/${item.name}.jpg`, buf);
      console.log(`✔ ${item.name}.jpg (${Math.round(buf.length / 1024)}kb)`);
      return item.name;
    } catch (e: any) {
      const msg = String(e?.message).slice(0, 90);
      if (a < 4) {
        console.log(`↻ ${item.name}: tentativa ${a + 1}/4 (${msg})`);
        await new Promise((r) => setTimeout(r, 20000 * a));
      } else {
        console.error(`x ${item.name} FALHOU: ${msg}`);
      }
    }
  }
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

fs.mkdirSync("uploads", { recursive: true });
const res = (await mapLimit(IMAGES, 2, one)).filter(Boolean);
console.log(`\n${res.length}/${IMAGES.length} imagens geradas em uploads/`);
process.exit(0);
