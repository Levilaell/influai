"use client";
// Cérebro da Marca: captura contexto do negócio por PRINT ou TEXTO (caminho C).
// Aparece na persona pronta; alimenta o motor de ideias na Fábrica.
import { useRef, useState, useTransition } from "react";
import { captureBrandAction, updateBrandProfileAction } from "@/actions/brand";
import type { BrandProfile } from "@influa/core/brand/index";
import { Badge, Button, Card, ErrorText, Input, Label, Textarea } from "@/components/ui";

// Reduz o print no browser antes de enviar (Claude lê bem a 1024px; payload leve)
function downscale(file: File, maxW = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function BrandBrain({
  brandId,
  initial,
}: {
  brandId: string;
  initial: BrandProfile | null;
}) {
  const [profile, setProfile] = useState<BrandProfile | null>(initial);
  // "view" = mostra os campos; "fields" = edita à mão; "recapture" = novo print/texto
  const [view, setView] = useState<"view" | "fields" | "recapture">(initial ? "view" : "recapture");
  const [mode, setMode] = useState<"print" | "texto">("print");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const url = await downscale(f);
    setDataUrl(url);
    setPreview(url);
  };

  const capture = () =>
    start(async () => {
      setError(undefined);
      const r = await captureBrandAction(brandId, {
        imageDataUrl: mode === "print" ? dataUrl ?? undefined : undefined,
        text: mode === "texto" ? text : undefined,
      });
      if (r.error) return setError(r.error);
      setProfile(r.profile!);
      setView("view");
    });

  // ── Ver (com botões editar / re-analisar) ──
  if (profile && view === "view") {
    return (
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Cérebro da Marca</h3>
          <div className="flex items-center gap-3">
            <Badge tone={profile.confidence === "alta" ? "ok" : profile.confidence === "baixa" ? "danger" : "accent"}>
              confiança {profile.confidence}
            </Badge>
            <button onClick={() => setView("fields")} className="text-xs text-muted hover:text-accent">
              editar
            </button>
            <button onClick={() => setView("recapture")} className="text-xs text-muted hover:text-accent">
              re-analisar
            </button>
          </div>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <Field label="Negócio" value={profile.business} />
          <Field label="Público" value={profile.audience} />
          <Field label="Proposta" value={profile.value_proposition} />
          <Field label="Tom" value={profile.tone} />
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-muted">Pilares de conteúdo</p>
          <div className="flex flex-wrap gap-2">
            {profile.content_pillars.map((p) => (
              <Badge key={p}>{p}</Badge>
            ))}
          </div>
        </div>
        {profile.notes && (
          <p className="rounded-xl border border-line bg-bg px-3 py-2 text-xs text-muted">{profile.notes}</p>
        )}
      </Card>
    );
  }

  // ── Editar os campos à mão (o que faltava) ──
  if (profile && view === "fields") {
    return <FieldsEditor brandId={brandId} profile={profile} onSaved={(p) => { setProfile(p); setView("view"); }} onCancel={() => setView("view")} />;
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Cérebro da Marca</h3>
        <p className="mt-1 text-sm text-muted">
          Ensine a IA sobre o negócio uma vez — depois ela sugere os temas dos vídeos pra você.
        </p>
      </div>

      <div className="flex gap-2">
        <TabBtn active={mode === "print"} onClick={() => setMode("print")}>
          Print do perfil
        </TabBtn>
        <TabBtn active={mode === "texto"} onClick={() => setMode("texto")}>
          Colar texto
        </TabBtn>
      </div>

      {mode === "print" ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg py-8 text-sm text-muted transition hover:border-accent"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="print" className="max-h-48 rounded-lg" />
            ) : (
              <>
                <span className="text-2xl text-muted">+</span>
                Clique para enviar um print do Instagram, TikTok, site...
              </>
            )}
          </button>
          <p className="mt-1.5 text-xs text-muted">
            Serve print de qualquer rede — a bio e os posts já bastam. Nada é publicado.
          </p>
        </div>
      ) : (
        <div>
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Cole a bio + suas melhores legendas, ou descreva o negócio:\n\n"Studio de pilates na Zona Sul, foco em dor nas costas e postura. Aulas em grupo reduzido..."`}
          />
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button onClick={capture} disabled={pending || (mode === "print" ? !dataUrl : text.trim().length < 15)}>
          {pending ? "Lendo o material..." : "Analisar"}
        </Button>
        {profile && (
          <Button variant="ghost" onClick={() => setView("view")}>
            Cancelar
          </Button>
        )}
      </div>
    </Card>
  );
}

// Edição manual dos campos do Cérebro (ex: só remover uma palavra).
function FieldsEditor({
  brandId,
  profile,
  onSaved,
  onCancel,
}: {
  brandId: string;
  profile: BrandProfile;
  onSaved: (p: BrandProfile) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    business: profile.business,
    audience: profile.audience,
    value_proposition: profile.value_proposition,
    tone: profile.tone,
    pillars: profile.content_pillars.join(", "),
    notes: profile.notes ?? "",
  });
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = () =>
    start(async () => {
      setError(undefined);
      const r = await updateBrandProfileAction(brandId, {
        business: f.business,
        audience: f.audience,
        value_proposition: f.value_proposition,
        tone: f.tone,
        content_pillars: f.pillars.split(","),
        notes: f.notes,
      });
      if (r.error) return setError(r.error);
      onSaved(r.profile!);
    });

  return (
    <Card className="space-y-4">
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Editar o Cérebro</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Negócio</Label>
          <Textarea rows={2} value={f.business} onChange={set("business")} />
        </div>
        <div>
          <Label>Público</Label>
          <Textarea rows={2} value={f.audience} onChange={set("audience")} />
        </div>
        <div>
          <Label>Proposta</Label>
          <Textarea rows={2} value={f.value_proposition} onChange={set("value_proposition")} />
        </div>
        <div>
          <Label>Tom</Label>
          <Textarea rows={2} value={f.tone} onChange={set("tone")} />
        </div>
      </div>
      <div>
        <Label>Pilares de conteúdo (separados por vírgula)</Label>
        <Input value={f.pillars} onChange={set("pillars")} />
      </div>
      <div>
        <Label>Notas</Label>
        <Textarea rows={2} value={f.notes} onChange={set("notes")} />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${
        active ? "border-accent text-accent" : "border-line text-muted hover:border-accent/40"
      }`}
    >
      {children}
    </button>
  );
}
