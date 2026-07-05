"use client";
// Indicador global de operações em andamento — fica no header em todas as telas,
// deixando claro que dá pra sair e o vídeo/persona continua gerando.
import { useEffect, useState } from "react";
import Link from "next/link";

export function ActivityIndicator() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/activity", { cache: "no-store" });
        const d = await r.json();
        if (alive) setCount((d.videos ?? 0) + (d.personas ?? 0));
      } catch {
        /* ignora */
      }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (count === 0) return null;
  return (
    <Link
      href="/brands"
      className="flex items-center gap-2 rounded-full border border-accent/40 px-3 py-1.5 text-xs text-accent"
      title="Operações em andamento — pode continuar navegando"
    >
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      {count} gerando
    </Link>
  );
}
