// Lista as vozes CURADAS do produto, com preview em PT-BR (fiel à produção — não o
// sample em inglês da ElevenLabs). Previews servidos estaticamente de /public.
import { CURATED_VOICES } from "@influa/core/config";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!(session?.user as any)?.id) return Response.json({ error: "unauthorized" }, { status: 401 });

  const voices = CURATED_VOICES.map((v) => ({
    id: v.id,
    name: v.name,
    preview: `/voice-previews/${v.id}.mp3`,
    labels: { gender: v.gender, tone: v.tone },
  }));
  return Response.json({ voices });
}
