import { downloadMediaMessage } from "@itsliaaa/baileys";
import { fileTypeFromBuffer } from "file-type";
import { upscaleImage } from "../../scrape/imageupscaler.js";

export default {
  name: "Image Upscaler",
  command: ["hd", "upscale", "remini"],
  category: "tools",
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Meningkatkan resolusi gambar tanpa kompresi",
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
      return m.reply(`Kirim/reply gambar dengan caption *${usedPrefix}${command}*`);
    }

    const scale = args[0] && ["2", "4", "2x", "4x"].includes(args[0]) ? args[0] : "4x";

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

      const ft = await fileTypeFromBuffer(imageBuffer);
      const mime = ft?.mime || "image/jpeg";
      const ext = ft?.ext || "jpg";

      const filename = `${originalName}.${ext}`;

      const result = await upscaleImage(imageBuffer, mime, scale, filename);

      const resultFt = await fileTypeFromBuffer(result.buffer);
      const resultExt = resultFt?.ext || "jpg";
      const finalFilename = `${originalName}_HD_BY_ARKREGA.${resultExt}`;

      await conn.sendMessage(
        jid,
        {
          document: result.buffer,
          mimetype: resultFt?.mime || "image/jpeg",
          fileName: finalFilename,
          caption: `Kualitas berhasil ditingkatkan ke ${scale}.\nSisa kredit server: ${result.credits}`
        },
        { quoted: m }
      );

      await m.react("✅");
    } catch (error) {
      console.error("[UPSCALER ERROR]", error);
      await m.react("❌");
      await m.reply(`Gagal memperbesar gambar:\n> ${error.message}`);
    }
  }
};