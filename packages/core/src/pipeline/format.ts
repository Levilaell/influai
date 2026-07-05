// Objetivo (pra quê o vídeo serve) + Formato (a estrutura). Juntos moldam o roteiro.
// São injetados no prompt de geração; o roteiro resultante já os incorpora.
export type Objective = "engajar" | "vender" | "educar" | "entreter";

// O OBJETIVO define o CONTEÚDO e a ESTRUTURA do roteiro (absorve o antigo "formato").
export const OBJECTIVES: { key: Objective; label: string; guide: string; ideaHint: string }[] = [
  {
    key: "engajar", label: "Engajar / crescer",
    guide: "OBJETIVO: máximo engajamento (conteúdo de influenciador). Gancho forte nos 2 primeiros segundos, ritmo rápido, curiosidade constante. CTA de seguir/comentar.",
    ideaHint: "ideias virais de alto engajamento (listicles, mito x verdade, erro comum, opinião polêmica).",
  },
  {
    key: "vender", label: "Vender / promover",
    guide: "OBJETIVO: promover o produto/serviço da marca. Estrutura de anúncio: problema -> solução -> benefício/prova -> CTA de compra. Produto em destaque, desejo, CTA claro (compra ou link na bio).",
    ideaHint: "ideias que promovem o produto/serviço (demonstração, antes e depois, objeções, oferta).",
  },
  {
    key: "educar", label: "Educar / explicar",
    guide: "OBJETIVO: ensinar, explicar ou refletir sobre um tema, com clareza e autoridade. Pode ser (a) passo a passo/lista didática OU (b) uma explicação ou reflexão sobre um conceito ou pergunta (ex: 'por que X?', 'o que significa Y?', 'você já parou pra pensar em Z?'). Tom didático ou pessoal e reflexivo, conforme o assunto. Em vídeos longos, desenvolva com profundidade. CTA de salvar/seguir/pensar junto.",
    ideaHint: "ideias educativas OU explicativas/reflexivas (tutoriais, dicas, 'por que...', 'o que significa...', reflexões sobre um tema).",
  },
  {
    key: "entreter", label: "Entreter",
    guide: "OBJETIVO: entreter e gerar compartilhamento. Humor leve ou storytelling, tom descontraído. CTA de marcar um amigo/compartilhar.",
    ideaHint: "ideias de entretenimento (humor, storytime, bastidores, POV).",
  },
];

export function objectiveIdeaHint(key: string | undefined): string {
  return OBJECTIVES.find((o) => o.key === key)?.ideaHint ?? "";
}

export function objectiveGuide(key: string | undefined): string {
  return OBJECTIVES.find((o) => o.key === key)?.guide ?? "";
}

// Duração do vídeo → nº de blocos de fala (shots) e de segmentos (takes).
// Vídeo longo = vários takes concatenados (Kling não faz 60-90s num take só).
export type Length = "curto" | "medio" | "longo";
export const LENGTHS: { key: Length; label: string; shots: number; segments: number; guide: string }[] = [
  { key: "curto", label: "Curto (~20s)", shots: 4, segments: 1, guide: "" },
  {
    key: "medio", label: "Médio (~60s)", shots: 9, segments: 3,
    guide: "DURAÇÃO: vídeo mais longo (~60s). Desenvolva o tema com profundidade em seções encadeadas, mantendo a retenção com micro-ganchos entre os blocos.",
  },
  {
    key: "longo", label: "Longo (~90s)", shots: 15, segments: 5,
    guide: "DURAÇÃO: vídeo longo (~90s). Estruture como abertura -> várias seções aprofundadas -> fecho, com micro-ganchos entre os blocos para segurar a retenção.",
  },
];

export function lengthSpec(key: string | undefined): { shots: number; segments: number; guide: string } {
  const l = LENGTHS.find((x) => x.key === key) ?? LENGTHS[0];
  return { shots: l.shots, segments: l.segments, guide: l.guide };
}
