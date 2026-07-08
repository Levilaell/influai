"use client";
import { useState, useTransition } from "react";
import { renamePersonaAction } from "@/actions/personas";

/** Nome do influenciador editável inline (herda a fonte do h1 pai). */
export function EditableName({ personaId, initial }: { personaId: string; initial: string }) {
  const [name, setName] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const n = draft.trim();
      if (!n || n === name) {
        setEditing(false);
        return;
      }
      const r = await renamePersonaAction(personaId, n);
      if (!r?.error) setName(n);
      setEditing(false);
    });

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        disabled={pending}
        maxLength={60}
        style={{ font: "inherit" }}
        className="w-full max-w-[16ch] border-b border-accent bg-transparent text-inherit outline-none"
      />
    );
  }
  return (
    <span className="group inline-flex items-center gap-2">
      {name}
      <button
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        title="Editar nome"
        className="text-base text-muted transition hover:text-accent"
      >
        ✎
      </button>
    </span>
  );
}
