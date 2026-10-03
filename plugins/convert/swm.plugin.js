import webp from "node-webpmux";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFileSync, unlinkSync, readFileSync } from "fs";
import { downloadMediaMessage } from "@itsliaaa/baileys";

async function writeExifWebp(mediaBuffer, metadata) {
  const tmpFileIn = join(tmpdir(), `${randomBytes(6).toString("hex")}.webp`);
  const tmpFileOut = join(tmpdir(), `${randomBytes(6).toString("hex")}.webp`);
  
  writeFileSync(tmpFileIn, mediaBuffer);

  const img = new webp.Image();
  const json = {
    "sticker-pack-id": `bot-${randomBytes(4).toString("hex")}`,
    "sticker-pack-name": metadata?.packname || "",
    "sticker-pack-publisher": metadata?.author || "",
    "emojis": metadata?.emojis || ["🐱", "🌸"],
    "is-avatar-sticker": 0
  };

  const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
  const exif = Buffer.concat([exifAttr, jsonBuff]);
  exif.writeUIntLE(jsonBuff.length, 14, 4);

  await img.load(tmpFileIn);
  unlinkSync(tmpFileIn);
  img.exif = exif;
  await img.save(tmpFileOut);
  
  const resultBuffer = readFileSync(tmpFileOut);
  unlinkSync(tmpFileOut);
  return resultBuffer;
}

export default {
  name: "Sticker WM",
  command: ["swm", "wm", "colong", "take", "stickerwm"],
  owner_only: false,
  private_only: false,
  group_only: false,
  category: "convert",
  async run(conn, m, { jid, args, quoted, quotedMessage, quotedKey, usedPrefix }) {
    if (!quoted || !quotedMessage?.stickerMessage) {
      return await m.reply(`⚠️ Balas/reply stiker yang ingin dicolong watermark-nya!\n\nContoh:\n• ${usedPrefix}swm Punya|Abang\n• ${usedPrefix}colong MyPack|MyAuthor\n• ${usedPrefix}take CustomPack`);
    }

    let packname = "Haimiya-Senpai";
    let author = "Developed by Arkharega";
    const text = args.join(" ");

    if (text) {
      if (text.includes("|")) {
        const [p, a] = text.split("|").map(v => v.trim());
        if (p) packname = p;
        if (a) author = a;
      } else {
        packname = text.trim();
        author = "";
      }
    }

    try {
      const webpBuffer = await downloadMediaMessage({ key: quotedKey || m.quotedKey || m.key, message: quotedMessage }, "buffer", {}, { reuploadRequest: conn.updateMediaMessage });
      const stickerWithExif = await writeExifWebp(webpBuffer, { packname, author });

      await conn.sendMessage(jid, { sticker: stickerWithExif }, { quoted: m });
      await m.react("✅");
    } catch (e) {
      await m.react("❌");
      await m.reply("❌ Gagal mengunduh atau mengubah watermark stiker");
    }
  }
};