import sharp from "sharp";
import { downloadMediaMessage } from "@itsliaaa/baileys";

export default {
  name: "Sticker to GIF",
  command: ["togif", "sticker2gif"],
  owner_only: false,
  private_only: false,
  group_only: false,
  category: "convert",
  async run(conn, m, { jid, usedPrefix, command, quoted, quotedMessage, quotedKey }) {
    if (!quoted || !quotedMessage?.stickerMessage) {
      return await m.reply(`Balas stiker dengan *${usedPrefix}${command}*`);
    }

    try {
      const webpBuffer = await downloadMediaMessage({ key: quotedKey || m.quotedKey || m.key, message: quotedMessage }, "buffer", {}, { reuploadRequest: conn.updateMediaMessage });
      let gifBuffer;

      try {
        gifBuffer = await sharp(webpBuffer, { animated: true })
          .gif({ effort: 4, colors: 256 })
          .toBuffer();
      } catch {
        gifBuffer = await sharp(webpBuffer)
          .gif({ effort: 4, colors: 256 })
          .toBuffer();
      }

      await conn.sendMessage(jid, { video: gifBuffer, gifPlayback: true, caption: "*Sticker To GIF*\n\nBerhasil mengubah stiker menjadi GIF berkualitas tinggi!" }, { quoted: m });
      await m.react("✅");
    } catch (e) {
      await m.react("❌");
      await m.reply("Gagal mengubah stiker menjadi GIF.");
    }
  }
};