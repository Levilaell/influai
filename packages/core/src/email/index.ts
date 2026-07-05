// Envio de e-mail transacional. Usa Resend se RESEND_API_KEY estiver setado;
// caso contrário (dev), imprime o e-mail no console — dá pra testar sem provedor.
import "../env.ts";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Influai <nao-responda@influai.com.br>";

  if (!key) {
    console.log(
      `\n──────── [e-mail dev] ────────\nPara: ${opts.to}\nAssunto: ${opts.subject}\n\n${opts.text ?? opts.html.replace(/<[^>]+>/g, "")}\n──────────────────────────────\n`
    );
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Layout simples e escuro, alinhado à marca. */
export function emailTemplate(opts: { title: string; body: string; ctaLabel?: string; ctaUrl?: string }): string {
  const btn = opts.ctaUrl
    ? `<a href="${opts.ctaUrl}" style="display:inline-block;background:#d4ff3f;color:#131500;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:999px;margin-top:16px">${opts.ctaLabel ?? "Abrir"}</a>`
    : "";
  return `<div style="background:#0d0d0f;color:#f2f1ec;font-family:Arial,sans-serif;padding:40px 24px">
    <div style="max-width:480px;margin:0 auto">
      <div style="font-size:22px;font-weight:800;margin-bottom:24px">influai<span style="color:#d4ff3f">.</span></div>
      <h1 style="font-size:20px">${opts.title}</h1>
      <p style="color:#9b9a93;line-height:1.6">${opts.body}</p>
      ${btn}
      <p style="color:#66655f;font-size:12px;margin-top:32px">Se você não solicitou isso, ignore este e-mail.</p>
    </div>
  </div>`;
}
