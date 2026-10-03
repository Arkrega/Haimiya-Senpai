import { AIRich } from "../../utils/MessageBuilderV4.7.js";

function isBytes(v) {
  return Buffer.isBuffer(v) || v instanceof Uint8Array || (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data));
}

function isLong(v) {
  return v && typeof v === 'object' && !isBytes(v) && typeof v.low === 'number' && typeof v.high === 'number';
}

function longToNumber(v) {
  try {
    return Number((BigInt(v.high) << 32n) + BigInt(v.low >>> 0));
  } catch {
    return v;
  }
}

function toPlain(node) {
  if (isBytes(node)) return Buffer.from(node.data ?? node).toString('base64');
  if (isLong(node)) return longToNumber(node);
  if (Array.isArray(node)) return node.map(toPlain);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = toPlain(v);
    return out;
  }
  return node;
}

function safeKey(k) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
}

function toLiteral(node, depth = 0) {
  const pad = '  '.repeat(depth);
  const padIn = '  '.repeat(depth + 1);
  if (node === undefined) return 'undefined';
  if (node === null) return 'null';
  const t = typeof node;
  if (t === 'string') return JSON.stringify(node);
  if (t === 'number' || t === 'boolean') return String(node);
  if (isBytes(node)) return `Buffer.from("${Buffer.from(node.data ?? node).toString('base64')}", "base64")`;
  if (Array.isArray(node)) {
    if (!node.length) return '[]';
    return '[\n' + node.map(n => padIn + toLiteral(n, depth + 1)).join(',\n') + '\n' + pad + ']';
  }
  if (t === 'object') {
    const entries = Object.entries(node).filter(([, v]) => v !== undefined);
    if (!entries.length) return '{}';
    return '{\n' + entries.map(([k, v]) => `${padIn}${safeKey(k)}:${toLiteral(v, depth + 1)}`).join(',\n') + '\n' + pad + '}';
  }
  return String(node);
}

function stripForward(p) {
  const out = JSON.parse(JSON.stringify(toPlain(p)));
  for (const [k, v] of Object.entries(out)) {
    if (k === 'messageContextInfo') continue;
    if (v && typeof v === 'object' && v.contextInfo) {
      delete v.contextInfo.forwardingScore;
      delete v.contextInfo.isForwarded;
      delete v.contextInfo.forwardOrigin;
      delete v.contextInfo.forwardedAiBotMessageInfo;
    }
  }
  return out;
}

function addForward(p) {
  const out = JSON.parse(JSON.stringify(toPlain(p)));
  for (const [k, v] of Object.entries(out)) {
    if (k === 'messageContextInfo') continue;
    if (v && typeof v === 'object' && k.endsWith('Message')) {
      v.contextInfo = { ...(v.contextInfo || {}), isForwarded: true, forwardingScore: 127 };
      break;
    }
  }
  return out;
}

function collectKeys(node, p = '', out = []) {
  if (!node || typeof node !== 'object') return out;
  for (const [k, v] of Object.entries(node)) {
    const cur = p ? p + '.' + k : k;
    if (k === 'mediaKey' || k === 'url' || k === 'directPath' || k === 'e2EeMediaKey') {
      out.push({ field: cur, value: isBytes(v) ? Buffer.from(v.data ?? v).toString('base64').slice(0, 40) + '…' : String(v).slice(0, 60) });
    } else if (v && typeof v === 'object' && !isBytes(v)) collectKeys(v, cur, out);
  }
  return out;
}

export default {
  name: "Copy Raw Message",
  command: ["crm"],
  owner_only: true,
  private_only: false,
  group_only: false,
  description: "Membedah, menyalin, dan memodifikasi payload pesan WhatsApp",
  category: "owner",
  async run(conn, m, { jid, args, usedPrefix, command, quotedMessage, quotedType }) {
    const mode = (args[0] || "").toLowerCase();
    const restArgs = args.slice(1);

    if (mode === "raw") {
      const jsonStr = restArgs.join(" ");
      if (!jsonStr) return await m.reply(`⚠️ Tempel JSON-nya: \`${usedPrefix + command} raw <json>\``);
      try {
        const parsed = JSON.parse(jsonStr);
        await conn.relayMessage(jid, parsed, {});
        return await m.react("✅");
      } catch (e) {
        return await m.reply(`❌ JSON invalid: ${e.message}`);
      }
    }

    if (!quotedMessage) {
      return await m.reply(
        "⚡ *CRM v3 — Copy Raw Message*\n\n" +
        "Balas pesan target, lalu ketik:\n" +
        `> \`${usedPrefix + command}\` → kode relay (AIRich code UI)\n` +
        `> \`${usedPrefix + command} snip\` → tampil kode + relay langsung\n` +
        `> \`${usedPrefix + command} relay\` → relay pesan murni\n` +
        `> \`${usedPrefix + command} clone\` → relay tanpa tag forward\n` +
        `> \`${usedPrefix + command} forward\` → relay dengan tag forward\n` +
        `> \`${usedPrefix + command} js\` → extract document .js\n` +
        `> \`${usedPrefix + command} json\` → extract document .json\n` +
        `> \`${usedPrefix + command} info\` → struktur ringkas\n` +
        `> \`${usedPrefix + command} keys\` → daftar mediaKey / url\n` +
        `> \`${usedPrefix + command} raw <json>\` → relay dari json tempel`
      );
    }

    const protoObj = toPlain(quotedMessage);
    const type = quotedType || "unknown";
    const sender = m.quotedSender ? m.quotedSender.split("@")[0] : "?";
    const quotedId = m.quoted?.key?.id || "?";

    const infoText =
      "⚡ *CRM v3 — Relay Snippet*\n" +
      "• Type     : `" + type + "`\n" +
      "• Chat     : " + jid + "\n" +
      "• ID       : " + quotedId + "\n" +
      "• Sender   : " + sender;

    const buildCode = () => {
      const body = toLiteral(protoObj, 0).split('\n').map(l => (l.length ? '  ' + l : l)).join('\n');
      return `// CRM V3 Reference\nawait conn.relayMessage(\n  "${jid}",\n${body},\n  {}\n);`;
    };

    try {
      if (mode === "relay") {
        await conn.relayMessage(jid, protoObj, {});
        return await m.react("✅");
      }
      if (mode === "clone") {
        await conn.relayMessage(jid, stripForward(protoObj), {});
        return await m.react("✅");
      }
      if (mode === "forward") {
        await conn.relayMessage(jid, addForward(protoObj), {});
        return await m.react("✅");
      }
      if (mode === "js") {
        const code = buildCode();
        await conn.sendMessage(jid, {
          document: Buffer.from(code, "utf-8"),
          mimetype: "application/javascript",
          fileName: `crm-${type}.js`,
          caption: infoText
        }, { quoted: m });
        return await m.react("✅");
      }
      if (mode === "json") {
        await conn.sendMessage(jid, {
          document: Buffer.from(JSON.stringify(protoObj, null, 2), "utf-8"),
          mimetype: "application/json",
          fileName: `crm-${type}.json`,
          caption: infoText
        }, { quoted: m });
        return await m.react("✅");
      }
      if (mode === "info") {
        await new AIRich(conn)
          .addText(infoText + "\n• TopKeys  : `" + Object.keys(protoObj).join(", ") + "`")
          .send(jid, { quoted: m });
        return await m.react("✅");
      }
      if (mode === "keys") {
        const found = collectKeys(protoObj);
        const lines = found.length
          ? found.map(f => "• `" + f.field + "`\n  " + f.value).join("\n")
          : "(tidak ada mediaKey/url di pesan ini)";
        
        await new AIRich(conn)
          .addText("🔑 *CRM Keys*\n" + lines)
          .send(jid, { quoted: m });
        return await m.react("✅");
      }

      const code = buildCode();
      let codeDisplay = code;
      
      if (codeDisplay.length > 40000) {
        codeDisplay = codeDisplay.slice(0, 40000) + "\n// ... (terpotong, gunakan mode .crm js untuk full source code)";
      }

      await new AIRich(conn)
        .addText(infoText)
        .addCode("javascript", codeDisplay)
        .send(jid, { quoted: m });

      if (mode === "snip") {
        await conn.relayMessage(jid, protoObj, {});
      }

      return await m.react("⚡");
    } catch (e) {
      await m.react("❎");
      return await m.reply("❌ CRM error: " + String(e.message || e).slice(0, 250));
    }
  }
};