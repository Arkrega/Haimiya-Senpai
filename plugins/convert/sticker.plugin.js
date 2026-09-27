import { downloadMediaMessage } from "@itsliaaa/baileys";
import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";

export default {
  name: "Sticker",
  command: ["sticker", "s"],
  owner_only: false,
  private_only: false,
  group_only: false,
  category: "convert",
  async run(conn, m, { jid, quoted, quotedMessage, isMedia, usedPrefix, command }) {
    let mediaMessage = null;
    if (quoted) {
      mediaMessage = { key: m.key, message: quotedMessage };
    } else if (isMedia) {
      mediaMessage = { key: m.key, message: m.message };
    }

    if (!mediaMessage || (!mediaMessage.message.imageMessage && !mediaMessage.message.videoMessage)) {
      return await m.reply(`Kirim atau balas media dengan caption *${usedPrefix}${command}*\n\nNote: Video maksimal 5 detik`);
    }

    try {
      const buffer = await downloadMediaMessage(mediaMessage, "buffer", {}, { reuploadRequest: conn.updateMediaMessage });
      const isVideo = !!mediaMessage.message.videoMessage;
      const ext = isVideo ? "mp4" : "jpg";
      const tmpIn = join(tmpdir(), `${randomBytes(6).toString("hex")}.${ext}`);
      const tmpOut = join(tmpdir(), `${randomBytes(6).toString("hex")}.webp`);

      await fs.writeFile(tmpIn, buffer);

      await new Promise((resolve, reject) => {
        let ff = ffmpeg(tmpIn).on("error", reject).on("end", () => resolve(true));
        if (isVideo) {
          ff.addOutputOptions([
            "-vcodec", "libwebp",
            "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
            "-loop", "0",
            "-ss", "00:00:00",
            "-t", "00:00:05",
            "-preset", "default",
            "-an",
            "-vsync", "0"
          ]);
        } else {
          ff.addOutputOptions([
            "-vcodec", "libwebp",
            "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse"
          ]);
        }
        ff.save(tmpOut);
      });

      const webpBuffer = await fs.readFile(tmpOut);
      await conn.sendMessage(jid, { sticker: webpBuffer }, { quoted: m });
      await Promise.all([fs.unlink(tmpIn), fs.unlink(tmpOut)]);
    } catch (e) {
      await m.reply("Terjadi kesalahan saat mengonversi media menjadi stiker");
    }
  }
};