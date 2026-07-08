import { getPool } from "@influa/core/db/client";
import { requireUserId } from "@/lib/auth";
import { Card } from "@/components/ui";
import { ContactForm } from "@/components/contact-form";

export const metadata = { title: "Suporte · Influai" };

export default async function SuportePage() {
  const userId = await requireUserId();
  const { rows } = await getPool().query("select email, display_name from users where id = $1", [userId]);
  const user = rows[0];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Suporte</h1>
        <p className="mt-1 text-muted">
          Dúvida, sugestão ou algo não funcionou? Manda aqui — a gente responde no seu e-mail.
        </p>
      </div>
      <Card>
        <ContactForm source="app" defaultName={user?.display_name ?? ""} defaultEmail={user?.email ?? ""} />
      </Card>
      <p className="text-center text-xs text-muted">
        Problema num vídeo específico? Use o "reportar problema" na página do próprio vídeo — vai direto pra análise.
      </p>
    </div>
  );
}
