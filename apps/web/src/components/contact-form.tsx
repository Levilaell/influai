"use client";
// Formulário de contato — usado na LP (source="lp") e em /suporte (source="app").
import { useActionState } from "react";
import { contactAction } from "@/actions/contact";

export function ContactForm({
  source,
  defaultName = "",
  defaultEmail = "",
}: {
  source: "lp" | "app";
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [state, action, pending] = useActionState(contactAction, undefined);

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/5 px-5 py-6 text-center">
        <p className="font-semibold text-accent">✓ {state.ok}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3 text-left">
      <input type="hidden" name="source" value={source} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="name"
          defaultValue={defaultName}
          placeholder="Seu nome"
          className="w-full rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink outline-none focus:border-accent"
        />
        <input
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          placeholder="seu@email.com"
          className="w-full rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      <textarea
        name="message"
        required
        minLength={10}
        rows={4}
        placeholder="Escreva sua dúvida, sugestão ou problema — respondemos por e-mail."
        className="w-full rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink outline-none focus:border-accent"
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-ink transition hover:brightness-105 disabled:opacity-60 sm:w-auto sm:px-10"
      >
        {pending ? "Enviando..." : "Enviar mensagem"}
      </button>
    </form>
  );
}
