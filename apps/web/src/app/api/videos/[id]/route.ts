// Polling da Fábrica: status + progresso + script + arquivo final.
import { NextRequest } from "next/server";
import { getPool } from "@influa/core/db/client";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as any)?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { rows } = await getPool().query(
    `select id, status, error, progress, script, topic, estimated_credits,
            actual_cost_usd, final_storage_key, persona_id
     from videos where id = $1 and user_id = $2`,
    [id, userId]
  );
  if (!rows[0]) return Response.json({ error: "not found" }, { status: 404 });

  const v = rows[0];
  return Response.json({
    ...v,
    finalUrl: v.final_storage_key ? `/api/files/${v.final_storage_key}` : null,
    keyframeUrl: `/api/files/videos/${v.id}/keyframe.jpg`,
  });
}
