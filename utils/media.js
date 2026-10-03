function unwrapMediaMessage(message) {
  let current = message;
  for (let i = 0; i < 6 && current; i++) {
    if (current.ephemeralMessage?.message) current = current.ephemeralMessage.message;
    else if (current.viewOnceMessage?.message) current = current.viewOnceMessage.message;
    else if (current.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message;
    else if (current.viewOnceMessageV2Extension?.message) current = current.viewOnceMessageV2Extension.message;
    else if (current.documentWithCaptionMessage?.message) current = current.documentWithCaptionMessage.message;
    else break;
  }
  return current || null;
}

function getMediaInfo(message) {
  const content = unwrapMediaMessage(message);
  if (!content) return null;
  if (content.imageMessage) return { type: "image", node: content.imageMessage };
  if (content.videoMessage) return { type: "video", node: content.videoMessage };
  if (content.audioMessage) return { type: "audio", node: content.audioMessage };
  if (content.stickerMessage) return { type: "sticker", node: content.stickerMessage };
  if (content.documentMessage) {
    const mime = content.documentMessage.mimetype || "";
    if (mime.startsWith("image/")) return { type: "image", node: content.documentMessage };
    if (mime.startsWith("video/")) return { type: "video", node: content.documentMessage };
  }
  return null;
}

function getMediaTarget(m) {
  if (m?.quotedMessage) {
    const key = m.quotedKey || {
      remoteJid: m.chat || m.jid,
      id: m.contextInfo?.stanzaId,
      fromMe: false,
      ...(m.contextInfo?.participant
        ? { participant: m.contextInfo.participant }
        : {}),
    };

    if (!key?.id || !key?.remoteJid) return null;

    return {
      key,
      message: m.quotedMessage,
      quoted: true,
    };
  }

  if (m?.message && m?.key) {
    return {
      key: m.key,
      message: m.message,
      quoted: false,
    };
  }

  return null;
}

export { unwrapMediaMessage, getMediaInfo, getMediaTarget };
