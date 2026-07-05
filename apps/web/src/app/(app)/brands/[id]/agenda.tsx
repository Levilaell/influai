"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { cancelScheduledPostAction, type ScheduledPost } from "@/actions/schedule";
import { Badge, Card } from "@/components/ui";

const STATUS: Record<string, { label: string; tone: "ok" | "muted" | "danger" | "accent" }> = {
  scheduled: { label: "Agendado", tone: "accent" },
  publishing: { label: "Publicando", tone: "accent" },
  published: { label: "Publicado", tone: "ok" },
  failed: { label: "Falhou", tone: "danger" },
  canceled: { label: "Cancelado", tone: "muted" },
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function Agenda({ initial }: { initial: ScheduledPost[] }) {
  const [posts, setPosts] = useState(initial);
  const [pending, start] = useTransition();

  const cancel = (id: string) =>
    start(async () => {
      await cancelScheduledPostAction(id);
      setPosts((p) => p.map((x) => (x.id === id ? { ...x, status: "canceled" } : x)));
    });

  if (posts.length === 0) {
    return (
      <Card className="py-12 text-center text-muted">
        Nenhuma publicação agendada. Abra um vídeo pronto e clique em <b>Agendar publicação</b>.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        A publicação automática no Instagram entra no ar quando a conta profissional for conectada
        (depende da aprovação da Meta). Os agendamentos abaixo já ficam registrados.
      </p>
      {posts.map((p) => {
        const s = STATUS[p.status] ?? { label: p.status, tone: "muted" as const };
        return (
          <Card key={p.id} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Link href={`/videos/${p.videoId}`} className="truncate font-medium hover:text-accent">
                {p.videoTitle ?? "Vídeo"}
              </Link>
              <div className="mt-0.5 text-xs text-muted">{fmt(p.scheduledAt)}</div>
              {p.error && <div className="mt-1 text-xs text-danger">{p.error}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge tone={s.tone}>{s.label}</Badge>
              {(p.status === "scheduled" || p.status === "failed") && (
                <button onClick={() => cancel(p.id)} disabled={pending} className="text-xs text-muted hover:text-danger">
                  cancelar
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
