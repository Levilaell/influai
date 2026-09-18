// Recebe o WhatsApp e manda pro Telegram.
//
// Fica na raiz do repo, e não em meme-site/, porque a Vercel só reconhece
// serverless functions em api/ na raiz do projeto — e o Root Directory do
// projeto é a raiz (ver vercel.json, que aponta o outputDirectory para
// meme-site/).
//
// Env vars necessárias na Vercel: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, erro: 'method_not_allowed' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const { whatsapp = '', recado = '', confirmacao = '' } = body;

  // honeypot: bot preencheu o campo invisível
  if (confirmacao) return res.status(200).json({ ok: true });

  const digitos = String(whatsapp).replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 13) {
    return res.status(400).json({ ok: false, erro: 'numero_invalido' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // sem credenciais configuradas: não quebra o site, só registra no log
  if (!token || !chatId) {
    console.warn('[zap] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID ausentes. Número recebido:', digitos);
    return res.status(200).json({ ok: true, entregue: false });
  }

  const wa = digitos.length >= 12 ? digitos : '55' + digitos;

  // formata a partir dos dígitos, nunca do texto cru: evita que backtick ou
  // asterisco no input quebre o parse_mode Markdown e derrube o envio
  const nacional = digitos.length > 11 ? digitos.slice(-11) : digitos;
  const bonito = nacional.length === 11
    ? `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`
    : `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;

  const texto = [
    '🚨 *DEU CERTO, IRMÃO* 🚨',
    '',
    '📱 WhatsApp: `' + bonito + '`',
    '🔗 Abrir: https://wa.me/' + wa,
    recado ? '\n💬 Recadinho dela:\n_' + String(recado).slice(0, 300).replace(/[_*[\]`]/g, '') + '_' : '\n💬 Sem recadinho.',
    '',
    '🕐 ' + new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    '',
    'Agora não estraga. Respira, espera 20 minutos e manda algo normal.'
  ].join('\n');

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });

    if (!r.ok) {
      const detalhe = await r.text();
      console.error('[zap] telegram respondeu', r.status, detalhe);
      return res.status(502).json({ ok: false, erro: 'telegram_falhou' });
    }

    return res.status(200).json({ ok: true, entregue: true });
  } catch (err) {
    console.error('[zap] erro ao chamar telegram:', err);
    return res.status(502).json({ ok: false, erro: 'telegram_indisponivel' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
