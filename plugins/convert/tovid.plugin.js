import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { downloadMediaMessage } from "@itsliaaa/baileys";

const execFileAsync = promisify(execFile);

export default {
  name: "Sticker to Video",
  command: ["tovid", "sticker2video", "tovideo"],
  owner_only: false,
  private_only: false,
  group_only: false,
  category: "convert",
  async run(conn, m, { jid, usedPrefix, command, quoted, quotedMessage, quotedKey }) {
    if (!quoted || !quotedMessage?.stickerMessage) {
      return await m.reply(`Balas stiker dengan *${usedPrefix}${command}*`);
    }

    const gifPath = path.join(tmpdir(), `${randomUUID()}.gif`);
    const output = path.join(tmpdir(), `${randomUUID()}.mp4`);

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

      await fs.writeFile(gifPath, gifBuffer);

      await execFileAsync("ffmpeg", [
        "-y",
        "-i", gifPath,
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v", "libx264",
        "-preset", "faster",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-threads", "0",
        output
      ]);

      const videoBuffer = await fs.readFile(output);
      await conn.sendMessage(jid, { video: videoBuffer, caption: "Sticker berhasil diubah menjadi video berkualitas tinggi" }, { quoted: m });
      await m.react("✅");
    } catch (e) {
      await m.react("❌");
      await m.reply("Gagal mengubah stiker menjadi video.");
    } finally {
      await Promise.all([gifPath, output].map(f => fs.unlink(f).catch(() => {})));
    }
  }
};