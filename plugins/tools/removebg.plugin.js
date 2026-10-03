import { removebg } from "../../scrape/removebg.js";
import { downloadMediaMessage } from "@itsliaaa/baileys";

export default {
  name: "Remove Background",
  command: ["removebg", "rbg", "nobg", "hapusbg"],
  category: "tools",
  owner_only: false,
  private_only: false,
  group_only: false,

  async run(conn, m, { jid, quoted, quotedMessage, usedPrefix, command }) {
    const targetMessage = quotedMessage
      ? { key: m.quotedKey || quoted?.key || m.key, message: quotedMessage }
      : m.message
        ? { key: m.key, message: m.message }
        : null;

    const isImage =
      Boolean(m.isImage) ||
      Boolean(quotedMessage?.imageMessage) ||
      Boolean(quotedMessage?.viewOnceMessage?.message?.imageMessage);

    if (!isImage || !targetMessage) {
      await m.react("❌");
      return m.reply(`❌ *Gambar dibutuhkan*\n\nReply gambar lalu ketik *${usedPrefix}${command}*`);
    }

    try {
      await m.react("🕕");

      const imageBuffer = await downloadMediaMessage(
        targetMessage,
        "buffer",
        {},
        { reuploadRequest: conn.updateMediaMessage }
      );

      if (!imageBuffer?.length) throw new Error("Gagal mengunduh gambar.");

      const result = await removebg(imageBuffer, "haimiya-removebg.jpg");

      await conn.sendMessage(
        jid,
        {
          image: result,
          mimetype: "image/png",
          caption: "✅ *Background berhasil dihapus.*"
        },
        { quoted: m }
      );

      await m.react("✅");
    } catch (error) {
      console.error("[REMOVEBG]", error);
      await m.react("❌");
      return m.reply(`❌ *Gagal menghapus background.*\n\n> ${error.message}`);
    }
  }
};
