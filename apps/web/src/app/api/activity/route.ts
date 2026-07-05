// Contagem leve de operações em andamento (vídeos + personas) do usuário,
// para o indicador de "gerando" no header — permite sair da tela sem perder nada.
import { getPool } from "@influa/core/db/client";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id;
  if (!userId) return Response.json({ videos: 0, personas: 0 });

  const { rows } = await getPool().query(
    `select
       (select count(*) from videos
         where user_id = $1
           and status in ('queued','scripting','keyframing','voicing','rendering','assembling'))::int as videos,
       (select count(*) from personas
         where user_id = $1
           and status in ('candidates_generating','sheet_generating'))::int as personas`,
    [userId]
  );
  return Response.json(rows[0]);
}
