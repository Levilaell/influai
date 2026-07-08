"use server";
// Formulário de contato (LP pública e /suporte no app). Grava no banco sempre;
// o e-mail de aviso pro time é best-effort (Resend).
import { headers } from "next/headers";
import { getPool } from "@influa/core/db/client";
import { sendEmail, emailTemplate } from "@influa/core/email/index";
import { auth } from "@/lib/auth";

export type ContactState = { ok?: string; error?: string } | undefined;

// Rate-limit leve em memória por IP (a LP é pública — segura spam casual).
const hits = new Map<string, number[]>();
function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  hits.set(key, arr);
  return true;
}

export async function contactAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const message = String(formData.get("message") ?? "").trim().slice(0, 3000);
  const source = formData.get("source") === "app" ? "app" : "lp";

  if (!/.+@.+\..+/.test(email)) return { error: "Informe um e-mail válido pra gente responder" };
  if (message.length < 10) return { error: "Conte um pouco mais sobre a sua dúvida (mínimo 10 caracteres)" };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!allow(`contact:${ip}`, 5, 60 * 60 * 1000))
    return { error: "Muitas mensagens seguidas — espere um pouco e tente de novo" };

  const session = await auth().catch(() => null);
  const userId = (session?.user as any)?.id ?? null;

  await getPool().query(
    "insert into contact_messages (user_id, name, email, message, source) values ($1, $2, $3, $4, $5)",
    [userId, name, email, message, source]
  );

  // Aviso interno vai pro CONTACT_EMAIL (pessoal). SEM reply-to de propósito:
  // responder direto da caixa pessoal exporia o e-mail do Levi — a resposta
  // profissional é pelo /admin (sai como contato@influai.com.br).
  const inbox = process.env.CONTACT_EMAIL ?? "levilael2@hotmail.com";
  await sendEmail({
    to: inbox,
    subject: `[Contato ${source === "app" ? "plataforma" : "LP"}] ${name || email}`,
    html: emailTemplate({
      title: "Nova mensagem de contato",
      body: `<b>De:</b> ${name || "—"} &lt;${email}&gt;<br/><b>Origem:</b> ${source}${userId ? ` (user ${userId})` : ""}<br/><br/>${message.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}<br/><br/>⚠️ NÃO responda este e-mail direto (exporia seu endereço pessoal). Responda pelo painel — sai como contato@influai.com.br.`,
      ctaLabel: "Responder pelo Admin",
      ctaUrl: `${(process.env.PUBLIC_BASE_URL ?? "https://influai.com.br").replace(/\/$/, "")}/admin`,
    }),
    text: `De: ${name || "—"} <${email}> (${source})\n\n${message}\n\nResponda pelo /admin (sai como contato@influai.com.br).`,
  }).catch(() => {
    /* best-effort — a mensagem já está no banco */
  });

  return { ok: "Mensagem enviada! Respondemos no seu e-mail, geralmente no mesmo dia." };
}
