import { makeBrat } from "../../scrape/brat.js";
import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";

export default {
  name: "Brat Deluxe Sticker",
  command: ["bratdeluxe"],
  owner_only: false,
  private_only: false,
  group_only: false,
  category: "maker",
  async run(conn, m, { jid, args, usedPrefix, command, quotedText }) {
    const input = args.join(" ") || quotedText;

    if (!input) {
      return await m.reply(
        `Format salah!\n\nPenggunaan:\n${usedPrefix}${command} teks | tema | blur | durasi\n\nContoh:\n${usedPrefix}${command} Halo Rek! | white | 1 | 1.5\n\nTema: white, black, green\nBlur: 0-3\nDurasi: Detik (angka)`
      );
    }

    const [textValue, themeValue, blurValue, holdValue] = input.split("|").map(v => v?.trim());

    const text = textValue;
    const theme = themeValue || "white";
    const blur = Number(blurValue) || 0;
    const hold = Number(holdValue) || 1.5;

    await m.react("⏳");

    try {
      const mp4Path = join(tmpdir(), `brat-${randomBytes(6).toString("hex")}.mp4`);
      const tmpOut = join(tmpdir(), `${randomBytes(6).toString("hex")}.webp`);
      
      const generatedMp4 = await makeBrat({
        text: text,
        theme: theme,
        blur: blur,
        hold: hold,
        format: 'mp4',
        out: mp4Path
      });

      await new Promise((resolve, reject) => {
        ffmpeg(generatedMp4)
          .on("error", reject)
          .on("end", () => resolve(true))
          .addOutputOptions([
            "-vcodec", "libwebp",
            "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
            "-loop", "0",
            "-preset", "default",
            "-an",
            "-vsync", "0"
          ])
          .save(tmpOut);
      });

      const webpBuffer = await fs.readFile(tmpOut);
      await conn.sendMessage(jid, { sticker: webpBuffer }, { quoted: m });

      await Promise.all([fs.unlink(generatedMp4), fs.unlink(tmpOut)]);
      await m.react("✅");
    } catch (error) {
      await m.react("❌");
      await m.reply(`Gagal membuat stiker.\n\nError: ${error.message}`);
    }
  }
};