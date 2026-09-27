import axios from "axios";
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
  description: "Membuat animasi stiker brat versi upgrade (Deluxe)",
  category: "maker",
  async run(conn, m, { jid, args, usedPrefix, command, quotedText }) {
    const input = args.join(" ") || quotedText;

    if (!input) {
      return await m.reply(
        `⚠️ *Teks tidak boleh kosong!*\n\n📌 *Cara Penggunaan:*\n${usedPrefix}${command} teks yang diinginkan\n\n⚙️ *Kustomisasi Lanjutan (Opsional):*\n${usedPrefix}${command} teks | tema(white/black) | blur(0-10) | durasi(angka)\n\n📌 *Contoh:*\n${usedPrefix}${command} Halo Abang! | white | 2 | 2.5`
      );
    }

    const [textValue, themeValue, blurValue, holdValue] = input.split("|").map(v => v?.trim());

    const text = textValue;
    const theme = themeValue || "white";
    const blur = blurValue || "0";
    const hold = holdValue || "2";

    await m.react("⏳");

    const params = new URLSearchParams({
      q: text,
      theme: theme,
      blur: blur,
      hold: hold
    });

    const targetUrl = `https://zellrayy.com/maker/bratvid2?${params.toString()}`;

    try {
      const response = await axios.get(targetUrl, { responseType: "arraybuffer" });
      const buffer = Buffer.from(response.data, "binary");

      const tmpIn = join(tmpdir(), `${randomBytes(6).toString("hex")}.mp4`);
      const tmpOut = join(tmpdir(), `${randomBytes(6).toString("hex")}.webp`);

      await fs.writeFile(tmpIn, buffer);

      await new Promise((resolve, reject) => {
        ffmpeg(tmpIn)
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

      await Promise.all([fs.unlink(tmpIn), fs.unlink(tmpOut)]);
      await m.react("✅");
    } catch (error) {
      console.error(error);
      await m.react("❌");
      await m.reply("❌ Gagal membuat stiker. Pastikan parameter valid atau coba teks lain.");
    }
  }
};