/*
╔══════════════════════════════════════════════╗
║       👑  𝑹𝑰𝑴𝑼𝑹𝑼 𝑴𝑫 〽️                        ║
╚══════════════════════════════════════════════╝

🪽 𝑵𝒐𝒕𝒆 :
Rimuru MD adalah SC hasil rename dari SC Ourin MD.

╭─────────────「 🜲 𝑰𝑵𝑭𝑶 𝑶𝑼𝑹𝑰𝑵 」─────────────╮
│ 👤 Developer : 𝑯𝒚𝒖𝒖 / 𝒁𝒂𝒏𝒏
│ 🎵 TikTok    : https://tiktok.com/@ourinmd
│ 📢 WhatsApp  : https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t
╰─────────────────────────────────────────────╯

╭────────────「 ✦ 𝑰𝑵𝑭𝑶 𝑹𝑰𝑴𝑼𝑹𝑼 ✦ 」────────────╮
│ 👤 Developer Pihak Ketiga : 𝑨𝒏𝒊𝒕𝒂 𝑷𝒖𝒕𝒓𝒊 𝑨𝒛𝒛𝒂𝒉𝒓𝒂
│ 🎵 TikTok                 : https://tiktok.com/@anita.putri.azzah1
│ 📸 Instagram              : anit_aputriazzahrah
│ 📢 Saluran                : https://whatsapp.com/channel/0029Vb8dmsUElagkVPIw9X2P
│ ▶️ YouTube                : https://youtube.com/@rimurumd
╰─────────────────────────────────────────────╯

        ⚠️ 𝑫𝑶 𝑵𝑶𝑻 𝑹𝑬𝑴𝑶𝑽𝑬 𝑪𝑹𝑬𝑫𝑰𝑻 ⚠️
              ❖ 𝐉𝐚𝐧𝐠𝐚𝐧 𝐡𝐚𝐩𝐮𝐬 𝐜𝐫𝐞𝐝𝐢𝐭 ❖

                 「 👑 𝑹𝑰𝑴𝑼𝑹𝑼 𝑴𝑫 👑 」
*/

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import axios from "axios";
import os from "os";
import { downloadMediaMessage } from "@itsliaaa/baileys";

const execPromise = promisify(exec);

async function downloadToFile(url, dest) {
  const response = await axios({
    method: "get",
    url,
    responseType: "stream",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    timeout: 120000,
  });

  const writer = fs.createWriteStream(dest);
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return response.headers["content-type"] || "";
}

function guessMime(url, headerMime) {
  if (headerMime && !headerMime.includes("octet-stream")) return headerMime;
  if (/\.(mp4|mkv|mov|avi|webm)/i.test(url)) return "video/mp4";
  if (/\.(jpg|jpeg|png|webp)/i.test(url)) return "image/jpeg";
  return headerMime || "application/octet-stream";
}

export default {
  name: "SW HD",
  command: ["swhd"],
  category: "tools",
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Convert document/URL to image/video (HD, Fragmented MP4, Heavy File Support, Zero Buffering)",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const fullText = args.join(" ").trim();
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlMatch = fullText.match(urlRegex);

    let targetMessage = null;
    if (m.quotedMessage) {
      targetMessage = { key: m.quotedKey || m.key, message: m.quotedMessage };
    } else if (m.message?.documentMessage || m.message?.videoMessage || m.message?.imageMessage) {
      targetMessage = { key: m.key, message: m.message };
    }

    const hasMedia = targetMessage || urlMatch;

    if (!hasMedia) {
      return await conn.sendMessage(
        jid,
        {
          text: `⚠️ *Format Salah*\n\nContoh 1 (Reply Document):\nReply document video/image dengan caption \`${usedPrefix}${command} [caption]\`\n\nContoh 2 (Pakai Link Tourl untuk file >30MB):\n\`${usedPrefix}${command} https://qu.ax/xxx.mp4 [caption]\``,
        },
        { quoted: m }
      );
    }

    await m.react("⏰");

    let inputPath = null;
    let outputPath = null;

    try {
      let buffer = null;
      let mimeType = "";
      let captionText = fullText;

      if (urlMatch) {
        const mediaUrl = urlMatch[0];
        captionText = fullText.replace(mediaUrl, "").trim();

        const time = Date.now();
        inputPath = path.join(os.tmpdir(), `input_url_${time}`);

        const headerMime = await downloadToFile(mediaUrl, inputPath);
        mimeType = guessMime(mediaUrl, headerMime);
      } else {
        buffer = await downloadMediaMessage(
          targetMessage,
          "buffer",
          {},
          { reuploadRequest: conn.updateMediaMessage }
        );

        const msg = targetMessage.message;
        mimeType =
          msg?.documentMessage?.mimetype ||
          msg?.videoMessage?.mimetype ||
          msg?.imageMessage?.mimetype ||
          "";

        if (!mimeType) throw new Error("Mimetype tidak ditemukan dari document.");
      }

      if (mimeType.startsWith("video/") || (inputPath && !mimeType.startsWith("image/"))) {
        const time = Date.now();
        if (!inputPath) {
          inputPath = path.join(os.tmpdir(), `input_${time}.mp4`);
          fs.writeFileSync(inputPath, buffer);
        }

        outputPath = path.join(os.tmpdir(), `output_${time}.mp4`);

        try {
          await execPromise(
            `ffmpeg -i "${inputPath}" -c copy -movflags +faststart+frag_keyframe+empty_moov -map_metadata -1 "${outputPath}" -y`
          );
        } catch (ffmpegErr) {
          await execPromise(
            `ffmpeg -i "${inputPath}" -vcodec libx264 -pix_fmt yuv420p -acodec aac -movflags +faststart+frag_keyframe+empty_moov -map_metadata -1 "${outputPath}" -y`
          );
        }

        const videoBuffer = fs.readFileSync(outputPath);

        await conn.sendMessage(
          jid,
          {
            video: videoBuffer,
            mimetype: "video/mp4",
            caption: captionText,
            ptv: false,
          },
          { quoted: m }
        );
      } else if (mimeType.startsWith("image/")) {
        const imgBuffer = buffer || fs.readFileSync(inputPath);
        await conn.sendMessage(
          jid,
          {
            image: imgBuffer,
            mimetype: mimeType,
            caption: captionText,
          },
          { quoted: m }
        );
      } else {
        throw new Error(`Tipe media tidak didukung: ${mimeType}`);
      }

      await m.react("✅");
    } catch (err) {
      console.error("[SWHD ERROR]", err);
      await m.react("❌");
      await conn.sendMessage(
        jid,
        { text: `❌ *Gagal convert document*\n\n> ${err.message}` },
        { quoted: m }
      );
    } finally {
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  },
};