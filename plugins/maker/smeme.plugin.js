import { downloadMediaMessage } from "@itsliaaa/baileys";
import ffmpeg from "fluent-ffmpeg";
import { createCanvas } from "canvas";
import { writeFileSync, unlinkSync, readFileSync } from "fs";
import path from "path";
import { tmpdir } from "os";
import crypto from "crypto";

export default {
  name: "Sticker Meme",
  command: ["smeme", "stickermeme"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Membuat meme dari gambar, video, atau stiker animasi",
  category: "maker",
  async run(conn, m, { jid, args, quoted, quotedMessage, isMedia, usedPrefix, command }) {
    const text = args.join(" ");
    if (!text) {
      return await m.reply(`Format: ${usedPrefix}${command} TEKS ATAS|TEKS BAWAH\n\nContoh:\n- Keduanya: ${usedPrefix}${command} ATAS|BAWAH\n- Hanya atas: ${usedPrefix}${command} ATAS|\n- Hanya bawah: ${usedPrefix}${command} |BAWAH\n- Default (atas): ${usedPrefix}${command} ATAS`);
    }

    let mediaMessage = null;
    let mime = "";
    
    if (quoted) {
      mediaMessage = { key: m.key, message: quotedMessage };
      mime = quotedMessage?.imageMessage?.mimetype || quotedMessage?.videoMessage?.mimetype || quotedMessage?.stickerMessage?.mimetype || "";
    } else if (isMedia) {
      mediaMessage = { key: m.key, message: m.message };
      mime = m.message?.imageMessage?.mimetype || m.message?.videoMessage?.mimetype || m.message?.stickerMessage?.mimetype || "";
    }

    if (!mediaMessage || (!mime.includes("image") && !mime.includes("video") && !mime.includes("webp"))) {
      return await m.reply("Reply gambar, video, atau sticker terlebih dahulu!");
    }

    try {
      await m.react("⏳");
      
      let mediaBuf = await downloadMediaMessage(mediaMessage, "buffer", {}, { reuploadRequest: conn.updateMediaMessage });
      
      // PERBAIKAN: Beri ekstensi yang spesifik agar FFmpeg tidak error saat melakukan decoding
      let ext = "jpg";
      if (mime.includes("video")) ext = "mp4";
      else if (mime.includes("webp")) ext = "webp";
      else if (mime.includes("png")) ext = "png";

      const tmpMedia = path.join(tmpdir(), crypto.randomBytes(6).toString("hex") + "." + ext);
      const tmpText = path.join(tmpdir(), crypto.randomBytes(6).toString("hex") + ".png");
      const tmpOut = path.join(tmpdir(), crypto.randomBytes(6).toString("hex") + ".webp");
      
      writeFileSync(tmpMedia, mediaBuf);

      let topText = "";
      let bottomText = "";
      if (text.includes("|")) {
        const parts = text.split("|");
        topText = (parts[0] || "").trim().toUpperCase();
        bottomText = (parts[1] || "").trim().toUpperCase();
      } else {
        topText = text.trim().toUpperCase();
      }

      if (!topText && !bottomText) {
         unlinkSync(tmpMedia);
         return await m.reply("Teks tidak boleh kosong semua!");
      }

      const W = 512;
      const H = 512;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext("2d");

      const wrapText = (ctx, text, maxW) => {
        const words = text.split(" ");
        const lines = [];
        let cur = "";
        for (const word of words) {
          const test = cur ? cur + " " + word : word;
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

      const calcFontSize = (ctx, text, maxW, maxH) => {
        let size = Math.round(Math.min(W, H) * 0.15);
        while (size > 20) {
          ctx.font = `900 ${size}px Impact, Arial Black, sans-serif`;
          const lines = wrapText(ctx, text, maxW);
          const totalH = lines.length * size * 1.2;
          if (totalH <= maxH && Math.max(...lines.map(l => ctx.measureText(l).width)) <= maxW) break;
          size -= 2;
        }
        return size;
      };

      const drawMemeText = (ctx, text, x, y, maxW, fontSize, pos) => {
        ctx.font = `900 ${fontSize}px Impact, Arial Black, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = pos === "top" ? "top" : "bottom";
        ctx.lineJoin = "round";
        const lines = wrapText(ctx, text, maxW);
        const lineH = fontSize * 1.18;
        const strokeW = Math.max(Math.round(fontSize * 0.085), 4);
        lines.forEach((line, i) => {
          const drawY = pos === "top" ? y + i * lineH : y - (lines.length - 1 - i) * lineH;
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.55)";
          ctx.shadowBlur = fontSize * 0.10;
          ctx.shadowOffsetX = fontSize * 0.04;
          ctx.shadowOffsetY = fontSize * 0.04;
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = strokeW;
          ctx.strokeText(line, x, drawY);
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(line, x, drawY);
          ctx.restore();
        });
      };

      const PAD = W * 0.04;
      const PAD_V = H * 0.03;
      const maxW = W - PAD * 2;
      const maxH = H * 0.38;

      if (topText) drawMemeText(ctx, topText, W / 2, PAD_V, maxW, calcFontSize(ctx, topText, maxW, maxH), "top");
      if (bottomText) drawMemeText(ctx, bottomText, W / 2, H - PAD_V, maxW, calcFontSize(ctx, bottomText, maxW, maxH), "bottom");

      const textBuf = canvas.toBuffer("image/png");
      writeFileSync(tmpText, textBuf);

      await new Promise((resolve, reject) => {
        ffmpeg(tmpMedia)
          .input(tmpText)
          .complexFilter([
            "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=white@0.0[bg]",
            "[bg][1:v]overlay=0:0,split[a][b]",
            "[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p]",
            "[b][p]paletteuse"
          ])
          .outputOptions([
            "-vcodec", "libwebp",
            "-loop", "0",
            "-preset", "default",
            "-an",
            "-vsync", "0",
            "-t", "00:00:06"
          ])
          .on("error", reject)
          .on("end", () => resolve(true))
          .save(tmpOut);
      });

      const webpBuf = readFileSync(tmpOut);
      await conn.sendMessage(jid, { sticker: webpBuf }, { quoted: m });

      try { unlinkSync(tmpMedia); } catch {}
      try { unlinkSync(tmpText); } catch {}
      try { unlinkSync(tmpOut); } catch {}
      
      await m.react("✅");
    } catch (err) {
      console.error(err);
      await m.react("❌");
      await m.reply("Gagal membuat meme: " + err.message);
    }
  }
};