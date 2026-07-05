// Inicia o OAuth do Instagram: redireciona o usuário para o diálogo da Meta.
// Requer FACEBOOK_APP_ID/SECRET (só existem depois do app review da Meta).
import { redirect } from "next/navigation";
import { env } from "@influa/core/env";
import { metaOAuthUrl } from "@influa/core/social/instagram";
import { getPool } from "@influa/core/db/client";
import { auth } from "@/lib/auth";
import { makeState } from "@/lib/oauth-state";

export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) redirect("/brands");

  const { rows } = await getPool().query("select id from brands where id = $1 and user_id = $2", [brandId, userId]);
  if (!rows[0]) redirect("/brands");

  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) redirect(`/brands/${brandId}?ig=unavailable`);

  const base = env("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
  const url = metaOAuthUrl({
    appId,
    redirectUri: `${base}/api/instagram/callback`,
    state: makeState(brandId, userId),
  });
  redirect(url);
}
