import { downloadMediaMessage } from "@itsliaaa/baileys";

export default {
  name: "Video to Video Note",
  command: ["ptv", "vnote"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Convert video to WhatsApp video note",
  category: "convert",
  async run(conn, m, { jid, usedPrefix, command }) {
    let mediaMessage = null;

    if (m.quotedMessage) {
      mediaMessage = { key: m.quotedKey || m.key, message: m.quotedMessage };
    } else if (m.isVideo) {
      mediaMessage = { key: m.key, message: m.message };
    } else {
      return await m.reply(`Kirim atau balas video dengan caption *${usedPrefix}${command}*`);
    }

    try {
      const buffer = await downloadMediaMessage(
        mediaMessage,
        "buffer",
        {},
        {
          logger: undefined,
          reuploadRequest: conn.updateMediaMessage,
        },
      );

      if (!buffer?.length) {
        return await m.reply("Gagal mengunduh video.");
      }

      await conn.sendMessage(jid, {
        video: buffer,
        ptv: true
      }, { quoted: m });

    } catch (err) {
      console.log(err);
      await m.reply("Terjadi kesalahan saat mengonversi video menjadi video note.");
    }
  }
};