import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { isAdmin } from "@/actions/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  if (!(await isAdmin(userId))) redirect("/brands");
  return <>{children}</>;
}
