"use client";
// Recursos da marca: logo e produtos que podem aparecer na CENA do vídeo.
import { useRef, useState, useTransition } from "react";
import { uploadBrandAssetAction, deleteBrandAssetAction, type BrandAsset } from "@/actions/brand";
import { Button, Card, ErrorText, Input } from "@/components/ui";

function downscale(file: File, maxW = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function BrandResources({ brandId, initial }: { brandId: string; initial: BrandAsset[] }) {
  const [assets, setAssets] = useState<BrandAsset[]>(initial);
  const [kind, setKind] = useState("product");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(undefined);
    const dataUrl = await downscale(f);
    start(async () => {
      const r = await uploadBrandAssetAction(brandId, { imageDataUrl: dataUrl, kind, label });
      if (r.error) return setError(r.error);
      setAssets((a) => [...a, r.asset!]);
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const remove = (id: string) =>
    start(async () => {
      await deleteBrandAssetAction(id);
      setAssets((a) => a.filter((x) => x.id !== id));
    });

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Recursos da marca</h3>
          <p className="mt-1 text-sm text-muted">
            Suba o <b className="text-ink">logo</b> e fotos dos seus <b className="text-ink">produtos</b>. Ao criar um
            vídeo, você escolhe quais aparecem na cena — a IA compõe o produto na mão da persona ou no ambiente,
            mantendo a marca fiel.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted">Tipo</p>
            <div className="flex gap-2">
              {[
                { v: "product", l: "Produto" },
                { v: "logo", l: "Logo" },
                { v: "cenario", l: "Cenário (seu espaço)" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setKind(o.v)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    kind === o.v ? "border-accent text-accent" : "border-line text-muted hover:border-accent/40"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-40">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted">Rótulo (ajuda a IA)</p>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: café em grão 250g" />
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button onClick={() => fileRef.current?.click()} disabled={pending}>
            {pending ? "Enviando..." : "Enviar imagem"}
          </Button>
        </div>
        <ErrorText>{error}</ErrorText>
        <p className="text-xs text-muted">Fundo neutro/limpo funciona melhor. Nada é publicado.</p>
      </Card>

      {assets.length === 0 ? (
        <Card className="py-10 text-center text-muted">Nenhum recurso ainda.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {assets.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-2xl border border-line bg-bg-soft">
              <div className="aspect-square w-full bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.label} className="h-full w-full object-contain" />
              </div>
              <div className="flex items-center justify-between p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{a.label || (a.kind === "logo" ? "Logo" : "Produto")}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">{a.kind}</div>
                </div>
                <button onClick={() => remove(a.id)} className="text-xs text-muted transition hover:text-danger">
                  apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
