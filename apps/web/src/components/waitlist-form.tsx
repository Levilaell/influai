"use client";
import { useActionState } from "react";
import { joinWaitlistAction } from "@/actions/waitlist";

export function WaitlistForm({ buttonLabel }: { buttonLabel: string }) {
  const [state, action, pending] = useActionState(joinWaitlistAction, undefined);
  return (
    <div>
      <form action={action} className="flex flex-wrap justify-center gap-2.5">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="seu@email.com"
          className="w-[min(360px,100%)] rounded-full border border-line bg-bg-soft px-5 py-[15px] text-ink outline-none transition focus:border-accent placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-full bg-accent px-[30px] py-[15px] font-bold text-accent-ink transition hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {pending ? "Enviando..." : buttonLabel}
        </button>
      </form>
      <p role="status" className={`mt-3.5 min-h-[1.4em] text-[.95rem] ${state?.error ? "text-danger" : "text-accent"}`}>
        {state?.ok ?? state?.error ?? ""}
      </p>
    </div>
  );
}
