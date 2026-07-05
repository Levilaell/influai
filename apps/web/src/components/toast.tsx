"use client";
// Toast leve: chame toast("msg", "error") de qualquer lugar; <Toaster/> (montado no
// layout raiz) renderiza. Substitui os alert() nativos por algo bonito e não-bloqueante.
import { useEffect, useState } from "react";

type Kind = "error" | "success" | "info";
type Item = { id: number; msg: string; kind: Kind };
let counter = 0;

export function toast(msg: string, kind: Kind = "info") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("influa-toast", { detail: { id: ++counter, msg, kind } }));
  }
}

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const t = (e as CustomEvent).detail as Item;
      setItems((cur) => [...cur, t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 4500);
    };
    window.addEventListener("influa-toast", handler);
    return () => window.removeEventListener("influa-toast", handler);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-[90vw] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto animate-[fade-in_.2s_ease] rounded-xl border px-4 py-3 text-sm shadow-lg ${
            t.kind === "error"
              ? "border-danger/40 bg-danger/15 text-danger"
              : t.kind === "success"
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-line bg-bg-soft text-ink"
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
