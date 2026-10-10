const ALLOWED_ORIGINS = new Set([
  'https://alacka27.github.io',
  'http://127.0.0.1:8080',
  'http://localhost:8080'
]);

const WEBHOOK_BY_SERVICE = {
  build: 'DISCORD_WEBHOOK_BUILD',
  gui: 'DISCORD_WEBHOOK_GUI',
  script: 'DISCORD_WEBHOOK_SCRIPT',
  other: 'DISCORD_WEBHOOK_OTHER'
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, origin);
    }

    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > 4000) {
      return jsonResponse({ error: 'Request too large' }, 413, origin);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
    }

    const service = typeof data.service === 'string' ? data.service : '';
    const content = typeof data.content === 'string' ? data.content.trim() : '';
    const secretName = WEBHOOK_BY_SERVICE[service];
    const webhook = secretName && env[secretName];

    if (!secretName || !content || content.length > 3000) {
      return jsonResponse({ error: 'Invalid request' }, 400, origin);
    }
    if (!webhook) {
      return jsonResponse({ error: 'Webhook is not configured' }, 503, origin);
    }

    const discordResponse = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Заявка с сайта Alacka',
        content,
        allowed_mentions: { parse: [] }
      })
    });

    if (!discordResponse.ok && discordResponse.status !== 204) {
      return jsonResponse({ error: 'Discord rejected the request' }, 502, origin);
    }
    return jsonResponse({ ok: true }, 200, origin);
  }
};
