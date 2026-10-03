import { downloadMediaMessage } from "@itsliaaa/baileys";
import { qwenEditImage } from "../../scrape/qwenedit.js";

export default {
  name: "Qwen Edit Image",
  command: ["qwenedit", "editimage", "qwen"],
  category: "tools",
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Edit gambar dengan AI berdasarkan prompt (Kirim sebagai dokumen)",
  async run(conn, m, { jid, quoted, quotedMessage, usedPrefix, command, args }) {
    const targetMessage = quotedMessage
      ? { key: m.quotedKey || quoted?.key || m.key, message: quotedMessage }
      : m.message
        ? { key: m.key, message: m.message }
        : null;

    const isImage =
      Boolean(m.isImage) ||
      Boolean(quotedMessage?.imageMessage) ||
      Boolean(quotedMessage?.viewOnceMessage?.message?.imageMessage) ||
      Boolean(quotedMessage?.documentMessage?.mimetype?.startsWith("image/"));

    if (!isImage || !targetMessage) {
      await m.react("❌");
      return m.reply(`Kirim/reply gambar dengan caption *${usedPrefix}${command} [prompt]*`);
    }

    const prompt = args.join(" ");
    if (!prompt) {
      await m.react("❌");
      return m.reply(`Masukkan instruksi edit!\nContoh: ${usedPrefix}${command} make it cyberpunk style`);
    }

    try {
      await m.react("⏳");
      
      let originalName = "image";
      const docMsg = quotedMessage?.documentMessage || m.message?.documentMessage;
      if (docMsg?.fileName) {
        originalName = docMsg.fileName.replace(/\.[^/.]+$/, ""); 
      }

      const imageBuffer = await downloadMediaMessage(
        targetMessage,
        "buffer",
        {},
        { reuploadRequest: conn.updateMediaMessage }
      );

      if (!imageBuffer?.length) throw new Error("Gagal mengunduh gambar.");

      const result = await qwenEditImage(imageBuffer, prompt);
      const finalFilename = `${originalName}_HD_BY_ARKREGA.${result.ext}`;

      await conn.sendMessage(
        jid,
        {
          document: result.buffer,
          mimetype: `image/${result.ext === 'jpg' ? 'jpeg' : result.ext}`,
          fileName: finalFilename,
          caption: `*Prompt:* ${prompt}\n*Model:* ${result.lora}\n*Creator:* ${result.creator}`
        },
        { quoted: m }
      );

      await m.react("✅");
    } catch (error) {
      console.error("[QWEN EDIT ERROR]", error);
      await m.react("❌");
      await m.reply(`Gagal mengedit gambar:\n> ${error.message}`);
    }
  }
};