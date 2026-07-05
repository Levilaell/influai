"use client";
import { useState, useTransition } from "react";
import { resendVerificationAction } from "@/actions/auth";

export function VerifyBanner({ userId, email }: { userId: string; email: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const resend = () =>
    start(async () => {
      const r = await resendVerificationAction(userId, email);
      setMsg(r?.ok ?? "Enviado.");
    });
  return (
    <div className="border-b border-accent/30 bg-accent/5 px-6 py-2 text-center text-sm text-accent">
      Confirme seu e-mail para garantir o acesso.{" "}
      {msg ? (
        <span className="text-muted">{msg}</span>
      ) : (
        <button onClick={resend} disabled={pending} className="underline hover:opacity-80">
          {pending ? "enviando..." : "reenviar e-mail"}
        </button>
      )}
    </div>
  );
}
