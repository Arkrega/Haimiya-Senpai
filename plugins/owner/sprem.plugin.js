import {
  generateWAMessageFromContent,
  proto,
} from "@itsliaaa/baileys";

export default {
  name: "Sticker Premium",
  command: ["sprem", "stickerpremium", "premiumsticker"],
  category: "owner",
  owner_only: true,
  private_only: false,
  group_only: false,
  description: "Mengubah stiker biasa menjadi Premium",

  async run(conn, m, { jid, args }) {
    if (!m.hasQuoted || !m.quotedMessage) {
      return m.reply(
        "⭐ *STICKER PREMIUM*\n\n" +
        "Reply sticker yang mau dijadikan premium!\n\n" +
        `Penggunaan: ${m.prefix}sprem`
      );
    }

    try {
      const msg =
        m.quotedMessage.stickerMessage ||
        m.quotedMessage.viewOnceMessage?.message?.stickerMessage;

      if (!msg) return m.reply("❌ Gagal membaca data sticker.");

      const stickerMessage = proto.Message.StickerMessage.fromObject({
        url: msg.url,
        fileSha256: msg.fileSha256,
        fileEncSha256: msg.fileEncSha256,
        mediaKey: msg.mediaKey,
        mimetype: msg.mimetype || "image/webp",
        height: msg.height,
        width: msg.width,
        directPath: msg.directPath,
        fileLength: msg.fileLength,
        mediaKeyTimestamp: msg.mediaKeyTimestamp,
        isAnimated: true,
        stickerSentTs: Date.now(),
        isAvatar: false,
        isAiSticker: true,
        premium: 1,
        isLottie: false,
        accessibilityLabel: msg.accessibilityLabel || ""
      });

      let targetJid = jid;
      if (args && args.length > 0) {
        let inputTarget = args[0].trim();
        if (inputTarget.includes("@g.us") || inputTarget.includes("@s.whatsapp.net") || inputTarget.includes("@newsletter")) {
          targetJid = inputTarget;
        } else {
          const num = inputTarget.replace(/\D/g, "");
          if (num) targetJid = `${num}@s.whatsapp.net`;
        }
      }

      const waMsg = generateWAMessageFromContent(
        targetJid,
        { stickerMessage },
        {
          userJid: conn.user?.id
        }
      );

      await conn.relayMessage(targetJid, waMsg.message, {
        messageId: waMsg.key.id,
      });

      await m.react("✅");
    } catch (error) {
      console.error("[SPREM ERROR]", error);
      await m.reply(`❌ Gagal: ${error.message}`);
    }
  },
};