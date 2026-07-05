// Callback do OAuth: troca o code por token de longa duração, descobre a conta
// profissional do Instagram e salva a conexão em brands.instagram.
import { redirect } from "next/navigation";
import { env } from "@influa/core/env";
import { metaExchangeCode, metaLongLivedToken, findInstagramAccount } from "@influa/core/social/instagram";
import { getPool } from "@influa/core/db/client";
import { auth } from "@/lib/auth";
import { readState } from "@/lib/oauth-state";

export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const parsed = state ? readState(state) : null;

  // valida state (anti-CSRF) e dono
  if (!code || !parsed || parsed.userId !== userId) redirect("/brands?ig=error");
  const brandId = parsed.brandId;

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) redirect(`/brands/${brandId}?ig=unavailable`);

  const base = env("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
  try {
    const shortToken = await metaExchangeCode({
      appId, appSecret, redirectUri: `${base}/api/instagram/callback`, code,
    });
    const longToken = await metaLongLivedToken({ appId, appSecret, shortToken });
    const conn = await findInstagramAccount(longToken);
    if (!conn) redirect(`/brands/${brandId}?ig=noaccount`);

    await getPool().query(
      "update brands set instagram = $2 where id = $1 and user_id = $3",
      [brandId, JSON.stringify({ ...conn, connected_at: new Date().toISOString() }), userId]
    );
    redirect(`/brands/${brandId}?ig=connected`);
  } catch {
    redirect(`/brands/${brandId}?ig=error`);
  }
}
