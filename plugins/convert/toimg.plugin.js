import { downloadMediaMessage } from "@itsliaaa/baileys";

export default {
  name: "Sticker to Image",
  command: ["toimg"],
  owner_only: false,
  private_only: false,
  group_only: false,
  category: "convert",
  async run(conn, m, { jid, quoted, quotedMessage, quotedKey }) {
    if (!quoted || !quotedMessage?.stickerMessage) {
      await m.react("❌");
      return await m.reply("Silahkan reply sticker foto");
    }

    try {
      const buffer = await downloadMediaMessage({ key: quotedKey || m.quotedKey || m.key, message: quotedMessage }, "buffer", {}, { reuploadRequest: conn.updateMediaMessage });
      await conn.sendMessage(jid, { image: buffer, caption: "*ᬊ Sticker To Image ᬊ*\n\nSuccessfully convert to image!!" }, { quoted: m });
      await m.react("✅");
    } catch (e) {
      await m.react("❌");
      await m.reply("Gagal mengubah stiker menjadi gambar.");
    }
  }
};