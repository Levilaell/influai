# curriculo-de-pretendente 💘

Site meme de página única com um objetivo muito específico: conseguir um WhatsApp.
Não tem relação com o produto `influai` — só mora no mesmo repositório.

```
vercel.json        # aponta o outputDirectory para meme-site/
api/zap.js         # serverless function: recebe o número e manda no Telegram
meme-site/
├── index.html     # o site inteiro (HTML + CSS + JS inline)
└── foto.jpg       # a foto
```

## Por que os arquivos estão espalhados

O seletor de Root Directory da Vercel serve uma árvore de pastas em cache e
não estava listando `meme-site/` — nem depois do merge na `main`, nem
recarregando a importação. O campo também não aceita digitação no fluxo de
importação.

A saída foi fazer a **raiz do repositório** ser o projeto Vercel, que é o
padrão (`./`) e não depende de seletor nenhum:

- `vercel.json` na raiz manda servir `meme-site/` como saída estática;
- `api/zap.js` precisa estar na raiz porque a Vercel só reconhece serverless
  functions em `api/` na raiz do projeto;
- `meme-site/` guarda só o que vai pro ar — por isso o README saiu de lá, senão
  seria servido publicamente junto com o site.

Se um dia o seletor da Vercel voltar a funcionar e você preferir isolar tudo em
`meme-site/`, é só mover `api/` e `vercel.json` pra dentro e apontar o Root
Directory pra lá.

## Deploy na Vercel

Importe o repo `influai` e **não mexa no Root Directory** — deixe `./`.

| Campo | Valor |
|---|---|
| Root Directory | `./` (padrão) |
| Framework Preset | Other |
| Build / Output / Install | deixe como está — o `vercel.json` já define |

Em **Environment Variables** (Production + Preview):

| Nome | Valor |
|---|---|
| `TELEGRAM_BOT_TOKEN` | o token do @BotFather |
| `TELEGRAM_CHAT_ID` | seu chat id |

> As credenciais ficam só nas env vars da Vercel — nunca no código nem no git.
> Env var só vale a partir do próximo deploy: depois de adicionar, faça Redeploy.

### Como pegar o chat id

1. No Telegram, fale com **@BotFather** → `/newbot` → anote o token.
2. Mande qualquer mensagem pro bot (ele só pode te escrever depois disso).
3. Abra `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates` e copie o `chat.id`.

## Personalizar

Tudo que muda está no objeto `CONFIG`, no fim do `meme-site/index.html`:

```js
const CONFIG = {
  meuNome: "Levi",
  nomeDela: "Yasmin",
  defeitos: "...",
  qualidades: [ { nome, nivel, selo, nota }, ... ],
  depoimentos: [ { estrelas, texto, quem }, ... ],
  endpoint: "/api/zap"   // "" desliga o backend (só mostra a tela de sucesso)
};
```

Pra trocar a foto, substitua `meme-site/foto.jpg`. Se o arquivo não existir, o
site mostra um placeholder listrado — não quebra.

## Testar local

```bash
npx vercel dev          # site + função /api/zap
python3 -m http.server 8080 --directory meme-site   # só o front, sem backend
```

## Como funciona o envio

`POST /api/zap` com `{ whatsapp, recado, confirmacao }`:

- valida 10 a 13 dígitos;
- `confirmacao` é honeypot — se vier preenchido, descarta em silêncio (bot);
- monta o link `wa.me/55…` e manda no Telegram;
- o número exibido é formatado a partir dos dígitos já extraídos, nunca do
  texto cru, senão uma crase no input quebraria o `parse_mode: Markdown` e o
  envio falharia;
- sem env vars configuradas, responde `200 { entregue: false }` e só loga — o
  site continua funcionando, o número só não chega em ninguém.
