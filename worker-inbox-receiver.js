// Cloudflare Email Worker — inbox-receiver
// Corrigido: extrai o corpo do email (text/plain ou text/html) antes de salvar no KV.
// Headers ARC/DKIM do Gmail nao sao mais salvos — so o corpo limpo.

function parseMimeBody(raw) {
  // Normalize line endings
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  function getHeader(block, name) {
    const re = new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\n[^\\t ]|$)`, 'im');
    const m = block.match(re);
    if (!m) return '';
    return m[1].replace(/\n[\t ]+/g, ' ').trim();
  }

  function splitBlock(block) {
    const idx = block.indexOf('\n\n');
    if (idx === -1) return { headerBlock: block, body: '' };
    return { headerBlock: block.slice(0, idx), body: block.slice(idx + 2) };
  }

  function getBoundary(headerBlock) {
    const ct = getHeader(headerBlock, 'content-type');
    const m = ct.match(/boundary=(?:"([^"]+)"|'([^']+)'|(\S+))/i);
    if (!m) return null;
    return (m[1] ?? m[2] ?? m[3]).replace(/^["']|["']$/g, '').trim();
  }

  function decodeB64(s) {
    try {
      // Cloudflare Workers supports atob() natively (it's a V8 isolate with Web APIs)
      const cleaned = s.replace(/\s/g, '');
      const bin = atob(cleaned);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch { return ''; }
  }

  function decodeQP(s) {
    return s
      .replace(/=\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => {
        try { return decodeURIComponent('%' + h); } catch { return ''; }
      });
  }

  function decodePart(body, encoding) {
    if (encoding.includes('base64')) return decodeB64(body);
    if (encoding.includes('quoted-printable')) return decodeQP(body);
    return body;
  }

  function extract(block) {
    const { headerBlock, body } = splitBlock(block);
    const ct = getHeader(headerBlock, 'content-type').toLowerCase();
    const encoding = getHeader(headerBlock, 'content-transfer-encoding').toLowerCase();
    const boundary = getBoundary(headerBlock);

    if (boundary || ct.includes('multipart/')) {
      // Fallback: scan entire text for boundary if not found in this block's headers
      const bnd = boundary ?? (() => {
        const m = text.match(/boundary=(?:"([^"]+)"|'([^']+)'|(\S+))/i);
        return m ? (m[1] ?? m[2] ?? m[3]).replace(/^["']|["']$/g, '').trim() : null;
      })();
      if (!bnd) return { html: '', plain: '' };

      const esc = bnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = body.split(new RegExp(`--${esc}(?:--)?`));
      let html = '', plain = '';
      for (const part of parts) {
        const t = part.trim();
        if (!t || t === '--') continue;
        const r = extract(t);
        if (r.html && !html) html = r.html;
        if (r.plain && !plain) plain = r.plain;
      }
      return { html, plain };
    }

    const decoded = decodePart(body, encoding).trim();
    if (ct.includes('text/html')) return { html: decoded, plain: '' };
    if (ct.includes('text/plain')) return { html: '', plain: decoded };
    return { html: '', plain: '' };
  }

  // Try structured parse first
  let result = extract(text);

  // Fallback: scan for first --boundary in the raw and parse from there
  if (!result.html && !result.plain) {
    const anyBnd = text.match(/boundary=(?:"([^"]+)"|'([^']+)'|(\S+))/i);
    if (anyBnd) {
      const bnd = (anyBnd[1] ?? anyBnd[2] ?? anyBnd[3]).replace(/^["']|["']$/g, '').trim();
      const startIdx = text.indexOf(`--${bnd}`);
      if (startIdx !== -1) {
        const esc = bnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = text.slice(startIdx).split(new RegExp(`--${esc}(?:--)?`));
        let html = '', plain = '';
        for (const part of parts) {
          const t = part.trim();
          if (!t || t === '--') continue;
          const r = extract(t);
          if (r.html && !html) html = r.html;
          if (r.plain && !plain) plain = r.plain;
        }
        result = { html, plain };
      }
    }
  }

  return result;
}

export default {
  async email(message, env, ctx) {
    try {
      const to = message.to.toLowerCase().trim();
      const from = message.from;
      const subject = message.headers.get('subject') || '(sem assunto)';
      const date = new Date().toISOString();

      // Resolve the real destination address
      let intendedFor = to;
      const deliveredTo = message.headers.get('delivered-to');
      const xOriginalTo = message.headers.get('x-original-to');
      if (deliveredTo && deliveredTo.includes('@')) {
        intendedFor = deliveredTo.toLowerCase().trim();
      } else if (xOriginalTo && xOriginalTo.includes('@')) {
        intendedFor = xOriginalTo.toLowerCase().trim();
      } else if (to.includes('+caf_=')) {
        // Gmail forwarding: to = prefix+caf_=user=domain.com@gmail.com
        // Extract "user=domain.com" and replace last = with @
        const match = to.match(/\+caf_=(.+?)@/i);
        if (match) {
          // "abusadordoamin=thesuaky.shop" -> "abusadordoamin@thesuaky.shop"
          intendedFor = match[1].replace(/=([^=]+)$/, '@$1').toLowerCase();
        }
      }

      // Read the FULL raw email (no substring truncation)
      let rawText = '';
      try {
        rawText = await new Response(message.raw).text();
      } catch (e) {
        console.error('Failed to read raw email:', e);
      }

      // Parse the MIME to extract only the body — skip headers
      const { html, plain } = parseMimeBody(rawText);
      const bodyText = html || (plain ? `<pre style="white-space:pre-wrap">${plain}</pre>` : '');

      const data = {
        from,
        subject,
        date,
        text: bodyText,       // only the parsed body, not the raw headers
        intendedFor,
      };

      // Key uses intendedFor (the real destination) so the inbox API can find it
      const key = `${intendedFor}:${Date.now()}`;
      // Store for 24h
      await env.EMAILS.put(key, JSON.stringify(data), { expirationTtl: 86400 });

    } catch (err) {
      console.error('Erro no inbox-receiver:', err);
    }
  },
};
