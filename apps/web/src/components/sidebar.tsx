"use client";
// Barra lateral persistente no desktop; no mobile vira drawer (topbar + hambúrguer).
// Nav global + as seções da marca quando você está dentro de uma (abas por URL).
import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import { ActivityIndicator } from "@/components/activity-indicator";

const BRAND_TABS = ["Cérebro", "Recursos", "Personas", "Vídeos", "Agenda", "Memória"];

export function Sidebar({
  balance,
  email,
  isAdmin,
}: {
  balance: number;
  email: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // dentro de uma marca? /brands/<uuid>
  const brandMatch = pathname.match(/^\/brands\/([0-9a-f-]{36})/i);
  const brandId = brandMatch?.[1] ?? null;

  const global = [
    { href: "/brands", label: "Marcas", icon: "◧" },
    { href: "/credits", label: "Créditos", icon: "◈" },
    { href: "/tutorial", label: "Como funciona", icon: "?" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "⚙" }] : []),
  ];

  const isActive = (href: string) =>
    href === "/brands" ? pathname === "/brands" || Boolean(brandId) : pathname.startsWith(href);

  return (
    <>
      {/* Topbar mobile */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg px-4 md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-xl text-ink hover:bg-bg-soft"
        >
          ☰
        </button>
        <Link href="/brands" className="font-[family-name:var(--font-display)] text-lg font-semibold">
          influai<span className="text-accent">.</span>
        </Link>
        <Link
          href="/credits"
          className="rounded-full border border-accent/40 px-3 py-1 text-xs text-accent"
          title="Créditos"
        >
          {balance}
        </Link>
      </div>

      {/* Backdrop (mobile, quando aberto) */}
      {open && <div onClick={close} className="fixed inset-0 z-40 bg-black/60 md:hidden" aria-hidden />}

      {/* Sidebar / drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-bg-soft px-3 py-5 transition-transform duration-200 md:static md:z-auto md:w-56 md:translate-x-0 md:bg-bg-soft/40 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/brands"
            onClick={close}
            className="px-2 font-[family-name:var(--font-display)] text-xl font-semibold"
          >
            influai<span className="text-accent">.</span>
          </Link>
          <button
            onClick={close}
            aria-label="Fechar menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-muted hover:text-ink md:hidden"
          >
            ×
          </button>
        </div>

        <nav className="space-y-1">
          {global.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={close}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                isActive(n.href) ? "bg-accent/10 text-accent" : "text-muted hover:bg-bg hover:text-ink"
              }`}
            >
              <span className="w-4 text-center">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>

        {brandId && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-1 px-3 text-[11px] uppercase tracking-wide text-muted">Nesta marca</p>
            <nav className="space-y-0.5">
              {BRAND_TABS.map((t) => (
                <Link
                  key={t}
                  href={`/brands/${brandId}?tab=${encodeURIComponent(t)}`}
                  scroll={false}
                  onClick={close}
                  className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                    (activeTab ?? "") === t ? "text-accent" : "text-muted hover:text-ink"
                  }`}
                >
                  {t}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <div className="mt-auto space-y-3 border-t border-line pt-4">
          <ActivityIndicator />
          <Link
            href="/credits"
            onClick={close}
            className="flex items-center justify-between rounded-xl border border-accent/40 px-3 py-1.5 text-sm text-accent"
            title="Saldo de créditos"
          >
            <span>{balance}</span>
            <span className="text-xs">créditos</span>
          </Link>
          <div className="flex items-center justify-between px-1">
            <span className="truncate text-xs text-muted">{email}</span>
            <form action={logoutAction}>
              <button className="cursor-pointer text-xs text-muted transition hover:text-danger" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
