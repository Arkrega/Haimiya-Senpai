import { ytdlAuto } from "../../scrape/youtube.js";
import { Button } from "../../utils/MessageBuilderV4.7.js";

export default {
  name: "YouTube Downloader",
  command: ["ytdl", "ytmp3", "ytmp4"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Download Video & MP3 dari YouTube",
  category: "downloader",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const cmd = command.toLowerCase();
    const query = args.join(" ");

    if (!query) {
      return await m.reply(`Masukkan URL YouTube!\nContoh: ${usedPrefix || "."}ytdl https://youtu.be/...`);
    }

    let videoUrl = query;
    const match = query.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/|.*embed\/|.*shorts\/))([^?&]+)/);
    if (match) {
      videoUrl = `https://youtu.be/${match[1]}`;
    }

    await m.react("⏳");
    try {
      if (cmd === "ytmp3") {
        const res = await ytdlAuto(videoUrl, "audio");
        if (!res || !res.status || !res.download_url) {
          await m.react("❌");
          return await m.reply("Gagal mengunduh audio dari YouTube.");
        }

        await conn.sendMessage(jid, { 
          audio: { url: res.download_url }, 
          mimetype: "audio/mp4" 
        }, { quoted: m });
        
        await m.react("✅");
      } else {
        const res = await ytdlAuto(videoUrl, "720");
        if (!res || !res.status || !res.download_url) {
          await m.react("❌");
          return await m.reply("Gagal mengunduh video dari YouTube.");
        }

        const prefix = usedPrefix || ".";
        await new Button(conn)
          .setBody(`*${res.title || "YouTube Downloader"}*`)
          .setFooter("Klik tombol di bawah ini untuk mengambil versi audionya (MP3).")
          .setMedia({ video: { url: res.download_url } })
          .addReply("🎵 Ambil Audio (MP3)", `${prefix}ytmp3 ${videoUrl}`)
          .send(jid, { quoted: m });

        await m.react("✅");
      }
    } catch (err) {
      console.error(err);
      await m.react("❌");
      await m.reply(`Terjadi kesalahan sistem:\n${err.message}`);
    }
  }
};