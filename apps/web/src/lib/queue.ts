// Producer pg-boss do lado web (envia jobs; quem processa é o apps/worker).
// As FILAS são criadas pelo worker no boot — aqui só enviamos (não chamar
// createQueue para não sobrescrever as opções de retry do worker).
import PgBoss from "pg-boss";
import { env } from "@influa/core/env";

let boss: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  if (!starting) {
    starting = (async () => {
      // pg-boss PRECISA de session mode (LISTEN/NOTIFY, advisory locks) — usa a pool de
      // sessão dedicada (5432) com poucas conexões; o app usa transaction pool (6543).
      const b = new PgBoss({
        connectionString: process.env.PGBOSS_DATABASE_URL ?? env("DATABASE_URL"),
        schema: "pgboss",
        max: 3,
      });
      b.on("error", (err) => console.error("[pg-boss web]", err));
      await b.start();
      boss = b;
      return b;
    })();
  }
  return starting;
}

export async function sendJob(queue: string, data: object, singletonKey: string) {
  const b = await getBoss();
  try {
    await b.send(queue, data, { singletonKey });
  } catch (err: any) {
    if (String(err?.message).includes("Queue") && String(err?.message).includes("not found")) {
      throw new Error(`Fila '${queue}' não existe — o worker está rodando? (pnpm dev sobe web+worker)`);
    }
    throw err;
  }
}
