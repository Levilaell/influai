# Protótipo — Pipeline de Influenciador de IA

Gera um vídeo curto vertical (9:16) completo a partir de um tema, com **personagem consistente entre vídeos** (Persona Lock) e **fala determinística** (TTS palavra-a-palavra), pronto pra postar.

**Modo padrão (`avatar`)** — validado em 2026-07-02:

```
persona (1x) → roteiro → keyframe de cena → narração → avatar → legendas
 Nano Banana    Claude    Nano Banana       ElevenLabs  Kling     FFmpeg
   2 /edit                  2 /edit          (Matilda)  v2.6 pro
```

Por que avatar é o padrão: o áudio nativo dos modelos de vídeo (Veo) é *generativo* —
inventa palavras e troca de idioma em PT-BR. TTS lê o roteiro exato, a voz é a mesma
em todos os vídeos da persona (voice_id fixo), e o take contínuo elimina gestos
"pulando" entre cortes. Modos `native`/`tts` continuam disponíveis para B-roll/testes.

## Pré-requisitos

- Node.js 20+
- FFmpeg no PATH (`sudo apt install ffmpeg` — com libass para legendas)
- Conta na [fal.ai](https://fal.ai) com créditos (`FAL_KEY`)
- Chave da [Anthropic](https://platform.claude.com) (`ANTHROPIC_API_KEY`)

## Setup

```bash
cd prototype
npm install
cp .env.example .env   # preencha as chaves do seu provedor
```

### Provedores suportados

| | Atlas Cloud | fal.ai |
|---|---|---|
| Chave | `ATLAS_API_KEY` | `FAL_KEY` |
| Roteiro | LLM do Atlas (ou Claude, se tiver `ANTHROPIC_API_KEY`) | Claude (`ANTHROPIC_API_KEY` obrigatória) |
| Selecionar | `PROVIDER=atlas` | `PROVIDER=fal` |

**Usando Atlas Cloud** (se você já tem créditos lá): os IDs de modelo variam por conta.
Antes do primeiro vídeo, descubra os IDs disponíveis e ajuste o `.env` se necessário:

```bash
node discover-atlas.js          # lista veo/nano-banana/kling/elevenlabs da sua conta
node discover-atlas.js kling    # filtro customizado
```

Defaults assumidos: `nano-banana-2` (imagem), `veo-3.1-fast` (vídeo), `elevenlabs-v3` (tts),
`deepseek-v4` (roteiro fallback). Sobrescreva com `ATLAS_IMAGE_MODEL=` etc.

## Uso

```bash
# Primeiro vídeo (cria a persona + gera o vídeo)
node pipeline.js \
  --persona "Lia" \
  --descricao "young brazilian woman, mid 20s, wavy brown hair, brown eyes, warm smile" \
  --nicho "curiosidades de tecnologia" \
  --tema "3 apps de IA que parecem ilegais de tão bons"

# Segundo vídeo — MESMA persona, mesmo rosto, tema novo (character sheet é grátis)
node pipeline.js --persona "Lia" --tema "o golpe do Pix que ninguém percebe" --yes
```

Flags:

| Flag | Default | Descrição |
|---|---|---|
| `--persona` | `Lia` | Nome da persona (reutilizada se já existir em `personas/`) |
| `--descricao` | — | Aparência física (em inglês, só no 1º uso) |
| `--nicho` | — | Nicho de conteúdo da persona |
| `--tema` | — | Tema deste vídeo |
| `--shots` | `4` | Nº de "cenas" do roteiro (no modo avatar viram blocos de legenda) |
| `--segundos` | `8` | Duração de cada shot (modos native/tts) |
| `--mode` | `avatar` | `avatar` = TTS + Kling lip-sync (fala exata) · `native` = áudio do Veo (pode inventar palavras) · `tts` = legado |
| `--voz` | `matilda` | Voz da persona: matilda, sarah, jessica, charlie, liam ou voice_id da ElevenLabs |
| `--yes` | — | Pula a confirmação de custo |

## Custo por vídeo (Atlas Cloud, validado 2026-07-02)

Modo **avatar** (padrão), narração de ~20s:

| Item | padrão (Kling std) | cinema (Kling pro) |
|---|---|---|
| Persona (só no 1º vídeo) | $0.32 | $0.32 |
| Roteiro (Claude) | ~$0.03 | ~$0.03 |
| Keyframe de cena (1×) | $0.08 | $0.08 |
| Take avatar (20s) | $0.96 | $1.90 |
| Voz (ElevenLabs, conta própria) | ~$0.04 | ~$0.04 |
| **Total (vídeos seguintes)** | **~$1.10 (~R$6)** | **~$2.05 (~R$11)** |

A/B validado: std (720p) ≈ pro (1072p) em qualidade percebida no celular.
Modo `native` (Veo multi-shot, 4×8s): ~$3.00 — usar só para B-roll.

O pipeline mostra a estimativa **antes** de gastar e pede confirmação.

## Saída

```
output/<timestamp>/
├── script.json      # roteiro + shot list
├── shots/           # clipes individuais
├── captions.srt     # legendas
├── final.mp4        # vídeo pronto pra postar
└── manifest.json    # auditoria (config, custos, URLs, tempo)

personas/<slug>.json # Persona Lock (character sheet reutilizável)
```

## Limitações conhecidas (v2 no SaaS)

- Modo `tts` não faz lip-sync (adicionar sync.so ou Kling lip-sync)
- Timing das legendas é aproximado (usar whisper para alinhar no SaaS)
- Execução sequencial (no SaaS, keyframes/shots rodam em paralelo via fila de jobs — ver `docs/jobs-architecture.md`)
- Sem moderação de conteúdo (obrigatório no SaaS: bloquear rosto de pessoa real, NSFW)
