// Polling do wizard: status + assets da persona.
import { NextRequest } from "next/server";
import { getPool } from "@influa/core/db/client";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as any)?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const pool = getPool();
  const { rows } = await pool.query(
    "select id, status, error, name, voice_id from personas where id = $1 and user_id = $2",
    [id, userId]
  );
  if (!rows[0]) return Response.json({ error: "not found" }, { status: 404 });

  const { rows: assets } = await pool.query(
    `select id, kind, idx, storage_key from persona_assets
     where persona_id = $1 order by kind, idx`,
    [id]
  );

  return Response.json({
    ...rows[0],
    assets: assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      idx: a.idx,
      url: `/api/files/${a.storage_key}`, // sessão logada autoriza
    })),
  });
}
