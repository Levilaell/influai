# Vídeo — automação de canhotos (distribuidoras / transportadoras)

Criativo vertical 1080×1920, ~54 s, 30 fps, para Reels, TikTok, Shorts, Status e anúncios.
Tudo é gerado por código, sem banco de imagens e sem API paga.

| Etapa | Arquivo | Ferramenta |
|---|---|---|
| Narração (PT-BR) + tempo de cada frase | `voice.py` → `voice.wav`, `timeline.json` | Kokoro TTS (voz `pm_alex`) |
| Animação (motion graphics) | `scene.html` + `render.js` → `video_noaudio.mp4` | HTML/CSS/JS + Playwright + ffmpeg |
| Trilha, efeitos e mixagem com ducking | `audio.py` → `mix.wav` | numpy (sintetizado) |
| Montagem final (−14 LUFS) | ver abaixo | ffmpeg |

## Regerar

```bash
pip install kokoro-onnx soundfile numpy
mkdir -p models && cd models
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
cd ..
python3 voice.py          # altere o roteiro em CHUNKS
python3 audio.py
node render.cjs full video_noaudio.mp4
ffmpeg -i video_noaudio.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k \
  -af loudnorm=I=-14:TP=-1:LRA=11 -shortest -movflags +faststart canhotos.mp4
```

Prévia de quadros soltos: `node render.cjs preview <pasta> 2.5 13.5 30`.

O roteiro fica em `voice.py` (`CHUNKS`: cena, texto falado, legenda). As cenas se
ajustam sozinhas ao tempo da narração. Palavras estrangeiras são escritas
foneticamente no texto falado ("uótsapi").
