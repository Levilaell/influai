import Link from "next/link";
import type { Execution, ExecStats } from "@/actions/admin";
import { Badge, Card } from "@/components/ui";

const TONE: Record<string, "ok" | "danger" | "muted" | "accent"> = {
  ready: "ok", failed: "danger", draft: "muted",
};
function tone(status: string) {
  return TONE[status] ?? "accent"; // em andamento
}

export function Executions({ executions, stats }: { executions: Execution[]; stats: ExecStats }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Prontos (7d)" value={String(stats.ready)} />
        <Stat label="Falhas (7d)" value={String(stats.failed)} tone={stats.failed > 0 ? "danger" : undefined} />
        <Stat label="Rodando" value={String(stats.running)} />
        <Stat label="Custo (7d)" value={`$${stats.costUsd.toFixed(2)}`} />
      </div>

      {executions.length === 0 ? (
        <Card className="py-10 text-center text-muted">Nenhuma execução ainda.</Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Vídeo</th>
                <th className="px-3 py-2 font-medium">Marca / Persona</th>
                <th className="px-3 py-2 font-medium">Usuário</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Custo</th>
                <th className="px-3 py-2 font-medium">Tempo</th>
                <th className="px-3 py-2 font-medium">Quando</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((e) => (
                <tr key={e.id} className="border-b border-line/50 align-top last:border-0">
                  <td className="max-w-[220px] px-3 py-2">
                    <Link href={`/videos/${e.id}`} className="line-clamp-1 hover:text-accent">{e.title}</Link>
                    {e.error && <p className="mt-0.5 line-clamp-2 text-xs text-danger/80">{e.error}</p>}
                  </td>
                  <td className="px-3 py-2 text-muted">{e.brand} · {e.persona}</td>
                  <td className="max-w-[160px] px-3 py-2 text-muted"><span className="line-clamp-1">{e.email}</span></td>
                  <td className="px-3 py-2"><Badge tone={tone(e.status)}>{e.status}</Badge></td>
                  <td className="px-3 py-2 text-muted">{e.costUsd > 0 ? `$${e.costUsd.toFixed(2)}` : "—"}</td>
                  <td className="px-3 py-2 text-muted">{e.elapsedSec != null ? `${e.elapsedSec}s` : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                    {new Date(e.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <Card className="py-3 text-center">
      <div className={`text-2xl font-semibold ${tone === "danger" ? "text-danger" : ""}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}
