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
  async run(conn, m, { jid, quoted, quotedMessage, usedPrefix, command }) {
    let msgObj = quoted ? quotedMessage : m.message;
    let isVideo = false;
    let isImage = false;

    const checkMedia = (obj) => {
      if (!obj) return;
      if (obj.imageMessage) isImage = true;
      if (obj.videoMessage) isVideo = true;
      if (obj.ephemeralMessage) checkMedia(obj.ephemeralMessage.message);
      if (obj.viewOnceMessage) checkMedia(obj.viewOnceMessage.message);
      if (obj.viewOnceMessageV2) checkMedia(obj.viewOnceMessageV2.message);
      if (obj.viewOnceMessageV2Extension) checkMedia(obj.viewOnceMessageV2Extension.message);
      if (obj.documentWithCaptionMessage) checkMedia(obj.documentWithCaptionMessage.message);
    };

    checkMedia(msgObj);

    if (!isImage && !isVideo) {
      return await m.reply(`Kirim atau balas media dengan caption *${usedPrefix}${command}*\n\nNote: Video maksimal 5 detik`);
    }

    try {
      let mediaMessage = { key: m.key, message: msgObj };
      const buffer = await downloadMediaMessage(
        mediaMessage,
        "buffer",
        {},
        { reuploadRequest: conn.updateMediaMessage }
      );

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