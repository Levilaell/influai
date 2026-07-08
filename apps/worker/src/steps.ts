// Idempotência por step: cada step concluído grava em job_steps; no retry do
// job, steps concluídos retornam do cache em ms — sem nova geração/cobrança.
import { getPool } from "@influa/core/db/client";

export async function step<T>(
  jobKey: string,
  stepName: string,
  fn: () => Promise<{ output: T; costUsd?: number }>
): Promise<T> {
  const pool = getPool();
  const cached = await pool.query(
    "select output from job_steps where job_key = $1 and step = $2",
    [jobKey, stepName]
  );
  if (cached.rows[0]) {
    console.log(`[step] ↺ ${jobKey}/${stepName} (cache)`);
    return cached.rows[0].output as T;
  }

  console.log(`[step] ▶ ${jobKey}/${stepName}`);
  const { output, costUsd = 0 } = await fn();
  await pool.query(
    `insert into job_steps (job_key, step, output, cost_usd) values ($1, $2, $3, $4)
     on conflict (job_key, step) do nothing`,
    [jobKey, stepName, JSON.stringify(output ?? {}), costUsd]
  );
  console.log(`[step] ✓ ${jobKey}/${stepName}${costUsd ? ` ($${costUsd})` : ""}`);
  return output;
}

/** Apaga um step cacheado — usado quando o resultado cacheado ficou INVÁLIDO
 *  (ex.: prediction que falhou do lado do provider precisa ser re-submetida). */
export async function clearStep(jobKey: string, stepName: string): Promise<void> {
  await getPool().query("delete from job_steps where job_key = $1 and step = $2", [jobKey, stepName]);
}

/** Soma dos custos reais registrados para um job. */
export async function jobCostUsd(jobKey: string): Promise<number> {
  const { rows } = await getPool().query(
    "select coalesce(sum(cost_usd), 0)::float as total from job_steps where job_key = $1",
    [jobKey]
  );
  return rows[0].total;
}
