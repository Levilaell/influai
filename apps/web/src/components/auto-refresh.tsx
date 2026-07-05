"use client";
// Atualiza a rota (server component) a cada N segundos enquanto `active` — usado
// na galeria para os cards em processamento virarem "pronto" sem recarregar.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ active, ms = 4000 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [active, ms, router]);
  return null;
}
