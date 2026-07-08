// Tudo de geração roda na WaveSpeed (imagem nano-banana-2, take InfiniteTalk,
// b-roll wan-2.2). O Atlas foi aposentado — só sobrou o downloadToBuffer (fetch
// genérico) que mora em atlas.ts por histórico.
export { downloadToBuffer } from "./atlas.ts";
export { wavespeedImage as genImage, wavespeedAvatarSubmit, wavespeedResultUrl, wavespeedVideoFromImage } from "./wavespeed.ts";
export { elevenLabsTTS, resolveVoiceId } from "./elevenlabs.ts";

// Mídia que os providers precisam buscar (áudio/keyframe) é hospedada no R2 via
// presigned URL (worker/assets.ts hostBuffer) — sem túnel nem storage de terceiro.
