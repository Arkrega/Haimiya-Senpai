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
    let quoted = m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || m?.extendedTextMessage?.contextInfo?.quotedMessage;
    let mediaMessage = null;

    if (quoted) {
      mediaMessage = {
        key: m.key,
        message: quoted,
      };
    } else if (m.videoMessage) {
      mediaMessage = {
        key: m.key,
        message: m,
      };
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