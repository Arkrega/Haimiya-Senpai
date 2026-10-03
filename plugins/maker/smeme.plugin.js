import { downloadMediaMessage } from "@itsliaaa/baileys";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { createCanvas, registerFont } from "canvas";
import { writeFileSync, unlinkSync, readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { tmpdir } from "os";
import crypto from "crypto";
import { getMediaTarget, getMediaInfo } from "../../utils/media.js";

const assetsDir = path.join(process.cwd(), "assets");
if (!existsSync(assetsDir)) {
  mkdirSync(assetsDir, { recursive: true });
}

const fontPath = path.join(assetsDir, "impact.ttf");
let useCustomFont = false;

if (existsSync(fontPath)) {
  registerFont(fontPath, { family: "CustomMeme" });
  useCustomFont = true;
}

function makeTextOverlay(topText, bottomText) {
  const W = 512;
  const H = 512;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const wrapText = (text, maxW) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";

    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }

    if (cur) lines.push(cur);
    return lines;
  };

  const fontFace = useCustomFont ? '"CustomMeme"' : "Impact, Arial Black, sans-serif";

  const calcFontSize = (text, maxW, maxH) => {
    let size = 76;

    while (size > 20) {
      ctx.font = `900 ${size}px ${fontFace}`;
      const lines = wrapText(text, maxW);
      const totalH = lines.length * size * 1.18;

      if (
        totalH <= maxH &&
        Math.max(...lines.map(line => ctx.measureText(line).width), 0) <= maxW
      ) {
        break;
      }

      size -= 2;
    }

    return size;
  };

  const draw = (text, pos) => {
    if (!text) return;

    const PAD = 22;
    const maxW = W - PAD * 2;
    const fontSize = calcFontSize(text, maxW, H * 0.38);

    ctx.font = `900 ${fontSize}px ${fontFace}`;
    ctx.textAlign = "center";
    ctx.textBaseline = pos === "top" ? "top" : "bottom";
    ctx.lineJoin = "round";

    const lines = wrapText(text, maxW);
    const lineH = fontSize * 1.18;
    const strokeW = Math.max(Math.round(fontSize * 0.085), 4);

    lines.forEach((line, i) => {
      const y =
        pos === "top"
          ? 16 + i * lineH
          : H - 16 - (lines.length - 1 - i) * lineH;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = fontSize * 0.10;
      ctx.shadowOffsetX = fontSize * 0.04;
      ctx.shadowOffsetY = fontSize * 0.04;

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = strokeW;
      ctx.strokeText(line, W / 2, y);

      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(line, W / 2, y);
      ctx.restore();
    });
  };

  draw(topText, "top");
  draw(bottomText, "bottom");

  return canvas.toBuffer("image/png");
}

export default {
  name: "Sticker Meme",
  command: ["smeme", "stickermeme"],
  owner_only: false,
  private_only: false,
  group_only: false,
  category: "maker",

  async run(
    conn,
    m,
    { jid, args, usedPrefix, command }
  ) {
    const text = args.join(" ").trim();
    const mediaMessage = getMediaTarget(m);
    const mediaInfo = mediaMessage ? getMediaInfo(mediaMessage.message) : null;

    if (
      !mediaMessage ||
      !mediaInfo ||
      !["image", "video", "sticker"].includes(mediaInfo.type)
    ) {
      return m.reply(
        `❌ Media belum ditemukan.\n\nKirim/reply gambar, video, atau sticker lalu gunakan *${usedPrefix}${command} TEKS*.`
      );
    }

    if (!text) {
      return m.reply(
        `❌ Teks meme belum diisi.\n\nContoh:\n` +
        `• ${usedPrefix}${command} ATAS|BAWAH\n` +
        `• ${usedPrefix}${command} ATAS|\n` +
        `• ${usedPrefix}${command} |BAWAH`
      );
    }

    let topText = "";
    let bottomText = "";

    if (text.includes("|")) {
      const parts = text.split("|");
      topText = (parts[0] || "").trim().toUpperCase();
      bottomText = parts.slice(1).join("|").trim().toUpperCase();
    } else {
      topText = text.toUpperCase();
    }

    if (!topText && !bottomText) {
      return m.reply("❌ Teks tidak boleh kosong semua!");
    }

    const tmpFiles = [];

    try {
      await m.react("⏳");

      const mediaBuf = await downloadMediaMessage(
        mediaMessage,
        "buffer",
        {},
        { reuploadRequest: conn.updateMediaMessage }
      );

      if (!mediaBuf?.length) {
        throw new Error("Media gagal diunduh atau buffer kosong.");
      }

      const textBuf = makeTextOverlay(topText, bottomText);

      /*
       * Gambar/sticker:
       * Jangan lewat FFmpeg. Sharp langsung membuat canvas 512x512,
       * sehingga error FFmpeg code 69 tidak mengganggu meme gambar.
       */
      if (mediaInfo.type !== "video") {
        const webpBuf = await sharp(mediaBuf)
          .resize(512, 512, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .composite([{ input: textBuf, left: 0, top: 0 }])
          .webp({ quality: 85 })
          .toBuffer();

        await conn.sendMessage(
          jid,
          { sticker: webpBuf },
          { quoted: m.raw || m }
        );

        await m.react("✅");
        return;
      }

      /*
       * Video:
       * FFmpeg hanya dipakai untuk video. Overlay PNG transparan
       * kemudian dikonversi ke animated WebP maksimal 6 detik.
       */
      const mediaPath = path.join(
        tmpdir(),
        `${crypto.randomBytes(6).toString("hex")}.mp4`
      );
      const textPath = path.join(
        tmpdir(),
        `${crypto.randomBytes(6).toString("hex")}.png`
      );
      const outPath = path.join(
        tmpdir(),
        `${crypto.randomBytes(6).toString("hex")}.webp`
      );

      tmpFiles.push(mediaPath, textPath, outPath);

      writeFileSync(mediaPath, mediaBuf);
      writeFileSync(textPath, textBuf);

      await new Promise((resolve, reject) => {
        ffmpeg(mediaPath)
          .input(textPath)
          .complexFilter([
            "[0:v]scale=512:512:force_original_aspect_ratio=decrease," +
              "pad=512:512:-1:-1:color=black@0[bg]",
            "[bg][1:v]overlay=0:0[out]"
          ])
          .outputOptions([
            "-map", "[out]",
            "-an",
            "-t", "6",
            "-c:v", "libwebp",
            "-lossless", "0",
            "-q:v", "70",
            "-loop", "0",
            "-preset", "default"
          ])
          .on("error", reject)
          .on("end", resolve)
          .save(outPath);
      });

      const webpBuf = readFileSync(outPath);

      await conn.sendMessage(
        jid,
        { sticker: webpBuf },
        { quoted: m.raw || m }
      );

      await m.react("✅");
    } catch (err) {
      console.error("[SMEME ERROR]", err);
      await m.react("❌");
      await m.reply(`Gagal membuat meme: ${err.message}`);
    } finally {
      for (const file of tmpFiles) {
        try {
          unlinkSync(file);
        } catch {}
      }
    }
  }
};
