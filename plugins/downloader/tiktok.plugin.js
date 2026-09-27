import { tiktokDl } from "../../scrape/tiktok.js";
import { TikTokSearch } from "../../scrape/tiktoksearch.js";

export default {
  name: "TikTok Downloader & Search",
  command: ["tiktok", "tt", "ttsearch"],
  owner_only: false,
  private_only: false,
  group_only: false,
  description: "Download atau cari video TikTok",
  category: "downloader",
  async run(conn, m, { jid, args, usedPrefix, command }) {
    const cmd = command.toLowerCase();
    const query = args.join(" ");

    if (!query) {
      return await m.reply(`Masukkan URL atau kata kunci!\nContoh: ${usedPrefix}${command} <url/query>`);
    }

    await m.react("⏳");
    try {
      if (cmd === "ttsearch") {
        const res = await TikTokSearch.search(query, 5);
        if (!res || !res.success || !res.payload) {
          await m.react("❌");
          return await m.reply("Tidak menemukan video TikTok dengan kata kunci tersebut.");
        }

        let text = `*Hasil Pencarian TikTok: ${query}*\n\n`;
        res.payload.slice(0, 5).forEach((v, i) => {
          text += `*${i + 1}. ${v.title}*\n`;
          text += `👤 Author: ${v.author.nickname}\n`;
          text += `⏱️ Durasi: ${v.duration} detik\n`;
          text += `▶️ Views: ${v.stats.play_count}\n`;
          text += `🔗 Link: https://tiktok.com/@${v.author.unique_id}/video/${v.id}\n\n`;
        });

        await m.reply(text.trim());
        await m.react("✅");
      } else {
        const res = await tiktokDl(query);
        if (!res || !res.status) {
          await m.react("❌");
          return await m.reply(`Gagal mengunduh TikTok: ${res.msg || "Server error"}`);
        }

        if (res.type === "photo" || (res.data && res.data[0] && res.data[0].type === "photo")) {
          for (const img of res.data) {
            if (img.type === "photo") {
              await conn.sendMessage(jid, { image: { url: img.url } }, { quoted: m });
            }
          }
          if (res.music_info?.url) {
            await conn.sendMessage(jid, { audio: { url: res.music_info.url }, mimetype: "audio/mp4" }, { quoted: m });
          }
        } else {
          const vid = res.data.find(v => v.type === "nowatermark") || res.data[0];
          await conn.sendMessage(jid, { video: { url: vid.url }, caption: res.title }, { quoted: m });
        }
        await m.react("✅");
      }
    } catch (err) {
      console.error(err);
      await m.react("❌");
      await m.reply(`Terjadi kesalahan sistem:\n${err.message}`);
    }
  }
};