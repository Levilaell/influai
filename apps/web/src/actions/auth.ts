"use server";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { getPool } from "@influa/core/db/client";
import { grantCredits } from "@influa/core/credits/ledger";
import { autoStartFirstPersona } from "@/lib/first-persona";
import { env } from "@influa/core/env";
import { registerInput } from "@influa/core/schemas";
import { sendEmail, emailTemplate } from "@influa/core/email/index";
import { createAuthToken, consumeAuthToken } from "@influa/core/auth/tokens";
import { signIn, signOut } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

function baseUrl() {
  return env("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
}

async function sendVerification(userId: string, email: string) {
  const token = await createAuthToken(userId, "verify", 24 * 60 * 60 * 1000);
  const url = `${baseUrl()}/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Confirme seu e-mail na Influai",
    html: emailTemplate({
      title: "Confirme seu e-mail",
      body: "Falta um passo para ativar sua conta. Clique no botão abaixo para confirmar seu e-mail.",
      ctaLabel: "Confirmar e-mail",
      ctaUrl: url,
    }),
    text: `Confirme seu e-mail: ${url}`,
  });
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  if (formData.get("terms") !== "on") return { error: "Você precisa aceitar os Termos e a Política de Privacidade" };

  const { email, password, displayName } = parsed.data;
  const hash = await bcrypt.hash(password, 10);
  let userId: string;
  try {
    const { rows } = await getPool().query(
      "insert into users (email, password_hash, display_name, terms_accepted_at) values ($1, $2, $3, now()) returning id",
      [email.toLowerCase().trim(), hash, displayName]
    );
    userId = rows[0].id;
  } catch (err: any) {
    if (err?.code === "23505") return { error: "Este e-mail já está cadastrado" };
    throw err;
  }
  // Bônus de boas-vindas: cobre CRIAR A PERSONA (~56), nunca um vídeo — o vídeo exige
  // assinatura (paywall no auge do desejo). SIGNUP_BONUS_CREDITS=0 desativa.
  const bonus = Number(process.env.SIGNUP_BONUS_CREDITS ?? "70");
  if (bonus > 0) await grantCredits({ userId, amount: bonus, note: "bônus de boas-vindas" }).catch(() => {});
  await sendVerification(userId, email.toLowerCase().trim());
  // Leva o nicho da LP pra dentro (pré-preenche a criação da 1ª marca) — continuidade.
  const niche = String(formData.get("niche") ?? "").trim().slice(0, 80);
  // NOVO FLUXO: com nicho, cria a marca + persona (rascunho) e leva o usuário DIRETO à
  // tela dos rostos. O vídeo (render) fica atrás do paywall — sem vídeo grátis.
  let redirectTo = niche ? `/brands?niche=${encodeURIComponent(niche)}` : "/brands";
  if (niche) {
    let preview: any = null;
    try {
      const raw = String(formData.get("preview") ?? "").trim();
      if (raw) preview = JSON.parse(raw);
    } catch {
      /* prévia inválida — usa só o nicho */
    }
    const personaId = await autoStartFirstPersona(userId, niche, preview).catch(() => null);
    if (personaId) redirectTo = `/personas/${personaId}`;
  }
  await signIn("credentials", { email, password, redirectTo });
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/brands",
    });
  } catch (err) {
    if (err instanceof AuthError) return { error: "E-mail ou senha incorretos" };
    throw err; // NEXT_REDIRECT passa por aqui
  }
}

/** Reenvia o e-mail de verificação para o usuário logado. */
export async function resendVerificationAction(userId: string, email: string): Promise<FormState> {
  await sendVerification(userId, email);
  return { ok: "E-mail de verificação reenviado." };
}

/** Verifica o e-mail a partir do token do link. */
export async function verifyEmailAction(token: string): Promise<boolean> {
  const userId = await consumeAuthToken("verify", token);
  if (!userId) return false;
  await getPool().query("update users set email_verified_at = now() where id = $1", [userId]);
  return true;
}

/** Passo 1 do reset: envia o link (resposta sempre igual, não vaza se o e-mail existe). */
export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const { rows } = await getPool().query("select id from users where email = $1", [email]);
  if (rows[0]) {
    const token = await createAuthToken(rows[0].id, "reset", 60 * 60 * 1000);
    const url = `${baseUrl()}/reset?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Redefinir sua senha na Influai",
      html: emailTemplate({
        title: "Redefinir senha",
        body: "Recebemos um pedido para redefinir sua senha. O link vale por 1 hora.",
        ctaLabel: "Criar nova senha",
        ctaUrl: url,
      }),
      text: `Redefinir senha: ${url}`,
    });
  }
  return { ok: "Se o e-mail existir, enviamos um link para redefinir a senha." };
}

/** Passo 2 do reset: define a nova senha a partir do token. */
export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "A senha precisa de pelo menos 8 caracteres" };
  const userId = await consumeAuthToken("reset", token);
  if (!userId) return { error: "Link inválido ou expirado. Peça um novo." };
  const hash = await bcrypt.hash(password, 10);
  await getPool().query("update users set password_hash = $2 where id = $1", [userId, hash]);
  redirect("/login?reset=1");
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/login");
}

/** Login/cadastro com Google. Carrega o nicho (se veio da LP) pro 1º vídeo automático. */
export async function googleSignInAction(formData: FormData) {
  const niche = String(formData.get("niche") ?? "").trim().slice(0, 80);
  await signIn("google", { redirectTo: niche ? `/brands?niche=${encodeURIComponent(niche)}` : "/brands" });
}
