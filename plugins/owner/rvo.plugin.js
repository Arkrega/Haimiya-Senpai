import { downloadMediaMessage } from "@itsliaaa/baileys";

export default {
  name: "Read View Once",
  command: ["rvo"],
  owner_only: true,
  private_only: false,
  group_only: false,
  description: "Membaca pesan sekali lihat (view once)",
  category: "main",
  async run(conn, m, { jid, quotedMessage, quotedContent, quotedType }) {
    if (!quotedMessage || !quotedContent) {
      return await m.reply("Reply pesan view-once yang ingin dibuka.");
    }

    const isWrapped = quotedMessage.viewOnceMessage || quotedMessage.viewOnceMessageV2 || quotedMessage.viewOnceMessageV2Extension;
    const isViewOnceProp = quotedContent[quotedType]?.viewOnce;

    if (!isWrapped && !isViewOnceProp) {
      return await m.reply("Pesan yang di-reply bukan view-once.");
    }

    try {
      await m.react("⏳");
      
      const buffer = await downloadMediaMessage(
        { key: m.quotedKey || m.key, message: quotedMessage },
        "buffer",
        {},
        {
          logger: undefined,
          reuploadRequest: conn.updateMediaMessage
        }
      );

      if (!buffer) {
        await m.react("❌");
        return await m.reply("Gagal mengunduh media view-once.");
      }

      const mediaData = quotedContent[quotedType];
      const caption = mediaData?.caption || "";

      if (quotedType === "imageMessage") {
        await conn.sendMessage(jid, { image: buffer, caption: caption }, { quoted: m });
      } else if (quotedType === "videoMessage") {
        await conn.sendMessage(jid, { video: buffer, caption: caption }, { quoted: m });
      } else if (quotedType === "audioMessage") {
        await conn.sendMessage(jid, { audio: buffer, mimetype: mediaData?.mimetype, ptt: mediaData?.ptt }, { quoted: m });
      } else {
        await m.react("❌");
        await m.reply("Tipe pesan ini tidak didukung.");
        return;
      }
      
      await m.react("✅");
    } catch (e) {
      console.error("RVO Error:", e);
      await m.react("❌");
      await m.reply("Terjadi kesalahan saat membuka view-once.");
    }
  }
};