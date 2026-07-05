// Estilo do vídeo — escolhido pelo usuário na Fábrica (sem surpresas).
//  - scene: ambiente da cena (label + prompt em inglês) — específico DA MARCA
//  - music: trilha de fundo (mixada com ducking sob a voz)
//  - broll: corte curto de imagem em movimento sobre a fala
// Trilhas reais (assets/music/<key>.mp3, normalizadas a -16 LUFS). Origem dos arquivos:
//  inspirador=atlasaudio-inspiring · documentario=joyinsound-motivational-documentary
//  funk=lightbeatsmusic-joyful-funk · ambiente=nastelbom-background
//  hiphop/2/3=bombinsound-hip-hop (3 versões)
export type Music = "none" | "inspirador" | "documentario" | "funk" | "ambiente" | "hiphop" | "hiphop2" | "hiphop3";
// sceneRefKey: foto do espaço REAL da marca usada como referência de cenário.
export type VideoStyle = { sceneLabel: string; scenePrompt: string; sceneRefKey: string; music: Music; broll: boolean };

export const DEFAULT_STYLE: VideoStyle = {
  sceneLabel: "Automático", scenePrompt: "", sceneRefKey: "", music: "none", broll: false,
};

const MUSIC_KEYS: Music[] = ["none", "inspirador", "documentario", "funk", "ambiente", "hiphop", "hiphop2", "hiphop3"];

export function normalizeStyle(raw: any): VideoStyle {
  const music: Music = MUSIC_KEYS.includes(raw?.music) ? raw.music : "none";
  return {
    sceneLabel: typeof raw?.sceneLabel === "string" ? raw.sceneLabel.slice(0, 60) : "Automático",
    scenePrompt: typeof raw?.scenePrompt === "string" ? raw.scenePrompt.slice(0, 400) : "",
    sceneRefKey: typeof raw?.sceneRefKey === "string" ? raw.sceneRefKey.slice(0, 300) : "",
    music,
    broll: raw?.broll === true,
  };
}

// Cenários genéricos de reserva — usados quando a marca ainda não tem cenários
// próprios gerados (ex: sem Cérebro). Seguros para qualquer nicho.
export const FALLBACK_SCENES: { label: string; prompt: string }[] = [
  { label: "Automático", prompt: "" },
  { label: "Estúdio neutro", prompt: "clean minimal studio, soft gradient backdrop, professional key light" },
  { label: "Ambiente aconchegante", prompt: "cozy warm interior, soft lighting, tasteful decor softly blurred behind" },
  { label: "Externa natural", prompt: "outdoor natural daylight, soft bokeh background" },
];

// preview: arquivo servido em /music-previews/<key>.mp3 (none não tem)
export const MUSIC_OPTIONS: { key: Music; label: string }[] = [
  { key: "none", label: "Sem música" },
  { key: "inspirador", label: "Inspiradora" },
  { key: "documentario", label: "Documentário" },
  { key: "funk", label: "Funk alegre" },
  { key: "ambiente", label: "Ambiente" },
  { key: "hiphop", label: "Hip-hop" },
  { key: "hiphop2", label: "Hip-hop 2" },
  { key: "hiphop3", label: "Hip-hop 3" },
];
