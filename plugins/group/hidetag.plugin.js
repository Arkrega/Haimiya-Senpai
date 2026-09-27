import { downloadMediaMessage } from "@itsliaaa/baileys";

export default {
  name: "Hidetag",
  command: ["hidetag", "h"],
  owner_only: false,
  private_only: false,
  group_only: true,
  category: "group",
  async run(conn, m, { jid, args, isAdmin, isOwner, participants, quoted, quotedMessage }) {
    if (!isAdmin && !isOwner) {
      return await m.reply("Fitur ini hanya untuk admin grup");
    }
    const users = participants.map(p => p.id);
    const textContent = args.join(" ");

    if (quoted) {
      const msgType = Object.keys(quotedMessage)[0];
      if (msgType === "conversation" || msgType === "extendedTextMessage") {
        await conn.sendMessage(jid, { text: m.quotedText, mentions: users });
      } else {
        const buffer = await downloadMediaMessage({ key: m.key, message: quotedMessage }, "buffer", {}, { reuploadRequest: conn.updateMediaMessage });
        if (quotedMessage.imageMessage) {
          await conn.sendMessage(jid, { image: buffer, caption: textContent || quotedMessage.imageMessage.caption || "", mentions: users });
        } else if (quotedMessage.videoMessage) {
          await conn.sendMessage(jid, { video: buffer, caption: textContent || quotedMessage.videoMessage.caption || "", mentions: users });
        } else if (quotedMessage.audioMessage) {
          await conn.sendMessage(jid, { audio: buffer, mimetype: quotedMessage.audioMessage.mimetype, mentions: users });
        } else if (quotedMessage.documentMessage) {
          await conn.sendMessage(jid, { document: buffer, mimetype: quotedMessage.documentMessage.mimetype, fileName: quotedMessage.documentMessage.fileName, caption: textContent || quotedMessage.documentMessage.caption || "", mentions: users });
        }
      }
    } else {
      await conn.sendMessage(jid, { text: textContent, mentions: users });
    }
  }
};