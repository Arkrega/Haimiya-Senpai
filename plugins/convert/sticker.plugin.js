import { downloadMediaMessage } from "@itsliaaa/baileys";
import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import { getMediaTarget, getMediaInfo } from "../../utils/media.js";

export default {
  name: "Sticker",
  command: ["sticker", "s"],
  owner_only: false,
  private_only: false,
  group_only: false,
  category: "convert",

  async run(conn, m, { jid, usedPrefix, command }) {
    const target = getMediaTarget(m);
    const detected = target ? getMediaInfo(target.message) : null;

    if (!target || !detected || !["image", "video"].includes(detected.type)) {
      return m.reply(`❌ Tidak ada media yang terdeteksi.\n\n• Kirim/reply gambar atau video dengan caption *${usedPrefix}${command}*\n• Video maksimal 10 detik`);
    }

    if (detected.type === "video" && Number(detected.node?.seconds || 0) > 10) {
      return m.reply(`❌ Video terlalu panjang (${detected.node.seconds}s). Maksimal 10 detik.`);
    }

    let tmpIn, tmpOut;
    try {
      await m.react("⏳");
      const buffer = await downloadMediaMessage(target, "buffer", {}, { reuploadRequest: conn.updateMediaMessage });
      if (!buffer || buffer.length < 100) throw new Error("Buffer kosong / terlalu kecil");

      const ext = detected.type === "video" ? "mp4" : "jpg";
      tmpIn = join(tmpdir(), `${randomBytes(6).toString("hex")}.${ext}`);
      tmpOut = join(tmpdir(), `${randomBytes(6).toString("hex")}.webp`);
      await fs.writeFile(tmpIn, buffer);

      await new Promise((resolve, reject) => {
        const ff = ffmpeg(tmpIn).on("error", err => reject(new Error(`FFmpeg: ${err.message}`))).on("end", () => resolve(true));
        ff.addOutputOptions([
          "-vcodec", "libwebp",
          "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse"
        ]);
        if (detected.type === "video") ff.addOutputOptions(["-loop","0","-ss","00:00:00","-t","00:00:05","-preset","default","-an","-vsync","0"]);
        ff.save(tmpOut);
      });

      const webp = await fs.readFile(tmpOut);
      await conn.sendMessage(jid, { sticker: webp }, { quoted: m.raw || m });
      await m.react("✅");
    } catch (e) {
      console.error("[STICKER ERROR]", e);
      await m.react("❌");
      await m.reply(`❌ Gagal convert:\n${e.message}`);
    } finally {
      await Promise.all([
        tmpIn ? fs.unlink(tmpIn).catch(()=>{}) : Promise.resolve(),
        tmpOut ? fs.unlink(tmpOut).catch(()=>{}) : Promise.resolve(),
      ]);
    }
  }
};
