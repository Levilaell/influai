"use client";
// Presets de identidade visual — pra quem não quer digitar a aparência. Clicar preenche
// o campo de descrição. (O gênero é uma dica visual; a voz continua escolhida pelo usuário.)
const PRESETS: { label: string; look: string }[] = [
  { label: "👩 Jovem casual", look: "mulher brasileira, cerca de 25 anos, cabelo castanho ondulado, sorriso caloroso, estilo casual moderno, luz natural" },
  { label: "👨 Jovem descolado", look: "homem brasileiro, cerca de 28 anos, barba curta, estilo urbano descolado, expressão confiante, luz natural" },
  { label: "👩‍💼 Executiva", look: "mulher brasileira, cerca de 35 anos, cabelo liso, blazer, ar profissional, ambiente de escritório iluminado" },
  { label: "👨‍💼 Maduro confiável", look: "homem brasileiro, cerca de 40 anos, cabelo levemente grisalho, camisa social, ar experiente e confiável" },
  { label: "🏋️ Fitness", look: "mulher brasileira, cerca de 27 anos, cabelo preso, roupa esportiva, energia e vitalidade, ambiente de academia" },
  { label: "🎨 Criativo", look: "homem brasileiro, cerca de 30 anos, óculos, camiseta, ambiente criativo de estúdio, expressão simpática" },
];

export function IdentityPresets() {
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => {
            const t = document.getElementById("description") as HTMLTextAreaElement | null;
            if (t) {
              t.value = p.look;
              t.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }}
          className="rounded-full border border-line px-3 py-1.5 text-xs transition hover:border-accent"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
