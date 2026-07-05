// Kit mínimo de UI (Tailwind puro, tema dark+lime da marca).
import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary:
      "bg-accent text-accent-ink font-bold hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed",
    ghost: "border border-line text-ink hover:border-accent",
    danger: "border border-danger/50 text-danger hover:bg-danger/10",
  }[variant];
  return (
    <button
      className={`rounded-full px-6 py-2.5 text-sm transition cursor-pointer ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent placeholder:text-muted ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm text-ink outline-none transition focus:border-accent placeholder:text-muted ${props.className ?? ""}`}
    />
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </label>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-bg-soft p-6 ${className}`}>{children}</div>
  );
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-2 text-sm text-danger">{children}</p>;
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "danger" | "ok";
}) {
  const styles = {
    muted: "border-line text-muted",
    accent: "border-accent/40 text-accent",
    danger: "border-danger/40 text-danger",
    ok: "border-accent/40 text-accent",
  }[tone];
  return (
    <span className={`inline-block rounded-full border px-3 py-0.5 text-xs ${styles}`}>{children}</span>
  );
}
