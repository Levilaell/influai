import { listOpenReports, listExecutions } from "@/actions/admin";
import { Card } from "@/components/ui";
import { ReportsList } from "./reports-list";
import { GrantForm } from "./grant-form";
import { Executions } from "./executions";

export default async function AdminPage() {
  const [reports, exec] = await Promise.all([listOpenReports(), listExecutions()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Admin</h1>
        <p className="mt-1 text-muted">Auditoria de execuções, reports de defeito e créditos.</p>
      </div>

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
