/**
 * qwen edit
 * Creator: IzzXd
 * Base: https://prithivmlmods-qwen-image-edit-object-manipulator.hf.space
 * Saluran: https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K
 * Note: JANGAN HAPUS WM, HARGAIN YANG SCRAPE
 */
import https from 'https';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const BASE = 'https://prithivmlmods-qwen-image-edit-object-manipulator.hf.space';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36';
const PROXY_API = 'https://api.ikyyxd.my.id/v2l/proxy-free/ikyy-xsample';

const WM = {
  Creator: 'IzzXd',
  Saluran: 'https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K'
};

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

let proxies = [];
let proxyIndex = 0;
let proxyReady = false;
let defaultLora = null;

class QuotaError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'QuotaError';
  }
}

function mimeFromBuffer(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return 'image/png';
}

function decodeDataUrl(str) {
  const m = str.match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
  if (m) return { buffer: Buffer.from(m[2], 'base64'), mime: m[1] };
  const buffer = Buffer.from(str, 'base64');
  return { buffer, mime: mimeFromBuffer(buffer) };
}

async function fetchConfig() {
  const r = await axios.get(BASE + '/api/config', {
    headers: { 'User-Agent': UA },
    timeout: 15000
  });
  const loras = r.data && r.data.loras;
  if (loras && loras.length) {
    defaultLora = loras[0];
  } else {
    defaultLora = 'Qwen-Image-Edit-2511-Object-Adder';
  }
}

async function fetchProxies() {
  if (proxyReady && proxies.length) return;
  const res = await axios.get(PROXY_API, { timeout: 10000 });
  if (!Array.isArray(res.data)) throw new Error('Format proxy tidak valid');
  proxies = res.data.filter(function (p) {
    return typeof p === 'string' && p.split(':').length === 4;
  });
  proxyReady = true;
}

function rotateProxy() {
  if (proxies.length) proxyIndex = (proxyIndex + 1) % proxies.length;
}

function currentProxy() {
  if (!proxies.length) return null;
  const p = proxies[proxyIndex];
  const parts = p.split(':');
  if (parts.length !== 4) return null;
  return {
    host: parts[0],
    port: parseInt(parts[1], 10),
    auth: { username: parts[2], password: parts[3] },
    protocol: 'http'
  };
}

function proxyAgent() {
  if (!proxies.length) return null;
  const p = proxies[proxyIndex];
  const parts = p.split(':');
  if (parts.length !== 4) return null;
  const agentUrl = 'http://' + parts[2] + ':' + parts[3] + '@' + parts[0] + ':' + parts[1];
  try {
    return new HttpsProxyAgent(agentUrl);
  } catch (e) {
    return null;
  }
}

async function callEdit(b64, prompt, useProxy) {
  const payload = {
    data: [
      JSON.stringify([b64]),
      prompt,
      defaultLora,
      0,
      true,
      1.0,
      8
    ]
  };

  const cfg = {
    method: 'post',
    url: BASE + '/gradio_api/call/edit_image',
    data: payload,
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      'Origin': BASE,
      'Referer': BASE + '/'
    },
    timeout: 60000,
    proxy: false
  };

  if (useProxy) {
    const pc = currentProxy();
    if (pc) cfg.proxy = pc;
  }

  const r = await axios(cfg);
  const eventId = (r.data && r.data.event_id) || r.data;

  if (!eventId || typeof eventId !== 'string') {
    throw new Error('event_id invalid: ' + JSON.stringify(r.data).slice(0, 200));
  }

  return eventId;
}

function pollResult(eventId, useProxy) {
  return new Promise(function (resolve, reject) {
    if (!eventId || typeof eventId !== 'string') {
      return reject(new Error('eventId bukan string: ' + eventId));
    }

    const full = BASE + '/gradio_api/call/edit_image/' + encodeURIComponent(eventId);
    let urlObj;
    try {
      urlObj = new URL(full);
    } catch (e) {
      return reject(new Error('Invalid URL saat poll: ' + full));
    }

    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/event-stream',
        'Origin': BASE,
        'Referer': BASE + '/'
      }
    };

    if (useProxy && proxies.length) {
      const agent = proxyAgent();
      if (agent) opts.agent = agent;
    }

    const req = https.request(opts, function (res) {
      let buf = '';
      let lastEvent = '';

      res.on('data', function (chunk) {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop();

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.indexOf('event: ') === 0) {
            lastEvent = line.slice(7).trim();
            continue;
          }

          if (line.indexOf('data: ') !== 0) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const j = JSON.parse(raw);
            const errMsg = (j && (j.error || j.message)) || '';

            if (String(errMsg).toLowerCase().indexOf('quota') !== -1) {
              return reject(new QuotaError(errMsg));
            }
            if (errMsg) return reject(new Error(errMsg));

            if (lastEvent === 'complete' || lastEvent === 'process_completed') {
              const out = Array.isArray(j) ? j[0] : (j && j.data && j.data[0]);
              if (out && out.image) return resolve(out.image);
              if (out && out.url) return resolve({ url: out.url });
              if (typeof out === 'string' && out.length > 100) return resolve(out);
            }

            if (Array.isArray(j)) {
              const out = j[0];
              if (out && out.image) return resolve(out.image);
              if (out && out.url) return resolve({ url: out.url });
              if (typeof out === 'string' && out.length > 100) return resolve(out);
            }

            if (j && j.msg === 'process_completed') {
              const out = j.output && j.output.data && j.output.data[0];
              if (out && out.image) return resolve(out.image);
              if (out && out.url) return resolve({ url: out.url });
            }
          } catch (e) {}
        }
      });

      res.on('end', function () {
        reject(new Error('stream ended tanpa hasil'));
      });

      res.on('error', function (e) {
        if (/hang|socket|ECONNRESET/i.test(e.message)) return reject(new QuotaError(e.message));
        reject(e);
      });
    });

    req.on('error', function (e) {
      if (/hang|socket|ECONNRESET/i.test(e.message)) return reject(new QuotaError(e.message));
      reject(e);
    });

    req.setTimeout(120000, function () {
      req.destroy();
      reject(new Error('poll timeout'));
    });

    req.end();
  });
}

async function downloadBuffer(url) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    throw new Error('download URL invalid: ' + url);
  }
  const r = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    proxy: false
  });
  return Buffer.from(r.data);
}

export async function qwenEditImage(buffer, prompt) {
  await fetchConfig();
  const mime = mimeFromBuffer(buffer);
  const b64 = 'data:' + mime + ';base64,' + buffer.toString('base64');
  
  let result;
  let usingProxy = false;
  const maxAttempts = 8;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const eventId = await callEdit(b64, prompt, usingProxy);
      result = await pollResult(eventId, usingProxy);
      break;
    } catch (e) {
      if (e instanceof QuotaError) {
        try { await fetchProxies(); } catch (pe) {}
        usingProxy = true;
        if (attempt > 1) rotateProxy();
        continue;
      }
      if (attempt >= maxAttempts) throw e;
      if (usingProxy) rotateProxy();
    }
  }

  let resultBuf;
  let ext;

  if (typeof result === 'string' && /^https?:\/\//.test(result)) {
    resultBuf = await downloadBuffer(result);
    ext = EXT[mimeFromBuffer(resultBuf)] || 'png';
  } else if (typeof result === 'string') {
    const dec = decodeDataUrl(result);
    resultBuf = dec.buffer;
    ext = EXT[dec.mime] || 'png';
  } else if (result && result.url) {
    resultBuf = await downloadBuffer(result.url);
    ext = EXT[mimeFromBuffer(resultBuf)] || 'png';
  } else {
    throw new Error('Format output tidak dikenali.');
  }

  return {
    buffer: resultBuf,
    ext: ext,
    lora: defaultLora,
    creator: WM.Creator
  };
}