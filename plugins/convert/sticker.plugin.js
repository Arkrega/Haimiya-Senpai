import { downloadMediaMessage } from "@itsliaaa/baileys";
import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";

function unwrapMessage(obj) {
  if (!obj) return null;
  let cur = obj;

  for (let i = 0; i < 5; i++) {
    if (!cur || typeof cur !== "object") break;

    if (cur.ephemeralMessage?.message) { cur = cur.ephemeralMessage.message; continue; }
    if (cur.viewOnceMessage?.message) { cur = cur.viewOnceMessage.message; continue; }
    if (cur.viewOnceMessageV2?.message) { cur = cur.viewOnceMessageV2.message; continue; }
    if (cur.viewOnceMessageV2Extension?.message) { cur = cur.viewOnceMessageV2Extension.message; continue; }
    if (cur.documentWithCaptionMessage?.message) { cur = cur.documentWithCaptionMessage.message; continue; }
    if (cur.message?.message) { cur = cur.message.message; continue; }

    break;
  }
  return cur;
}

function detectMedia(obj) {
  const un = unwrapMessage(obj);
  if (!un) return null;

  if (un.imageMessage) return { type: "image", node: un.imageMessage };
  if (un.videoMessage) return { type: "video", node: un.videoMessage };
  if (un.documentMessage) {
    const mime = un.documentMessage.mimetype || "";
    if (mime.startsWith("image/")) return { type: "image", node: un.documentMessage };
    if (mime.startsWith("video/")) return { type: "video", node: un.documentMessage };
  }
  return null;
}

export default {
  name: "Sticker",
  command: ["sticker", "s"],
  owner_only: false,
  private_only: false,
  group_only: false,
  category: "convert",

  async run(conn, m, { jid, quoted, quotedMessage, usedPrefix, command }) {
    let targetObj = null;
    let targetKey = m.key;

    if (quoted) {
      targetObj =
        quotedMessage ||
        quoted.message ||
        quoted.msg ||
        (quoted.key && quoted.message ? quoted.message : null) ||
        quoted;

      targetKey = quoted.key || m.key;
    } else {
      targetObj =
        m.message ||
        m.msg ||
        (m.quoted && m.quoted.message) ||
        null;
    }

    const detected = detectMedia(targetObj);

    if (!detected) {
      console.log("[STICKER] Target object:", JSON.stringify(targetObj, null, 2).slice(0, 500));
      return await m.reply(
        `❌ Tidak ada media yang terdeteksi.\n\n` +
        `• Kirim/reply gambar atau video dengan caption *${usedPrefix}${command}*\n` +
        `• Video maksimal 5 detik`
      );
    }

    const { type, node } = detected;

    if (type === "video") {
      const duration = node.seconds || 0;
      if (duration > 10) {
        return m.reply(`❌ Video terlalu panjang (${duration}s). Maksimal 5 detik.`);
      }
    }

    try {
      const mediaMessage = { key: targetKey, message: targetObj };
      const buffer = await downloadMediaMessage(
        mediaMessage,
        "buffer",
        {},
        { reuploadRequest: conn.updateMediaMessage }
      );

      if (!buffer || buffer.length < 100) {
        throw new Error("Buffer kosong / terlalu kecil");
      }

      const ext = type === "video" ? "mp4" : "jpg";
      const tmpIn = join(tmpdir(), `${randomBytes(6).toString("hex")}.${ext}`);
      const tmpOut = join(tmpdir(), `${randomBytes(6).toString("hex")}.webp`);

      await fs.writeFile(tmpIn, buffer);

      await new Promise((resolve, reject) => {
        const ff = ffmpeg(tmpIn)
          .on("error", (err) => reject(new Error(`FFmpeg: ${err.message}`)))
          .on("end", () => resolve(true));

        ff.addOutputOptions([
          "-vcodec", "libwebp",
          "-vf",
          type === "video"
            ? "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse"
            : "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse"
        ]);

        if (type === "video") {
          ff.addOutputOptions(["-loop", "0", "-ss", "00:00:00", "-t", "00:00:05", "-preset", "default", "-an", "-vsync", "0"]);
        }

        ff.save(tmpOut);
      });

      const webpBuffer = await fs.readFile(tmpOut);
      if (!webpBuffer || webpBuffer.length < 100) {
        throw new Error("WebP hasil konversi kosong");
      }

      await conn.sendMessage(jid, { sticker: webpBuffer }, { quoted: m });

      await Promise.all([
        fs.unlink(tmpIn).catch(() => {}),
        fs.unlink(tmpOut).catch(() => {})
      ]);

    } catch (e) {
      console.error("[STICKER ERROR]", e);
      await m.reply(`❌ Gagal convert:\n${e.message}`);
    }
  }
};