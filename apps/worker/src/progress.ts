// Progresso: o worker escreve no Postgres; o front lê via polling.
import { getPool } from "@influa/core/db/client";

export async function setVideoStatus(videoId: string, status: string) {
  await getPool().query("update videos set status = $2 where id = $1", [videoId, status]);
}

export async function setVideoProgress(
  videoId: string,
  progress: { step: string; pct: number; message: string }
) {
  await getPool().query(
    "update videos set progress = $2 where id = $1",
    [videoId, JSON.stringify({ ...progress, at: new Date().toISOString() })]
  );
}

export async function setVideoFailed(videoId: string, error: string) {
  await getPool().query(
    `update videos set status = 'failed', error = $2
     where id = $1 and status not in ('ready','canceled')`,
    [videoId, error.slice(0, 500)]
  );
}

export async function setPersonaStatus(personaId: string, status: string, error?: string) {
  await getPool().query(
    "update personas set status = $2, error = $3 where id = $1",
    [personaId, status, error?.slice(0, 500) ?? null]
  );
}
