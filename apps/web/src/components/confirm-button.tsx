"use client";
// Botão destrutivo com confirmação INLINE (2 cliques) — sem o window.confirm nativo.
// 1º clique arma ("Confirmar?"), 2º executa; reseta sozinho em 3,5s.
import { useState, useTransition } from "react";

export function ConfirmButton({
  onConfirm,
  confirm,
  children,
  className = "",
  pendingLabel = "...",
}: {
  onConfirm: () => Promise<unknown>;
  confirm: string;
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={confirm}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!armed) {
          setArmed(true);
          setTimeout(() => setArmed(false), 3500);
          return;
        }
        setArmed(false);
        start(async () => {
          await onConfirm();
        });
      }}
      className={`cursor-pointer disabled:opacity-50 ${armed ? "font-semibold text-danger" : ""} ${className}`}
    >
      {pending ? pendingLabel : armed ? "Confirmar?" : children}
    </button>
  );
}
