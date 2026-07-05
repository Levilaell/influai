import Link from "next/link";
import { notFound } from "next/navigation";
import { getPool } from "@influa/core/db/client";
import { estimateCandidatesCredits, estimateCreationCredits, VOICES } from "@influa/core/config";
import { requireUserId } from "@/lib/auth";
import { PersonaWizard } from "./wizard";
import { VoiceEditor } from "./voice-editor";

export default async function PersonaPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const { rows } = await getPool().query(
    `select p.id, p.name, p.description, p.niche, p.voice_id, p.status, p.error,
            p.brand_id, b.name as brand_name
     from personas p join brands b on b.id = p.brand_id
     where p.id = $1 and p.user_id = $2`,
    [id, userId]
  );
  if (!rows[0]) notFound();
  const persona = rows[0];
  // voice_id pode ser um nome antigo ("matilda") ou já o id da ElevenLabs
  const resolvedVoiceId = VOICES[persona.voice_id as string] ?? persona.voice_id;
  const currentVoiceName =
    Object.entries(VOICES).find(([, id]) => id === resolvedVoiceId)?.[0] ?? null;

  return (
    <div className="space-y-6">
      <Link href={`/brands/${persona.brand_id}`} className="text-xs text-muted hover:text-accent">
        ← {persona.brand_name}
      </Link>
      <PersonaWizard
        persona={persona}
        estimates={{ creation: estimateCreationCredits(), candidates: estimateCandidatesCredits() }}
      />
      {persona.status === "ready" && (
        <VoiceEditor
          personaId={persona.id}
          currentVoiceId={resolvedVoiceId}
          currentVoiceName={currentVoiceName ? currentVoiceName[0].toUpperCase() + currentVoiceName.slice(1) : null}
        />
      )}
    </div>
  );
}
