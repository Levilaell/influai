export { atlasAvatar as genAvatar, downloadToBuffer, atlasSubmitAndPoll, atlasUploadMedia } from "./atlas.ts";
// Geração de imagem agora no WaveSpeed (mesmo nano-banana-2, mais barato e elástico).
export { wavespeedImage as genImage } from "./wavespeed.ts";
export { elevenLabsTTS, resolveVoiceId } from "./elevenlabs.ts";

// Áudio e imagens que o Atlas precisa buscar sobem para o storage do próprio
// Atlas via atlasUploadMedia (em ./atlas.ts) — robusto, sem túnel nem host de
// terceiro. Os antigos uploadPublicFallback/hasPublicBaseUrl foram removidos.
