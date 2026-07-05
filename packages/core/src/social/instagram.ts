// Publicação no Instagram via Content Publishing API (Graph API).
// Fluxo oficial de 2 passos para Reels:
//   1) POST /{ig-user-id}/media  (media_type=REELS, video_url, caption) -> creation_id
//   2) poll GET /{creation_id}?fields=status_code até FINISHED (vídeo processa async)
//   3) POST /{ig-user-id}/media_publish (creation_id) -> media_id publicado
// Requisitos: conta profissional IG + página FB vinculada + app Meta +
// permissão instagram_business_content_publish (app review ~2-4 semanas).
// O container expira em 24h → criar perto da hora de publicar.
import "../env.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

export type IgConnection = { ig_user_id: string; access_token: string; username?: string };

// Escopos necessários p/ publicar Reels numa conta profissional vinculada a uma Página.
const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

/** URL do diálogo de OAuth da Meta (para onde redirecionamos o usuário). */
export function metaOAuthUrl(opts: { appId: string; redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    client_id: opts.appId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    scope: SCOPES,
    response_type: "code",
  });
  return `${OAUTH_DIALOG}?${q.toString()}`;
}

/** Troca o "code" do callback por um token de curta duração. */
export async function metaExchangeCode(opts: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<string> {
  const q = new URLSearchParams({
    client_id: opts.appId,
    client_secret: opts.appSecret,
    redirect_uri: opts.redirectUri,
    code: opts.code,
  });
  const res = await fetch(`${GRAPH}/oauth/access_token?${q.toString()}`);
  const json: any = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`Meta oauth: ${JSON.stringify(json).slice(0, 200)}`);
  return json.access_token;
}

/** Troca o token curto por um de longa duração (~60 dias). */
export async function metaLongLivedToken(opts: {
  appId: string;
  appSecret: string;
  shortToken: string;
}): Promise<string> {
  const q = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: opts.appId,
    client_secret: opts.appSecret,
    fb_exchange_token: opts.shortToken,
  });
  const res = await fetch(`${GRAPH}/oauth/access_token?${q.toString()}`);
  const json: any = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`Meta long token: ${JSON.stringify(json).slice(0, 200)}`);
  return json.access_token;
}

/**
 * Descobre a conta profissional do Instagram vinculada a uma Página do usuário.
 * Retorna o ig_user_id + token da Página (usado para publicar) + username.
 */
export async function findInstagramAccount(userToken: string): Promise<IgConnection | null> {
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=access_token,instagram_business_account{id,username}&access_token=${userToken}`
  );
  const json: any = await res.json();
  if (!res.ok) throw new Error(`Meta accounts: ${JSON.stringify(json).slice(0, 200)}`);
  for (const page of json.data ?? []) {
    const ig = page.instagram_business_account;
    if (ig?.id) {
      return { ig_user_id: ig.id, access_token: page.access_token, username: ig.username };
    }
  }
  return null;
}

export async function publishReel(opts: {
  conn: IgConnection;
  videoUrl: string; // URL pública que a Meta consegue baixar (mp4)
  caption: string;
  onPoll?: () => void;
}): Promise<{ mediaId: string }> {
  // Dev sem app review: simula a publicação (para testar o agendamento ponta a ponta)
  if (process.env.SIMULATE_PUBLISH === "1") {
    return { mediaId: `sim_${Date.now()}` };
  }
  const { ig_user_id, access_token } = opts.conn;

  // 1) cria o container do Reel
  const create = await fetch(`${GRAPH}/${ig_user_id}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: opts.videoUrl,
      caption: opts.caption,
      access_token,
    }),
  });
  const created: any = await create.json();
  if (!create.ok || !created.id) throw new Error(`IG container: ${JSON.stringify(created).slice(0, 300)}`);
  const creationId = created.id as string;

  // 2) espera o processamento do vídeo (status FINISHED) — até ~5min
  for (let i = 0; i < 60; i++) {
    opts.onPoll?.();
    await new Promise((r) => setTimeout(r, 5000));
    const st = await fetch(`${GRAPH}/${creationId}?fields=status_code&access_token=${access_token}`);
    const s: any = await st.json();
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED")
      throw new Error(`IG processamento: ${s.status_code}`);
  }

  // 3) publica
  const pub = await fetch(`${GRAPH}/${ig_user_id}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token }),
  });
  const published: any = await pub.json();
  if (!pub.ok || !published.id) throw new Error(`IG publish: ${JSON.stringify(published).slice(0, 300)}`);
  return { mediaId: published.id as string };
}
