# curriculo-de-pretendente 💘

Site meme de página única com um objetivo muito específico: conseguir um WhatsApp.
Projeto **independente** do monorepo `influai` (não entra nos workspaces do pnpm,
não tem dependências, não afeta o build do app principal).

```
meme-site/
├── index.html      # o site inteiro (HTML + CSS + JS inline)
├── api/zap.js      # serverless function: recebe o número e manda no Telegram
├── vercel.json     # headers + cleanUrls
├── foto.jpg        # ← coloque sua foto aqui (não versionada)
└── package.json
```

## 1. Colocar a foto

Salve sua foto como `meme-site/foto.jpg`. Se o arquivo não existir, o site mostra
um placeholder listrado no lugar (não quebra).

Formato ideal: retrato, ~600×800px, até 300 KB.

A foto **precisa** estar commitada no git, senão a Vercel não tem o arquivo pra servir
(ela vai pro site público de qualquer forma, então é a mesma exposição).

## 2. Personalizar o texto

Tudo que muda está no objeto `CONFIG`, no fim do `index.html`:

```js
const CONFIG = {
  meuNome: "...",     // seu nome
  nomeDela: "...",    // nome dela (aparece no título e no hero)
  defeitos: "...",
  qualidades: [ { nome, nivel, selo, nota }, ... ],
  depoimentos: [ { estrelas, texto, quem }, ... ],
  endpoint: "/api/zap"   // "" desliga o backend (só mostra a tela de sucesso)
};
```

## 3. Criar o bot do Telegram

1. No Telegram, fale com **@BotFather** → `/newbot` → escolha nome e username.
   Ele devolve um token tipo `8123456789:AAH...`.
2. Mande qualquer mensagem pro seu bot novo (ele só pode te escrever depois disso).
3. Pegue seu chat id: abra
   `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates`
   e copie o `chat.id` (um número, pode ser negativo se for grupo).

## 4. Deploy na Vercel

Dashboard → **Add New → Project** → importe o repo `influai` e configure:

| Campo | Valor |
|---|---|
| Project Name | `curriculo-de-pretendente` |
| Root Directory | `meme-site` |
| Framework Preset | **Other** |
| Build Command | *(vazio)* |
| Output Directory | *(vazio)* |
| Install Command | *(vazio)* |

Em **Settings → Environment Variables** adicione (Production + Preview):

| Nome | Valor |
|---|---|
| `TELEGRAM_BOT_TOKEN` | o token do BotFather |
| `TELEGRAM_CHAT_ID` | seu chat id |

> As credenciais ficam **só** nas env vars da Vercel — nunca no código nem no git.

Ou por CLI, de dentro de `meme-site/`:

```bash
npx vercel link
npx vercel env add TELEGRAM_BOT_TOKEN production
npx vercel env add TELEGRAM_CHAT_ID production
npx vercel --prod
```

## 5. Testar local

```bash
cd meme-site
npx vercel dev      # sobe o site + a função /api/zap
# ou, só o front (sem backend): python3 -m http.server 8080
```

## Como funciona o envio

`POST /api/zap` com `{ whatsapp, recado, confirmacao }`:

- valida 10–13 dígitos;
- `confirmacao` é honeypot — se vier preenchido, descarta em silêncio (bot);
- monta o link `wa.me/55…` e manda no Telegram;
- sem env vars configuradas, responde `200 { entregue: false }` e só loga —
  o site continua funcionando, o número só não chega em ninguém.
