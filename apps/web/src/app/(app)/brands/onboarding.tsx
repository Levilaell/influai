"use client";
// Checklist de primeiros passos — aparece no topo de /brands até o 1º vídeo.
// Dispensável para quem já conhece (guardado em localStorage).
import { useEffect, useState } from "react";
import Link from "next/link";
import type { OnboardingState } from "@/lib/onboarding";
import { Card } from "@/components/ui";

export function Onboarding({ state }: { state: OnboardingState }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    setHidden(localStorage.getItem("influa_onboarding_hidden") === "1");
  }, []);

  if (state.complete || hidden) return null;
  const done = state.steps.filter((s) => s.done).length;

  const dismiss = () => {
    localStorage.setItem("influa_onboarding_hidden", "1");
    setHidden(true);
  };

  return (
    <Card className="space-y-4 border-accent/30">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Comece por aqui</h2>
          <p className="text-sm text-muted">
            {done} de {state.steps.length} passos — do zero ao primeiro vídeo.
          </p>
        </div>
        <button onClick={dismiss} className="text-xs text-muted hover:text-ink">
          ocultar
        </button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-bg">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / state.steps.length) * 100}%` }} />
      </div>

      <ol className="space-y-2">
        {state.steps.map((s, i) => {
          const isNext = i === state.nextIndex;
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                  isNext ? "border-accent bg-accent/5" : s.done ? "border-line opacity-70" : "border-line hover:border-accent/40"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? "bg-accent text-accent-ink" : isNext ? "border-2 border-accent text-accent" : "border border-line text-muted"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${s.done ? "line-through" : ""}`}>{s.title}</span>
                  {isNext && <span className="block text-xs text-muted">{s.desc}</span>}
                </span>
                {isNext && <span className="ml-auto text-sm text-accent">→</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
