// Utilitários de limpeza de texto gerado (sem emojis — o TTS lê emoji errado; e
// hashtags normalizadas para não duplicar # nem repetir).

// Remove emojis e pictogramas (mantém pontuação, acentos e símbolos comuns).
export function stripEmojis(s: string): string {
  return s
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}]/gu,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Normaliza hashtags: sem #, sem emoji, minúsculas, sem espaços, sem duplicatas. */
export function normalizeHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = stripEmojis(raw)
      .replace(/^#+/, "")
      .replace(/\s+/g, "")
      .toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
