import { requireAdmin } from "@/lib/auth";
import { getPool } from "@influa/core/db/client";
import { PLANS } from "@influa/core/billing/plans";
import { listOpenReports, listExecutions, listContactMessages } from "@/actions/admin";
import { Card } from "@/components/ui";
import { ReportsList } from "./reports-list";
import { GrantForm } from "./grant-form";
import { Executions } from "./executions";
import { ContactInbox } from "./contact-inbox";

export const metadata = { title: "Admin · Influai" };
export const dynamic = "force-dynamic";
const display = "font-[family-name:var(--font-display)]";

export default async function AdminPage() {
  await requireAdmin();
  const pool = getPool();
  const n = (sql: string) => pool.query(sql).then((r) => Number(r.rows[0]?.n ?? 0));

  const [signups, withPersona, personaReady, withBrain, videoAttempted, videoReady, subscribed, reports, exec, contacts] = await Promise.all([
    n("select count(*)::int n from users"),
    n("select count(distinct user_id)::int n from personas"),
    n("select count(distinct user_id)::int n from personas where status='ready'"),
    n("select count(distinct b.user_id)::int n from brand_profiles bp join brands b on b.id=bp.brand_id"),
    n("select count(distinct user_id)::int n from videos"),
    n("select count(distinct user_id)::int n from videos where status='ready'"),
    n("select count(distinct user_id)::int n from subscriptions where status in ('active','trialing')"),
    listOpenReports(),
    listExecutions(),
    listContactMessages(),
  ]);

  const funnel = [
    { label: "Cadastros", n: signups },
    { label: "Criou persona", n: withPersona },
    { label: "Persona pronta", n: personaReady },
    { label: "Criou cérebro", n: withBrain },
    { label: "Tentou gerar vídeo", n: videoAttempted },
    { label: "Vídeo gerado", n: videoReady },
    { label: "Assinou 💰", n: subscribed },
  ];
  const top = Math.max(signups, 1);

  const { rows: recent } = await pool.query(`
    select u.email, u.created_at,
      exists(select 1 from personas p where p.user_id=u.id) as persona,
      exists(select 1 from brand_profiles bp join brands b on b.id=bp.brand_id where b.user_id=u.id) as brain,
      exists(select 1 from videos v where v.user_id=u.id) as video,
      exists(select 1 from videos v where v.user_id=u.id and v.status='ready') as ready,
      exists(select 1 from subscriptions s where s.user_id=u.id and s.status in ('active','trialing')) as subscribed
    from users u order by u.created_at desc limit 25`);
  const step = (r: any) =>
    r.subscribed ? "Assinou 💰" : r.ready ? "Vídeo gerado" : r.video ? "Tentou vídeo" : r.brain ? "Cérebro" : r.persona ? "Persona" : "Só cadastrou";

  const { rows: subs } = await pool.query("select plan, count(*)::int n from subscriptions where status in ('active','trialing') group by plan");
  const mrr = subs.reduce((s: number, r: any) => s + (PLANS[r.plan as keyof typeof PLANS]?.priceBRL ?? 0) * r.n, 0);
  const { rows: events } = await pool.query("select event, count(*)::int n from events group by event order by n desc limit 12");

  return (
    <div className="space-y-8">
      <div>
        <h1 className={`${display} text-3xl font-semibold`}>Admin</h1>
        <p className="mt-1 text-muted">Funil, onde as pessoas largam, receita — e auditoria.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { k: "Cadastros", v: String(signups) },
          { k: "Assinantes", v: String(subscribed) },
          { k: "MRR", v: `R$${mrr}` },
          { k: "Conversão", v: `${signups ? ((subscribed / signups) * 100).toFixed(1) : "0"}%` },
        ].map((x) => (
          <Card key={x.k}>
            <div className="text-xs uppercase tracking-wide text-muted">{x.k}</div>
            <div className={`${display} mt-1 text-3xl font-semibold text-accent`}>{x.v}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className={`${display} mb-4 text-xl font-semibold`}>Funil de ativação</h2>
        <div className="space-y-2.5">
          {funnel.map((f, i) => {
            const pct = (f.n / top) * 100;
            const prev = i > 0 ? funnel[i - 1].n : f.n;
            const drop = prev > 0 ? Math.round(((prev - f.n) / prev) * 100) : 0;
            return (
              <div key={f.label} className="flex items-center gap-3 text-sm">
                <div className="w-40 shrink-0 text-muted">{f.label}</div>
                <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-bg-soft">
                  <div className="h-full rounded-md bg-accent/70" style={{ width: `${Math.max(pct, 2)}%` }} />
                  <div className="absolute inset-0 flex items-center px-2.5 text-xs font-medium text-ink">
                    {f.n} <span className="ml-1.5 text-muted">({((f.n / top) * 100).toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="w-24 shrink-0 text-right text-xs">
                  {i > 0 && drop > 0 ? <span className="text-danger">−{drop}% aqui</span> : <span className="text-muted">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className={`${display} mb-4 text-xl font-semibold`}>Últimos cadastros (onde pararam)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2">E-mail</th>
                <th className="pb-2">Quando</th>
                <th className="pb-2">Parou em</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r: any, i: number) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-2 pr-3">{r.email}</td>
                  <td className="py-2 pr-3 text-muted">
                    {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2">
                    <span className={r.subscribed ? "text-accent" : r.video ? "text-ink" : "text-muted"}>{step(r)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {events.length > 0 && (
        <Card>
          <h2 className={`${display} mb-3 text-xl font-semibold`}>Eventos rastreados</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {events.map((e: any) => (
              <span key={e.event} className="rounded-full border border-line px-3 py-1">
                {e.event} <span className="text-accent">{e.n}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      <ContactInbox messages={contacts} />

      <div>
        <h2 className="mb-3 text-lg font-medium">Execuções recentes</h2>
        <Executions executions={exec.executions} stats={exec.stats} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Reports abertos ({reports.length})</h2>
        {reports.length === 0 ? (
          <Card className="py-10 text-center text-muted">Nenhum report aberto.</Card>
        ) : (
          <ReportsList reports={reports} />
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Conceder créditos</h2>
        <GrantForm />
      </div>
    </div>
  );
}
