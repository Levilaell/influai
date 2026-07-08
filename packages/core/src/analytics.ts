import { getPool } from "./db/client.ts";

/** Registra um evento de funil/uso. NUNCA quebra o fluxo (best-effort).
 *  userId null = evento anônimo (ex.: prévia da LP antes do cadastro). */
export async function track(
  event: string,
  opts: { userId?: string | null; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    await getPool().query("insert into events (user_id, event, metadata) values ($1, $2, $3)", [
      opts.userId ?? null,
      event,
      JSON.stringify(opts.metadata ?? {}),
    ]);
  } catch {
    /* tracking silencioso — não afeta o usuário */
  }
}
