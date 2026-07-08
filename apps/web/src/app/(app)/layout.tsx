import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getBalance } from "@influa/core/credits/ledger";
import { getPool } from "@influa/core/db/client";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");
  const [balance, userRow] = await Promise.all([
    getBalance(userId),
    getPool().query("select email, is_admin from users where id = $1", [userId]),
  ]);
  const user = userRow.rows[0];

  return (
    <div className="flex min-h-screen">
      <Sidebar balance={balance} email={user?.email ?? ""} isAdmin={Boolean(user?.is_admin)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pt-14 md:pt-0">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
