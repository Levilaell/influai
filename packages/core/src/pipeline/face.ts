// Estilo do rosto da persona: realista (padrão) ou animado 3D (estilo Pixar).
// Usado de forma consistente na geração de rostos, character sheet e keyframe do vídeo.
export type FaceStyle = "realista" | "animado";

export function faceStyle(style: string | undefined): {
  render: string; // termo de renderização p/ o prompt de imagem
  texture: string; // textura/acabamento
} {
  if (style === "animado") {
    return {
      render: "3D animated character, Pixar and Disney animation style, stylized 3D render, cinematic lighting",
      texture: "smooth stylized 3D shading, expressive large friendly eyes, charming, appealing",
    };
  }
  return {
    render: "photorealistic",
    texture: "ultra realistic skin texture",
  };
}

export const FACE_STYLES: { key: FaceStyle; label: string; hint: string }[] = [
  { key: "realista", label: "Realista", hint: "pessoa fotorrealista" },
  { key: "animado", label: "Animado 3D", hint: "personagem estilo Pixar" },
];
