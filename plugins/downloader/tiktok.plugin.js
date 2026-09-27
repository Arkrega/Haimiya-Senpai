import axios from "axios";
import { spawn } from "child_process";
import { randomBytes } from "crypto";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { tiktokDl } from "../../scrape/tiktok.js";
import { Carousel, Button } from "../../utils/MessageBuilderV4.7.js";

function isValidMp4(buf) {
  return Buffer.isBuffer(buf) && buf.length > 12 &&
    buf.slice(4, 8).toString("ascii") === "ftyp";
}

function isValidMp3(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return false;
  if (buf.slice(0, 3).toString("ascii") === "ID3") return true;
  return buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0;
}

async function downloadMedia(url, type = "video") {
  const { data, status, headers } = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 60000,
    maxRedirects: 5,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Referer": "https://www.tikwm.com/",
      "Origin": "https://www.tikwm.com",
      "Accept":
        type === "video"
          ? "video/mp4,video/*;q=0.9,*/*;q=0.8"
          : "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
    },
    validateStatus: () => true,
  });

  if (status >= 400) {
    throw new Error(`CDN ${status} saat download ${type}`);
  }

  const buf = Buffer.from(data);
  const sniff = buf.slice(0, 200).toString("utf8").toLowerCase();
  if (sniff.includes("<html") || sniff.includes("<!doctype")) {
    throw new Error(`CDN balikin HTML, bukan ${type}`);
  }

  return { buf, contentType: headers["content-type"] || "" };
}

async function remuxForWhatsApp(buffer) {
  const tmpIn = join(tmpdir(), `tt-in-${randomBytes(6).toString("hex")}.mp4`);
  const tmpOut = join(tmpdir(), `tt-out-${randomBytes(6).toString("hex")}.mp4`);

  await writeFile(tmpIn, buffer);

  await new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y",
      "-i", tmpIn,
      "-c", "copy",
      "-movflags", "+faststart",
      tmpOut,
    ]);

    let err = "";
    ff.stderr.on("data", (d) => (err += d.toString()));
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exit ${code}: ${err.slice(-300)}`));
    });
  });

  const out = await readFile(tmpOut);
  await unlink(tmpIn).catch(() => {});
  await unlink(tmpOut).catch(() => {});
  return out;
}

export default {
  name: "TikTok Downloader",
  command: ["tt", "tiktok", "ttdl", "ttaudio"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Download video, foto slide, atau audio TikTok",
  category: "downloader",

  async run(conn, m, { jid, args, usedPrefix, command }) {
    const url = args[0];
    if (!url) {
      return m.reply(
        `Format salah!\n\nContoh:\n> ${usedPrefix + command} https://vt.tiktok.com/xxxx/`
      );
    }

    await m.react("⏳");

    try {
      const res = await tiktokDl(url);

      if (!res.status) {
        await m.react("❌");
        return m.reply(res.msg || "Gagal mengunduh media.");
      }

      if (command === "ttaudio") {
        const audioUrl = res.music_info?.url;
        if (!audioUrl) {
          await m.react("❌");
          return m.reply("Audio tidak ditemukan untuk tautan ini.");
        }

        const { buf } = await downloadMedia(audioUrl, "audio");
        if (!isValidMp3(buf)) throw new Error("Buffer audio tidak valid");

        await conn.sendMessage(
          jid,
          {
            audio: buf,
            mimetype: "audio/mpeg",
            fileName: "tiktok.mp3",
            ptt: false,
          },
          { quoted: m }
        );

        await m.react("✅");
        return;
      }

      const isPhotoSlide = res.data.some((v) => v.type === "photo");

      if (isPhotoSlide) {
        const slides = res.data.filter((v) => v.type === "photo");

        for (let i = 0; i < slides.length; i += 10) {
          const chunk = slides.slice(i, i + 10);
          const carousel = new Carousel(conn)
            .setBody(i === 0 ? res.title || "TikTok Media" : "Lanjutan slide TikTok...")
            .setFooter("Swipe untuk melihat foto ➡️");

          for (const [index, slide] of chunk.entries()) {
            const card = await new Button(conn)
              .setImage(slide.url)
              .setBody(`Slide ${i + index + 1} dari ${slides.length}`)
              .addUrl("Buka Original", slide.url)
              .addReply("Ambil Musik", `${usedPrefix}ttaudio ${url}`)
              .toCard();

            carousel.addCard(card);
          }

          await carousel.send(jid, { quoted: m });
        }

        await m.react("✅");
        return;
      }

      const candidates = [
        res.data.find((v) => v.type === "nowatermark_hd"),
        res.data.find((v) => v.type === "nowatermark"),
        res.data.find((v) => v.type === "watermark"),
        res.data[0],
      ].filter(Boolean);

      let videoBuffer = null;
      let lastErr = null;

      for (const candidate of candidates) {
        try {
          const { buf } = await downloadMedia(candidate.url, "video");
          if (isValidMp4(buf)) {
            videoBuffer = buf;
            break;
          }
          lastErr = new Error("MP4 signature tidak valid");
        } catch (e) {
          lastErr = e;
        }
      }

      if (!videoBuffer) {
        throw lastErr || new Error("Semua URL video tidak valid");
      }

      try {
        videoBuffer = await remuxForWhatsApp(videoBuffer);
      } catch (e) {
        console.error("[TikTok] Remux gagal, kirim raw:", e.message);
      }

      await conn.sendMessage(
        jid,
        {
          video: videoBuffer,
          mimetype: "video/mp4",
          fileName: "tiktok.mp4",
          caption: res.title || "TikTok Media",
          gifPlayback: false,
        },
        { quoted: m }
      );

      await m.react("✅");
    } catch (err) {
      console.error("[TikTok Plugin]", err);
      await m.react("❌");
      await m.reply(`Gagal memproses: ${err.message}`);
    }
  },
};