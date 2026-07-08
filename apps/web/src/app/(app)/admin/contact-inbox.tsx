"use client";
// Caixa de contato do admin: responde SAINDO como contato@influai.com.br
// (o e-mail pessoal nunca vai pro usuário).
import { useState, useTransition } from "react";
import { replyContactAction, type ContactMessage } from "@/actions/admin";
import { Button, Card, Textarea } from "@/components/ui";

export function ContactInbox({ messages }: { messages: ContactMessage[] }) {
  if (!messages.length) return null;
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Mensagens de contato</h2>
        <p className="text-xs text-muted">
          A resposta sai como <b className="text-ink">contato@influai.com.br</b> — seu e-mail pessoal nunca aparece.
        </p>
      </div>
      <div className="space-y-3">
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
      </div>
    </Card>
  );
}

function Message({ m }: { m: ContactMessage }) {
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const when = new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const send = () =>
    start(async () => {
      setError(undefined);
      const r = await replyContactAction(m.id, reply);
      if (r?.error) setError(r.error);
    });

  return (
    <div className="rounded-xl border border-line bg-bg p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <b className="text-ink">{m.name || m.email}</b>
        <span>&lt;{m.email}&gt;</span>
        <span className="rounded-full border border-line px-2 py-0.5">{m.source}</span>
        <span>{when}</span>
        {m.replied_at && <span className="text-accent">respondida ✓</span>}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{m.message}</p>
      {m.replied_at ? (
        <p className="mt-3 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-muted">
          <b className="text-accent">Sua resposta:</b> {m.reply}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Escreva a resposta (o usuário recebe por e-mail)..."
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button onClick={send} disabled={pending || reply.trim().length < 2}>
            {pending ? "Enviando..." : "Responder como contato@influai.com.br"}
          </Button>
        </div>
      )}
    </div>
  );
}
